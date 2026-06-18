"""
Standalone proof that the deployed XGBoost model serves a LEVEL prediction
end-to-end — BEFORE the Phase-3 FastAPI service exists.

It loads the saved artifacts only (no training, no notebook), assembles the
47-feature vector from feature_spec.json (forward-filled last known values),
runs the XGBoost model to predict the log-change, and reconstructs the level.

Run with a python that has xgboost installed, e.g.:
    ../training/.venv/bin/python test_prediction.py
"""
from pathlib import Path
import json
import numpy as np
import pandas as pd
import joblib

MODELS = Path(__file__).resolve().parent / "models"

# --- load artifacts ---
bundle = joblib.load(MODELS / "model.pkl")
spec = json.loads((MODELS / "feature_spec.json").read_text())
history = pd.read_csv(MODELS / "history.csv")

assert bundle["model_type"] == "XGBoost", f"model.pkl is {bundle['model_type']}, expected XGBoost"
model = bundle["model"]
features = bundle["feature_names"]
assert features == spec["feature_order"], "feature order mismatch between model.pkl and feature_spec.json"

# --- last known index (from history.csv) ---
last_known_index = float(history["food_price_index"].iloc[-1])
as_of = str(history["date"].iloc[-1])

# --- assemble the 47-feature vector from feature_spec's last known values ---
last_values = {ff["name"]: ff["last_value"] for ff in spec["features"]}
x = np.array([[last_values[name] for name in features]], dtype=float)
assert x.shape == (1, 47), f"feature vector shape {x.shape}, expected (1, 47)"

# --- predict log-change, reconstruct level ---
pred_log_change = float(model.predict(x)[0])
pct_change = (np.exp(pred_log_change) - 1.0) * 100.0
predicted_level = last_known_index * np.exp(pred_log_change)
next_month = (pd.Timestamp(as_of) + pd.offsets.MonthBegin(1)).date()

# --- report ---
print("=" * 56)
print("Lëk — XGBoost end-to-end serving proof")
print("=" * 56)
print(f"deployed model        : {bundle['version_name']}  ({bundle['model_type']})")
print(f"target                : {bundle['target_definition']}")
print(f"reconstruction        : {bundle['reconstruction']}")
print(f"features assembled     : {x.shape[1]} (as of {as_of})")
print("-" * 56)
print(f"last known index ({as_of[:7]}) : {last_known_index:.4f}")
print(f"predicted log-difference      : {pred_log_change:+.5f}")
print(f"predicted percent change      : {pct_change:+.2f}%")
print(f"predicted next-month index ({next_month.isoformat()[:7]}) : {predicted_level:.4f}")
print("=" * 56)
print("OK: XGBoost serves a level prediction end-to-end from saved artifacts.")
