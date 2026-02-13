# xgb_priority_pipeline.py
import pandas as pd, numpy as np
from pathlib import Path

DATA = Path(__file__).parent / "data" / "ipo_core_clean.csv"
OUT  = Path(__file__).parent / "analysis"
OUT.mkdir(parents=True, exist_ok=True)

def load():
    df = pd.read_csv(DATA)
    # Normalize field names used in features
    df = df.rename(columns={
        "listing_return_%": "listing_return_pct",
        "issue_size_in_cr": "issue_size_cr",
        "macro_gdp_growth": "macro_gdp_growth_pct",
        "macro_inflation": "macro_inflation_pct",
        "macro_unemployment": "macro_unemployment_pct",
    })
    # Features (drop first_day_close if you want stricter non-leaky features)
    X = df[[
        "issue_year","issue_price","first_day_close",
        "issue_size_cr","macro_gdp_growth_pct",
        "macro_inflation_pct","macro_unemployment_pct"
    ]].copy()
    X["years_since_ipo"] = 2025 - df["issue_year"]
    y = df["listing_return_pct"].astype(float)
    sector = df["sector"].astype(str)
    return df, X, y, sector

def sector_minmax(scores, sector):
    scores = pd.Series(scores, index=sector.index, dtype=float)
    out = scores.copy()
    for s in sector.unique():
        mask = (sector == s)
        v = out[mask]
        out.loc[mask] = 50.0 if v.max()==v.min() else 100*(v-v.min())/(v.max()-v.min())
    return out.round(2)

def train_ranker(X, y, sector):
    from xgboost import XGBRanker
    from sklearn.model_selection import GroupKFold
    X, y, sector = X.reset_index(drop=True), y.reset_index(drop=True), sector.reset_index(drop=True)
    gkf = GroupKFold(n_splits=min(3, sector.nunique()))
    tr_idx, va_idx = next(gkf.split(X, y, groups=sector))

    def group_sizes(labels):
        # sizes in order of appearance within the split
        return pd.Series(labels).groupby(labels, sort=False).size().to_numpy()

    tr_groups = group_sizes(sector.iloc[tr_idx])
    va_groups = group_sizes(sector.iloc[va_idx])

    model = XGBRanker(
        objective="rank:ndcg",
        n_estimators=400, learning_rate=0.05, max_depth=5,
        subsample=0.8, colsample_bytree=0.8, tree_method="hist", random_state=42
    )
    model.fit(X.iloc[tr_idx], y.iloc[tr_idx],
              group=tr_groups,
              eval_set=[(X.iloc[va_idx], y.iloc[va_idx])],
              eval_group=[va_groups],
              verbose=False)
    return model

def train_regressor(X, y, sector):
    from xgboost import XGBRegressor
    from sklearn.model_selection import GroupKFold
    gkf = GroupKFold(n_splits=min(3, sector.nunique()))
    tr_idx, va_idx = next(gkf.split(X, y, groups=sector))
    model = XGBRegressor(
        objective="reg:squarederror",
        n_estimators=600, learning_rate=0.05, max_depth=6,
        subsample=0.8, colsample_bytree=0.8, tree_method="hist", random_state=42
    )
    model.fit(X.iloc[tr_idx], y.iloc[tr_idx],
              eval_set=[(X.iloc[va_idx], y.iloc[va_idx])],
              verbose=False)
    return model

def write_sector_summary(df_in, out_csv):
    df = df_in.copy()
    # risk-tier percentages per sector
    risk_counts = (df.pivot_table(index="sector", columns="risk_tier", values="issuer_name", aggfunc="count", fill_value=0)
                     .reindex(columns=["Low","Moderate","High"], fill_value=0))
    risk_pct = risk_counts.div(risk_counts.sum(axis=1), axis=0).mul(100)
    # mean/median returns & sector priority score (mean of issuer priorities)
    # priority added later; fill placeholders here
    sector_stats = df.groupby("sector").agg(
        n_ipo=("issuer_name","count"),
        mean_return=("listing_return_pct","mean"),
        median_return=("listing_return_pct","median")
    )
    sect = sector_stats.join(risk_pct, how="left")
    sect.to_csv(out_csv, index=True)

def main():
    df, X, y, sector = load()
    try:
        model = train_ranker(X, y, sector)
        raw = model.predict(X)
        mode = "ranker"
    except Exception as e:
        print("[warn] Ranker failed, using regressor:", e)
        model = train_regressor(X, y, sector)
        raw = model.predict(X)
        mode = "regressor"

    out = df.copy()
    out["xgb_score"] = raw
    out["priority_score_0_100"] = sector_minmax(out["xgb_score"], sector)
    out["sector_rank"] = out.groupby("sector")["priority_score_0_100"].rank(ascending=False, method="dense").astype(int)
    out_path = OUT / "priority_xgb_sector.csv"
    out.to_csv(out_path, index=False)

    # sector summary with risk mix; add sector priority = mean issuer priority
    sect = out.groupby("sector").agg(
        sector_priority=("priority_score_0_100","mean"),
        n_ipo=("issuer_name","count"),
        mean_return=("listing_return_pct","mean"),
        median_return=("listing_return_pct","median")
    )
    risk_counts = (out.pivot_table(index="sector", columns="risk_tier", values="issuer_name", aggfunc="count", fill_value=0)
                     .reindex(columns=["Low","Moderate","High"], fill_value=0))
    risk_pct = risk_counts.div(risk_counts.sum(axis=1), axis=0).mul(100).add_suffix("_pct")
    sect = sect.join(risk_pct, how="left").sort_values("sector_priority", ascending=False)
    sect_path = OUT / "sector_summary.csv"
    sect.to_csv(sect_path, index=True)

    # Optional SHAP
    try:
        import shap
        explainer = shap.TreeExplainer(model)
        vals = explainer.shap_values(X)
        mean_abs = pd.Series(np.abs(vals).mean(axis=0), index=X.columns, name="mean_abs_shap") \
                     .reset_index().rename(columns={"index":"feature"})
        mean_abs.to_csv(OUT / "shap_mean_abs.csv", index=False)
    except Exception as e:
        print("[warn] SHAP skipped:", e)

    print(f"[ok] wrote {out_path}")
    print(f"[ok] wrote {sect_path}")

if __name__ == "__main__":
    main()
