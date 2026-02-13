# IPO Risk & Priority Scoring System

An ML-powered cross-sectional analysis platform for ranking IPOs using sector-adjusted performance and risk signals.

The system consists of:

* XGBoost-based ranking pipeline
* Sector-normalized priority scoring
* SHAP feature explainability
* FastAPI backend
* React frontend dashboard

---

## System Architecture

```
Raw Dataset (CSV)
        ↓
Feature Engineering + XGBoost Training
        ↓
Issuer-Level Priority Scores
        ↓
Sector Aggregation & Risk Mix
        ↓
Context Builder (JSON + Markdown)
        ↓
FastAPI Endpoints
        ↓
React Dashboard
```

---

## Machine Learning Pipeline

**File:** `server/xgb_priority_pipeline.py`

### 1. Data Input

Reads:

```
server/data/ipo_core_clean.csv
```

#### Features Used

* `issue_year`
* `issue_price`
* `first_day_close`
* `issue_size_cr`
* `macro_gdp_growth_pct`
* `macro_inflation_pct`
* `macro_unemployment_pct`
* Derived feature: `years_since_ipo`

#### Target Variable

```
listing_return_pct
```

---

### 2. Model Training

**Primary model**

```
XGBRanker (objective = rank:ndcg)
```

**Fallback model**

```
XGBRegressor
```

**Cross-validation strategy**

```
GroupKFold (grouped by sector)
```

This ensures:

* No sector leakage
* Proper intra-sector ranking

---

### 3. Priority Scoring

Raw model outputs are normalized sector-wise using min-max scaling:

```
priority_score_0_100
```

Issuers are then ranked within each sector:

```
sector_rank
```

This makes scores comparable within sectors.

---

### 4. Sector Aggregation

Outputs generated:

```
analysis/priority_xgb_sector.csv
analysis/sector_summary.csv
analysis/shap_mean_abs.csv (optional)
```

Sector summary includes:

* Sector priority score (mean issuer priority)
* Mean return
* Median return
* Risk tier distribution percentages

---

## Context Builder

**File:** `server/context_builder.py`

### Inputs

* `priority_xgb_sector.csv`
* `sector_summary.csv`
* `shap_mean_abs.csv`

### Outputs

```
analysis/context.json
analysis/context.md
```

### Purpose

* API responses
* Report generation
* LLM grounding context

---

## FastAPI Backend

**Main file:** `server/app.py`

### Available Endpoints

| Endpoint              | Description                  |
| --------------------- | ---------------------------- |
| `POST /train`         | Runs ML training pipeline    |
| `GET /scores`         | Issuer-level priority data   |
| `GET /sector-summary` | Sector-level aggregates      |
| `GET /context`        | Full structured JSON context |
| `GET /report`         | Markdown summary report      |

---

## Frontend

Located in:

```
perplex-ui/
```

Consumes:

```
VITE_API_URL
```

Dashboards include:

* Investors
* Regulators
* AI Insight Assistant

---

## How to Run

### Backend

```bash
cd server
python -m venv .venv

# Windows
.\.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

python xgb_priority_pipeline.py
python context_builder.py

python -m uvicorn app:app --reload
```

---

### Frontend

```bash
cd perplex-ui
npm install
npm run dev
```

---

## Production Flow

1. Train model
2. Generate context
3. Deploy FastAPI backend
4. Deploy frontend (e.g., Vercel)
5. Set `VITE_API_URL` to backend URL

---

## Data Policy

Raw datasets are excluded from this repository.

To run locally:

1. Add required CSV files to `server/data/`
2. Run the training pipeline
3. Start the backend server
