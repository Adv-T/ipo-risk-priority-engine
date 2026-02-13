# app.py
from pathlib import Path
import os, sys, subprocess, datetime, re
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from fpdf import FPDF


ROOT = Path(__file__).parent
AN = ROOT / "analysis"
DATA = ROOT / "data" / "ipo_core_clean.csv"

load_dotenv(dotenv_path=ROOT / ".env")


DEFAULT_MODEL = "models/gemini-2.5-flash"
API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

import google.generativeai as genai
if API_KEY:
    genai.configure(api_key=API_KEY)


def ask_gemini(prompt: str, model_name: str = DEFAULT_MODEL) -> str:
    if not API_KEY:
        return "[error] GEMINI_API_KEY not set"
    try:
        model = genai.GenerativeModel(model_name)
        resp = model.generate_content(prompt, generation_config={"temperature": 0.2})
        return getattr(resp, "text", "").strip() or "[empty response]"
    except Exception as e:
        return f"[error] {type(e).__name__}: {e}"


def read_context():
    md = (AN / "context.md").read_text(encoding="utf-8")
    df_sect = pd.read_csv(AN / "sector_summary.csv")
    df_prior = pd.read_csv(AN / "priority_xgb_sector.csv")
    df_shap = pd.read_csv(AN / "shap_mean_abs.csv")
    return md, df_sect, df_prior, df_shap


app = FastAPI(title="IPO AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "has_data": DATA.exists(),
        "has_priority": (AN / "priority_xgb_sector.csv").exists(),
        "has_context": (AN / "context.md").exists(),
        "model": DEFAULT_MODEL,
        "key_present": bool(API_KEY),
    }


@app.get("/diag")
def diag():
    msg = ask_gemini("Reply OK if working.")
    return {
        "sdk_ok": msg.strip().upper().startswith("OK"),
        "ping": msg[:200],
        "model": DEFAULT_MODEL,
    }


@app.post("/train")
def train():
    if not DATA.exists():
        return JSONResponse({"error": "data/ipo_core_clean.csv not found"}, status_code=400)
    cmd = [sys.executable, str(ROOT / "xgb_priority_pipeline.py")]
    res = subprocess.run(cmd, capture_output=True, text=True)
    ok = (AN / "priority_xgb_sector.csv").exists()
    return {"ok": ok, "log_tail": ((res.stdout or "") + "\n" + (res.stderr or ""))[-4000:]}


@app.post("/refresh")
def refresh():
    try:
        from server.context_builder import build
        return build()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/scores")
def scores():
    p = AN / "priority_xgb_sector.csv"
    if not p.exists():
        return JSONResponse({"error": "Run /train first"}, status_code=400)
    df = pd.read_csv(p).sort_values(["sector", "sector_rank"])
    cols = ["issuer_name", "sector", "issue_year", "priority_score_0_100", "sector_rank"]
    return df[cols].to_dict(orient="records")


@app.get("/sector-summary")
def sector_summary():
    p = AN / "sector_summary.csv"
    if not p.exists():
        return JSONResponse({"error": "Run /train first"}, status_code=400)
    return pd.read_csv(p).to_dict(orient="records")


@app.post("/ask")
def ask(payload: dict = Body(...)):
    q = (payload.get("query") or "").strip()
    if not q:
        return JSONResponse({"error": "missing query"}, status_code=400)
    ctx = AN / "context.md"
    if not ctx.exists():
        return JSONResponse({"error": "context missing: run /refresh"}, status_code=400)

    md, *_ = read_context()
    prompt = f"""
You are an investment Q&A assistant trained on IPO, sector, and macroeconomic data.
Use ONLY the data below. If uncertain, say "I don't have enough data to answer confidently."
Always cite sectors and issuer years in brackets, e.g., [Technology], [IRCTC, 2019].

DATA CONTEXT:
{md}

QUESTION: {q}

INSTRUCTIONS:
- If asked "best sector", compare sector_priority, mean_return, and risk-tier mix.
- If asked about drivers, refer to SHAP importance ranking.
- Always justify answers with 1–2 issuer examples.
- Max 10 sentences, analytical tone.
"""
    reply = ask_gemini(prompt)
    if reply.startswith("[error]"):
        return JSONResponse({"answer": reply}, status_code=500)
    return {"answer": reply}


def clean_text(s: str) -> str:
    s = s.replace("—", "-").replace("–", "-")
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("•", "-").replace("₹", "Rs.")
    return re.sub(r"[^\x00-\xFF]", "?", s)


