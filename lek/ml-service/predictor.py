"""
Lëk — single source of truth for model inference.

Loads the deployed model (untuned v2 XGBoost) and its feature spec ONCE, then
exposes prediction helpers used by BOTH the FastAPI service (main.py) and the
standalone proof script (test_prediction.py). No feature-assembly logic is
duplicated anywhere else.

Pipeline (proven in test_prediction.py):
  assemble 47 features (forward-filled last-known values from feature_spec.json)
  -> XGBoost predicts the log-difference ln(next) - ln(this)
  -> level = last_known_index * exp(prediction)
"""
from __future__ import annotations

from pathlib import Path
import json

import numpy as np
import pandas as pd
import joblib

MODELS = Path(__file__).resolve().parent / "models"

# The 10 states of South Sudan (the model is national; per-county is derived for now).
SOUTH_SUDAN_STATES = [
    "Central Equatoria", "Eastern Equatoria", "Jonglei", "Lakes",
    "Northern Bahr el Ghazal", "Unity", "Upper Nile", "Warrap",
    "Western Bahr el Ghazal", "Western Equatoria",
]


class _Artifacts:
    """Loads model.pkl, feature_spec.json, model_metadata.json and history.csv once."""

    def __init__(self) -> None:
        self.loaded = False
        self.error: str | None = None
        try:
            self.bundle = joblib.load(MODELS / "model.pkl")
            self.spec = json.loads((MODELS / "feature_spec.json").read_text())
            self.metadata = json.loads((MODELS / "model_metadata.json").read_text())
            hist = pd.read_csv(MODELS / "history.csv")

            if self.bundle.get("model_type") != "XGBoost":
                raise ValueError(f"expected XGBoost model.pkl, got {self.bundle.get('model_type')}")
            self.model = self.bundle["model"]
            self.features = self.bundle["feature_names"]
            if self.features != self.spec["feature_order"]:
                raise ValueError("feature order mismatch between model.pkl and feature_spec.json")

            self.last_values = {f["name"]: f["last_value"] for f in self.spec["features"]}
            self.last_known_index = float(hist["food_price_index"].iloc[-1])
            self.as_of = str(hist["date"].iloc[-1])
            self.model_version = self.bundle.get("version_name", "unknown")
            self.model_type = self.bundle.get("model_type", "unknown")
            self.loaded = True
        except Exception as exc:  # surfaced via is_loaded()/load_error()
            self.error = f"{type(exc).__name__}: {exc}"


# Module-level load == "load once at startup".
_ART = _Artifacts()


# ------------------------------------------------------------------ status
def is_loaded() -> bool:
    return _ART.loaded


def load_error() -> str | None:
    return _ART.error


def model_version() -> str | None:
    return _ART.model_version if _ART.loaded else None


def model_type() -> str | None:
    return _ART.model_type if _ART.loaded else None


def metadata() -> dict:
    return _ART.metadata if _ART.loaded else {}


# ------------------------------------------------------------------ prediction
def _next_month(date_str: str) -> str:
    return (pd.Timestamp(date_str) + pd.offsets.MonthBegin(1)).date().isoformat()


def predict_next_month() -> dict:
    """National one-month-ahead forecast. Assembles 47 features, predicts the
    log-change, reconstructs the level. Raises RuntimeError if the model isn't loaded."""
    if not _ART.loaded:
        raise RuntimeError(f"model not loaded: {_ART.error}")

    x = np.array([[_ART.last_values[name] for name in _ART.features]], dtype=float)
    if x.shape != (1, len(_ART.features)):
        raise RuntimeError(f"bad feature vector shape {x.shape}")

    pred_log_change = float(_ART.model.predict(x)[0])
    pct_change = (np.exp(pred_log_change) - 1.0) * 100.0
    predicted_level = _ART.last_known_index * np.exp(pred_log_change)

    return {
        "model_version": _ART.model_version,
        "model_type": _ART.model_type,
        "as_of_month": _ART.as_of,
        "target_month": _next_month(_ART.as_of),
        "last_known_index": round(_ART.last_known_index, 4),
        "predicted_log_change": round(pred_log_change, 5),
        "predicted_change_pct": round(pct_change, 2),
        "predicted_level": round(predicted_level, 4),
    }


def predict_for_county(county: str | None = None) -> dict:
    """Prediction for a county (or national if county is None). The model is
    national, so a county result is the national figure, clearly flagged derived."""
    base = predict_next_month()
    if not county:
        return {**base, "scope": "national", "derived": False}
    return {
        **base, "scope": "county", "county": county, "derived": True,
        "note": "national model applied to county — per-county model not yet trained",
    }


def predict_all_counties() -> dict:
    """National forecast applied to all 10 states, clearly labelled as derived estimates."""
    base = predict_next_month()
    counties = [{
        "county": c,
        "predicted_change_pct": base["predicted_change_pct"],
        "predicted_level": base["predicted_level"],
        "derived": True,
    } for c in SOUTH_SUDAN_STATES]
    return {
        "model_version": base["model_version"],
        "as_of_month": base["as_of_month"],
        "target_month": base["target_month"],
        "national": {k: base[k] for k in
                     ("last_known_index", "predicted_change_pct", "predicted_level")},
        "counties": counties,
        "note": ("per-county figures are derived from the national forecast — "
                 "no per-county model exists yet"),
    }
