"""
Lëk ML service — FastAPI.

Serves the deployed food-price model (untuned v2 XGBoost, change-based target).
All prediction logic lives in predictor.py (one source of truth, loaded once at
startup). Interactive Swagger UI at /docs.

Endpoints:
  GET  /health      -> service + model status
  POST /predict     -> {county?: str} national or per-county next-month forecast
  GET  /predict/all -> forecast for all 10 states (per-county figures derived)
  GET  /model/info  -> deployed-model metadata (version, metrics, caveat)
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import predictor

# Allowed browser origins (the Vite dashboard in local dev).
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


# ----------------------------------------------------------------- schemas
class PredictRequest(BaseModel):
    county: Optional[str] = Field(
        None, description="County/state name. Omit for the national forecast.")


# ----------------------------------------------------------------- app
app = FastAPI(
    title="Lëk ML Service",
    description="Food-price-inflation forecasting for South Sudan — one month ahead "
                "(deployed model: untuned v2 XGBoost, change-based target).",
    version=predictor.model_version() or "unknown",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

if predictor.is_loaded():
    print(f"[ml-service] model loaded: {predictor.model_version()} "
          f"({predictor.model_type()})")
else:
    print(f"[ml-service] WARNING: model failed to load: {predictor.load_error()}")


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Service + model status. Reports model_loaded=false (with reason) if load failed."""
    loaded = predictor.is_loaded()
    out = {
        "status": "ok" if loaded else "error",
        "model_loaded": loaded,
        "model_version": predictor.model_version(),
        "model_type": "xgboost",
    }
    if not loaded:
        out["error"] = predictor.load_error()
    return out


@app.post("/predict", tags=["forecast"])
def predict(req: PredictRequest) -> dict:
    """National forecast, or a county forecast (derived from the national model)."""
    try:
        return predictor.predict_for_county(req.county)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"prediction failed: {exc}")


@app.get("/predict/all", tags=["forecast"])
def predict_all() -> dict:
    """Forecast for all 10 states (per-county figures are derived estimates)."""
    try:
        return predictor.predict_all_counties()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"prediction failed: {exc}")


@app.get("/model/info", tags=["meta"])
def model_info() -> dict:
    """Deployed-model metadata: version, metrics, deployed status, staleness caveat."""
    md = predictor.metadata()
    if not md:
        raise HTTPException(status_code=503, detail="model metadata unavailable")
    return md


@app.get("/", tags=["meta"])
def root() -> dict:
    return {"service": "lek-ml-service", "docs": "/docs",
            "model_version": predictor.model_version(),
            "model_loaded": predictor.is_loaded()}