def make_pdf_bytes(title: str, body: str, logos: list[tuple[Path, int]] | None = None) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(True, 15)
    pdf.add_page()

    if logos:
        for path, x in logos:
            if path and path.exists():
                pdf.image(str(path), x=x, y=10, w=22)

    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 14, clean_text(title), ln=True, align="C")
    pdf.ln(6)

    pdf.set_font("Helvetica", "", 12)
    for para in body.split("\n\n"):
        pdf.multi_cell(0, 6, clean_text(para.strip()))
        pdf.ln(2)

    pdf.set_y(-15)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(0, 10, clean_text(f"Generated {datetime.datetime.now():%d %b %Y, %I:%M %p}"), 0, 0, "R")

    return pdf.output(dest="S").encode("latin-1")



def stream_pdf(filename: str, pdf_bytes: bytes) -> StreamingResponse:
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)


@app.get("/report/test")
def report_test():
    body = "Hello from IPO AI.\n\nIf you can download this, PDF delivery works."
    return stream_pdf("test.pdf", make_pdf_bytes("PDF Test", body))


@app.get("/report/investor")
def report_investor():
    if not (AN / "context.md").exists():
        return JSONResponse({"error": "Run /refresh first"}, status_code=400)
    md, *_ = read_context()
    prompt = f"""
You are a financial analyst preparing an INVESTOR report for retail clients.
Use a professional yet accessible tone and ensure a logical flow.

Structure the report as follows:

1. **Sector Overview**
   - Summarize sector-wise IPO performance and historical patterns using the context data.
   - Compare risk, returns, and mean performance across key sectors.

2. **Risk Profile (% Distribution)**
   - Present risk distribution: Low / Moderate / High.
   - Identify sectors with greatest volatility and potential upside.
   - Explain implications for small and mid-tier investors.

3. **Forecast & Sector Outlook**
   - Predict short-term (6–12 month) trends based on context data.
   - Highlight sectors likely to outperform vs. underperform.

4. **Investment Advisory**
   - Provide 3–5 actionable recommendations for retail investors.
   - Balance optimism with caution and emphasize diversification.

Conclude with a one-line italicized market summary.
Use bullet points and subheadings for readability.

DATA:
{md}
"""
    out = ask_gemini(prompt)
    if out.startswith("[error]"):
        return JSONResponse({"error": out}, status_code=500)
    pdf = make_pdf_bytes("Investor Report — IPO & Sector Insights", out)
    return stream_pdf("investor_report.pdf", pdf)


@app.get("/report/regulator")
def report_regulator():
    if not (AN / "context.md").exists():
        return JSONResponse({"error": "Run /refresh first"}, status_code=400)
    md, *_ = read_context()
    today = datetime.datetime.now().strftime("%B %d, %Y")
    prompt = f"""
You are a compliance and governance analyst preparing a REGULATOR report for SEBI and RBI.
The current date is {today}.
Maintain an objective, data-backed tone, similar to a policy briefing.

Structure the report as follows:

1. **Executive Summary**
   - Summarize sector-level priorities, risks, and compliance implications.

2. **Analytical Methodology**
   - Describe use of XGBoost ranking, SHAP explainability, and sector normalization.
   - Note data assumptions and inherent limitations.

3. **Sectoral Risk & Compliance Overview**
   - Detail risk-tier percentages and priority ordering.
   - Identify sectors with elevated risk or data anomalies requiring regulatory oversight.

4. **Issuer-Level Observations**
   - Highlight top issuers per sector with priority scores and years.
   - Discuss recurring indicators needing compliance attention.

5. **Predictive & Forward-Looking Assessment**
   - Based on model insights, forecast sectors that may require enhanced supervision.

6. **Governance & Recommendations**
   - Provide actionable measures for SEBI/RBI:
     * Monitoring frequency
     * Data collection improvements
     * AI model recalibration intervals

7. **Appendix / Caveats**
   - Include disclaimers about data quality, evolving markets, and responsible-AI compliance.

DATA:
{md}
"""
    out = ask_gemini(prompt)
    if out.startswith("[error]"):
        return JSONResponse({"error": out}, status_code=500)
    logos = [
        (ROOT / "assets" / "sebi_logo.png", 14),
        (ROOT / "assets" / "rbi_logo.png", 174),
    ]
    pdf = make_pdf_bytes("Regulator Compliance Report — SEBI & RBI", out, logos=logos)
    return stream_pdf("regulator_report.pdf", pdf)
