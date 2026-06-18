"""
Lëk ML service — FastAPI.

Serves the trained food-price-inflation model (ARIMA, selected in
training/train_model.ipynb). Exposes a one-month-ahead national forecast and
model metadata. Interactive Swagger UI is available at /docs.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from statsmodels.tsa.arima.model import ARIMA

MODELS_DIR = Path(__file__).resolve().parent / "models"

# Default alert thresholds (percent month-over-month change in the food price index).
DEFAULT_DANGER = 5.0
DEFAULT_SEVERE = 10.0

# ---------------------------------------------------------------- load artifacts
bundle: dict = {}
metadata: dict = {}
history: list[float] = []
history_dates: list[str] = []


def _load_artifacts() -> None:
    """Load model bundle, metadata, and the historical index series once at startup."""
    global bundle, metadata, history, history_dates
    bundle = joblib.load(MODELS_DIR / "model.pkl")
    metadata = json.loads((MODELS_DIR / "model_metadata.json").read_text())
    hist = pd.read_csv(MODELS_DIR / "history.csv")
    history = hist["food_price_index"].astype(float).tolist()
    history_dates = hist["date"].astype(str).tolist()


_load_artifacts()


# ----------------------------------------------------------------- helpers
def _next_month(date_str: str) -> str:
    """Return the first day of the month after the given YYYY-MM-DD string."""
    return (pd.Timestamp(date_str) + pd.offsets.MonthBegin(1)).date().isoformat()


def _risk_level(change_pct: float, danger: float, severe: float) -> str:
    if change_pct >= severe:
        return "severe"
    if change_pct >= danger:
        return "danger"
    return "normal"


def _forecast(series: list[float], danger: float, severe: float,
              last_date: Optional[str]) -> "ForecastResponse":
    """Refit ARIMA on the series and forecast one month ahead."""
    order = tuple(bundle.get("arima_order", (1, 1, 2)))
    try:
        fit = ARIMA(series, order=order).fit()
        forecast_index = float(fit.forecast(1)[0])
    except Exception as exc:  # pragma: no cover - guards bad input series
        raise HTTPException(status_code=500, detail=f"forecast failed: {exc}")

    current_index = float(series[-1])
    change_pct = (forecast_index - current_index) / current_index * 100 if current_index else 0.0
    base_date = last_date or (history_dates[-1] if history_dates else "2026-04-01")

    return ForecastResponse(
        model_version=metadata.get("version_name", "unknown"),
        current_month=base_date,
        target_month=_next_month(base_date),
        current_index=round(current_index, 2),
        forecast_index=round(forecast_index, 2),
        predicted_change_pct=round(change_pct, 2),
        risk_level=_risk_level(change_pct, danger, severe),
        thresholds={"danger": danger, "severe": severe},
    )


# ----------------------------------------------------------------- schemas
class HealthResponse(BaseModel):
    status: str = "ok"
    model_loaded: bool
    model_version: str


class ForecastResponse(BaseModel):
    model_version: str
    current_month: str = Field(..., description="Month of the latest known index (YYYY-MM-DD)")
    target_month: str = Field(..., description="Month being forecast (YYYY-MM-DD)")
    current_index: float
    forecast_index: float
    predicted_change_pct: float = Field(..., description="Month-over-month % change")
    risk_level: str = Field(..., description="normal | danger | severe")
    thresholds: dict


class PredictRequest(BaseModel):
    history: Optional[list[float]] = Field(
        None, description="Optional custom index series (oldest→newest). "
                          "Defaults to the bundled historical series.")
    danger_level: float = Field(DEFAULT_DANGER, description="Danger threshold (% change)")
    severe_level: float = Field(DEFAULT_SEVERE, description="Severe threshold (% change)")


# ----------------------------------------------------------------- app
app = FastAPI(
    title="Lëk ML Service",
    description="Food-price-inflation forecasting for South Sudan. "
                "One-month-ahead national food price index forecast.",
    version=metadata.get("version_name", "v1"),
)

# Allow the Vite dashboard (and others, in dev) to call the API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    return HealthResponse(
        model_loaded=bool(bundle),
        model_version=metadata.get("version_name", "unknown"),
    )


@app.get("/model", tags=["meta"])
def model_info() -> dict:
    """Full trained-model metadata: metrics, features, and training range."""
    return metadata


@app.get("/forecast", response_model=ForecastResponse, tags=["forecast"])
def forecast(danger_level: float = DEFAULT_DANGER,
             severe_level: float = DEFAULT_SEVERE) -> ForecastResponse:
    """Current national one-month-ahead food-price forecast (uses bundled history)."""
    return _forecast(history, danger_level, severe_level, history_dates[-1])


@app.post("/predict", response_model=ForecastResponse, tags=["forecast"])
def predict(req: PredictRequest) -> ForecastResponse:
    """Forecast from a custom index series, or the bundled history if none is given."""
    series = req.history if req.history else history
    if len(series) < 24:
        raise HTTPException(status_code=400,
                            detail="history needs at least 24 monthly points")
    last_date = None if req.history else history_dates[-1]
    return _forecast(series, req.danger_level, req.severe_level, last_date)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {"service": "lek-ml-service", "docs": "/docs",
            "model_version": metadata.get("version_name", "unknown")}
