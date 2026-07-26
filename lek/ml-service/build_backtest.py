"""
Regenerate the held-out backtest series for the DEPLOYED model (models/backtest.json).

Why this exists: build_production_model.py computes test-set predictions but only
persists the aggregate metrics — the per-month predicted-vs-actual series is thrown
away. The dashboard needs that series, and the ml-service image does not (and must
not) contain the training data, so the series is precomputed here into a small
read-only artifact that ships alongside model.pkl.

This does NOT retrain anything. It loads the deployed model.pkl, rebuilds the same
47 features from master_monthly.csv, applies the same 2025-01-01 split, and records
what the deployed model actually predicts on the held-out rows. It then asserts the
recomputed metrics match model_metadata.json, so the artifact cannot silently drift
from the deployed model.

Run with a venv that has xgboost (e.g. the ml-service venv):
    .venv/bin/python build_backtest.py
"""
from pathlib import Path
import json

import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import mean_squared_error, r2_score

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MASTER = ROOT / "training" / "data" / "processed" / "master_monthly.csv"
MODELS = HERE / "models"

# The v2 split: everything before 2025-01 trains, everything from 2025-01 is held out.
SPLIT = pd.Timestamp("2025-01-01")

COMMODITIES = ["beans", "cassava", "groundnuts", "livestockgoat_male", "livestocksheep_male",
               "maize", "maize_meal", "millet", "oil", "salt", "sesame", "sorghum",
               "sugar", "wheat_flour"]
CONFLICT = ["conflict_events_ssd", "conflict_deaths_ssd",
            "conflict_events_sdn", "conflict_deaths_sdn"]


def build_features(master: pd.DataFrame) -> pd.DataFrame:
    """Rebuild the v2 feature frame — identical to build_production_model.py."""
    f = master.copy()
    for lag in [1, 3, 6, 12]:
        f[f"fpi_lag{lag}"] = f["c_food_price_index"].shift(lag)
    f["fpi_roll3"] = f["c_food_price_index"].rolling(3).mean()
    f["fpi_roll6"] = f["c_food_price_index"].rolling(6).mean()
    for lag in [1, 3]:
        f[f"fx_lag{lag}"] = f["exchange_rate"].shift(lag)
    f["oil_lag1"] = f["oil_production"].shift(1)
    for c in CONFLICT:
        f[f"{c}_lag1"] = f[c].shift(1)
    season_map = {s: i for i, s in enumerate(sorted(f["season"].dropna().unique()))}
    f["season_ord"] = f["season"].map(season_map)
    f["is_lean_season"] = f["is_lean_season"].astype(int)
    month_oh = pd.get_dummies(f["month"], prefix="m").astype(int)
    return pd.concat([f, month_oh], axis=1).dropna().reset_index(drop=True)


def main() -> None:
    if not MASTER.exists():
        raise SystemExit(f"missing training data: {MASTER}\n"
                         "This script only runs in the full repo, not in the ml-service image.")

    bundle = joblib.load(MODELS / "model.pkl")
    metadata = json.loads((MODELS / "model_metadata.json").read_text())
    features, model = bundle["feature_names"], bundle["model"]

    master = pd.read_csv(MASTER, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
    f = build_features(master)

    te = f["date"] >= SPLIT
    X_test = f.loc[te, features].values
    this_month = f.loc[te, "this_month_index"].values.astype(float)
    actual = f.loc[te, "next_month_index"].values.astype(float)
    # Each row predicts the month AFTER its own date, so label by the target month.
    target_months = pd.to_datetime(f.loc[te, "date"].values) + pd.offsets.MonthBegin(1)

    # Deployed model predicts the log-change; reconstruct the level it implies.
    pred_log_change = model.predict(X_test).astype(float)
    predicted = this_month * np.exp(pred_log_change)

    mask = actual != 0
    metrics = {
        "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
        "mape": float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100),
        "r2_score": float(r2_score(actual, predicted)),
    }

    # Honesty check: the regenerated series must reproduce the recorded metrics.
    for key in ("rmse", "mape", "r2_score"):
        recorded = float(metadata[key])
        if abs(metrics[key] - recorded) > 1e-4:
            raise SystemExit(f"{key} mismatch: recomputed {metrics[key]:.6f} vs "
                             f"recorded {recorded:.6f} — model.pkl and the data disagree.")

    artifact = {
        "version_name": bundle.get("version_name"),
        "evaluation": "offline backtest on held-out data — NOT live prediction accuracy",
        "split_date": str(SPLIT.date()),
        "training_range": metadata.get("training_data_range"),
        "unit": "food price index (level, reconstructed from the predicted log-change)",
        "n_points": int(te.sum()),
        "period": {"start": str(target_months.min().date()),
                   "end": str(target_months.max().date())},
        "metrics": {k: round(v, 6) for k, v in metrics.items()},
        "generated_by": "build_backtest.py (deployed model.pkl replayed over the held-out split)",
        "series": [
            {"target_month": str(d.date()), "actual": round(float(a), 4),
             "predicted": round(float(p), 4)}
            for d, a, p in zip(target_months, actual, predicted)
        ],
    }

    out = MODELS / "backtest.json"
    out.write_text(json.dumps(artifact, indent=2) + "\n")
    print(f"saved: {out.name} — {artifact['n_points']} points "
          f"({artifact['period']['start']} → {artifact['period']['end']})")
    print(f"  RMSE={metrics['rmse']:.6f}  MAPE={metrics['mape']:.6f}  R2={metrics['r2_score']:.6f}"
          "  (matches model_metadata.json)")


if __name__ == "__main__":
    main()
