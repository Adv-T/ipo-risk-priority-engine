from pathlib import Path
import pandas as pd
import json

ROOT = Path(__file__).parent
AN = ROOT / "analysis"
OUT = AN  # write alongside your CSVs

def load_frames():
    df_prior = pd.read_csv(AN / "priority_xgb_sector.csv")
    df_sect  = pd.read_csv(AN / "sector_summary.csv")
    df_shap  = pd.read_csv(AN / "shap_mean_abs.csv")
    return df_prior, df_sect, df_shap

def make_markdown(df_prior: pd.DataFrame, df_sect: pd.DataFrame, df_shap: pd.DataFrame) -> str:
    lines = ["# IPO Context Pack (Auto-generated)\n"]

    # Sector ranking
    sect_md = df_sect.sort_values("sector_priority", ascending=False)
    lines.append("## Sector Ranking (by priority)")
    for _, r in sect_md.iterrows():
        lines.append(
            f"- **{r['sector']}** — Priority {r['sector_priority']:.1f} | "
            f"Low {r.get('Low_pct',0):.1f}% • Mod {r.get('Moderate_pct',0):.1f}% • High {r.get('High_pct',0):.1f}%"
        )
    lines.append("")

    # Top issuers per sector
    lines.append("## Top IPOs per Sector (by priority)")
    for sec, g in df_prior.groupby("sector"):
        g = g.sort_values("sector_rank").head(5)
        lines.append(f"### {sec}")
        for _, r in g.iterrows():
            lines.append(
                f"- {r['issuer_name']} ({int(r['issue_year'])}) — "
                f"Score {r['priority_score_0_100']:.1f}, Rank {int(r['sector_rank'])}"
            )
        lines.append("")

    # SHAP
    lines.append("## Global Feature Importance (SHAP)")
    lines.append(df_shap.sort_values("mean_abs_shap", ascending=False).to_string(index=False))
    lines.append("")

    return "\n".join(lines)

def make_json(df_prior: pd.DataFrame, df_sect: pd.DataFrame, df_shap: pd.DataFrame) -> dict:
    return {
        "sectors": df_sect.sort_values("sector_priority", ascending=False).to_dict(orient="records"),
        "issuers": df_prior.sort_values(["sector","sector_rank"]).to_dict(orient="records"),
        "shap_global": df_shap.sort_values("mean_abs_shap", ascending=False).to_dict(orient="records"),
    }

def build():
    df_prior, df_sect, df_shap = load_frames()
    md = make_markdown(df_prior, df_sect, df_shap)
    js = make_json(df_prior, df_sect, df_shap)
    (OUT / "context.md").write_text(md, encoding="utf-8")
    (OUT / "context.json").write_text(json.dumps(js, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "markdown_bytes": len(md), "issuers": len(js["issuers"]), "sectors": len(js["sectors"])}

if __name__ == "__main__":
    print(build())
