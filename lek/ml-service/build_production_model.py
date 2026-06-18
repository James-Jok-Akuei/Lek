"""
Build the PRODUCTION model for Lëk: the untuned v2 XGBoost (change-based target).

Why this script exists: the training notebook was later overwritten by the
hyperparameter-tuning pass (which made XGBoost worse), so the untuned v2 XGBoost is
not on disk. This script regenerates it CLEANLY from the v2 pipeline — the original
47-feature set, the original untuned params, the log-difference target, and the same
train/test split — then verifies it reproduces the recorded v2 metrics
(RMSE 1.272, MAPE 2.22%, R2 0.865) before saving.

Deploys: model.pkl = untuned v2 XGBoost. Also writes model_xgboost.pkl (same),
model_arima.pkl (univariate baseline), feature_spec.json, and model_metadata.json.

Run with the training venv (has xgboost):
    ../training/.venv/bin/python build_production_model.py
"""
from pathlib import Path
from datetime import datetime
import json
import numpy as np
import pandas as pd
import joblib

from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from statsmodels.tsa.arima.model import ARIMA
from xgboost import XGBRegressor

SEED = 42
np.random.seed(SEED)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MASTER = ROOT / "training" / "data" / "processed" / "master_monthly.csv"
MODELS = HERE / "models"
MODELS.mkdir(exist_ok=True)

COMMODITIES = ["beans","cassava","groundnuts","livestockgoat_male","livestocksheep_male",
               "maize","maize_meal","millet","oil","salt","sesame","sorghum","sugar","wheat_flour"]
CONFLICT = ["conflict_events_ssd","conflict_deaths_ssd","conflict_events_sdn","conflict_deaths_sdn"]

# ----------------------------------------------------------- build v2 47 features
m = pd.read_csv(MASTER, parse_dates=["date"]).sort_values("date").reset_index(drop=True)
f = m.copy()
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
f = pd.concat([f, month_oh], axis=1).dropna().reset_index(drop=True)

FEATURES = (["c_food_price_index", "inflation_food_price_index"]
            + [f"c_{c}" for c in COMMODITIES]
            + ["exchange_rate", "oil_production", "national_cpi", "pipeline_flowing",
               "is_lean_season", "season_ord"]
            + [f"fpi_lag{l}" for l in [1, 3, 6, 12]] + ["fpi_roll3", "fpi_roll6"]
            + ["fx_lag1", "fx_lag3", "oil_lag1"]
            + [f"{c}_lag1" for c in CONFLICT]
            + list(month_oh.columns))
assert len(FEATURES) == 47, f"expected 47 features, got {len(FEATURES)}"
TARGET = "y_log_change"

# ----------------------------------------------------------- split (v2, unchanged)
split = pd.Timestamp("2025-01-01")
tr, te = f["date"] < split, f["date"] >= split
X_train, X_test = f.loc[tr, FEATURES].values, f.loc[te, FEATURES].values
y_train, y_test = f.loc[tr, TARGET].values, f.loc[te, TARGET].values
this_test = f.loc[te, "this_month_index"].values
level_true = f.loc[te, "next_month_index"].values
train_range = (str(f.loc[tr, "date"].min().date()), str(f.loc[tr, "date"].max().date()))

scaler = StandardScaler().fit(X_train)  # used by Linear only; XGBoost uses raw features

def recon(this_idx, pred):
    return np.asarray(this_idx, float) * np.exp(np.asarray(pred, float))

def level_metrics(yt, yp):
    yt, yp = np.asarray(yt, float), np.asarray(yp, float)
    mask = yt != 0
    return {"RMSE": float(np.sqrt(mean_squared_error(yt, yp))), "MAE": float(mean_absolute_error(yt, yp)),
            "MAPE": float(np.mean(np.abs((yt[mask]-yp[mask])/yt[mask]))*100), "R2": float(r2_score(yt, yp))}

def change_metrics(yt, yp):
    yt, yp = np.asarray(yt, float), np.asarray(yp, float)
    mask = np.abs(yt) >= 0.01
    mape = float(np.mean(np.abs((yt[mask]-yp[mask])/yt[mask]))*100) if mask.sum() else float("nan")
    return {"R2": float(r2_score(yt, yp)), "MAPE": mape, "MAE": float(mean_absolute_error(yt, yp))}

results = {}

# ----------------------------------------------------------- UNTUNED v2 XGBoost (deployed)
val_n = 12
xgb_model = XGBRegressor(n_estimators=300, learning_rate=0.05, max_depth=6,
                         random_state=SEED, n_jobs=-1, early_stopping_rounds=30, eval_metric="rmse")
xgb_model.fit(X_train[:-val_n], y_train[:-val_n], eval_set=[(X_train[-val_n:], y_train[-val_n:])], verbose=False)
xgb_change = xgb_model.predict(X_test)
results["XGBoost"] = {"level": level_metrics(level_true, recon(this_test, xgb_change)),
                      "change": change_metrics(y_test, xgb_change)}

# ----------------------------------------------------------- baselines for metadata
lin = LinearRegression().fit(scaler.transform(X_train), y_train)
lin_change = lin.predict(scaler.transform(X_test))
results["LinearRegression"] = {"level": level_metrics(level_true, recon(this_test, lin_change)),
                               "change": change_metrics(y_test, lin_change)}

rf = RandomForestRegressor(n_estimators=200, max_depth=10, random_state=SEED, n_jobs=-1).fit(X_train, y_train)
rf_change = rf.predict(X_test)
results["RandomForest"] = {"level": level_metrics(level_true, recon(this_test, rf_change)),
                           "change": change_metrics(y_test, rf_change)}

# ARIMA univariate baseline: rolling one-step level forecast, order (1,1,2)
fpi = f.set_index("date")["c_food_price_index"].asfreq("MS")
dates_test = f.loc[te, "date"]
hist = list(fpi[fpi.index <= dates_test.min()].values)
arima_level = []
for tgt in (pd.to_datetime(dates_test.values) + pd.offsets.MonthBegin(1)):
    fit = ARIMA(hist, order=(1, 1, 2)).fit()
    arima_level.append(float(np.asarray(fit.forecast(1)).ravel()[0]))
    hist.append(float(fpi.get(tgt, hist[-1])))
arima_level = np.array(arima_level)
results["ARIMA"] = {"level": level_metrics(level_true, arima_level),
                    "change": change_metrics(y_test, np.log(arima_level) - np.log(this_test))}
# LSTM not retrained here (slow, not deployed); carry the documented v2 run value.
results["LSTM"] = {"level": {"RMSE": 11.839, "MAE": 11.10, "MAPE": 26.27, "R2": -10.702},
                   "change": {"R2": -61.549, "MAPE": 749.20, "MAE": 0.62},
                   "_source": "carried from v2 notebook run (not retrained here)"}

# ----------------------------------------------------------- honesty check
xl = results["XGBoost"]["level"]
print("Regenerated untuned v2 XGBoost (level-space):")
print(f"  RMSE={xl['RMSE']:.4f} (v2=1.272)  MAPE={xl['MAPE']:.4f} (v2=2.22)  R2={xl['R2']:.4f} (v2=0.865)")
ok = abs(xl["RMSE"]-1.272) < 0.05 and abs(xl["MAPE"]-2.22) < 0.1 and abs(xl["R2"]-0.865) < 0.02
print("  reproduces v2 metrics:", "YES" if ok else "NO — investigate")
assert ok, "Regenerated XGBoost does not match documented v2 metrics."

# ----------------------------------------------------------- save model bundles
version = f"v2_xgboost_change_{datetime.now():%Y%m%d}"
bundle = {
    "model_type": "XGBoost", "deployed": True, "version_name": version,
    "model": xgb_model,
    "target": "log_change",
    "target_definition": "ln(next_month_index) - ln(this_month_index)",
    "reconstruction": "predicted_level = last_known_index * exp(prediction)",
    "feature_names": FEATURES, "n_features": 47,
    "uses_scaled_input": False, "scaler": None,
    "scaler_note": ("v2 fit a StandardScaler for Linear/LSTM only; XGBoost uses raw "
                    "(unscaled) features, so NO scaler is applied at inference."),
    "api_note": ("Build the 47-feature vector (see feature_spec.json) in the exact "
                 "feature_names order, predict the log-change, then "
                 "level = last_known_index * exp(prediction)."),
}
joblib.dump(bundle, MODELS / "model.pkl")
joblib.dump(xgb_model, MODELS / "model_xgboost.pkl")
joblib.dump({"model_type": "ARIMA", "arima_order": [1, 1, 2], "model": "arima_refit_per_inference",
             "target": "level_via_differencing",
             "reconstruction": "ARIMA forecasts the level directly; no exp() step.",
             "note": "univariate baseline / fallback; refit on history.csv at inference"},
            MODELS / "model_arima.pkl")
print("saved: model.pkl (untuned v2 XGBoost), model_xgboost.pkl, model_arima.pkl")

# ----------------------------------------------------------- feature_spec.json
COMP = {
    "c_food_price_index": "current month food price index (mean across 40 markets)",
    "inflation_food_price_index": "current month month-over-month food inflation",
    "exchange_rate": "current month unofficial exchange rate (market mean)",
    "oil_production": "current month oil production (Mb/d); stale after 2026-01, forward-filled",
    "national_cpi": "national CPI inflation %, annual forward-filled; stale after 2024",
    "pipeline_flowing": "oil pipeline flowing flag (1/0) for the current month",
    "is_lean_season": "1 if current month is in the lean season (May-Jul), else 0",
    "season_ord": f"season ordinal ({season_map})",
    "fpi_roll3": "3-month rolling mean of the food price index",
    "fpi_roll6": "6-month rolling mean of the food price index",
    "fx_lag1": "exchange rate lagged 1 month", "fx_lag3": "exchange rate lagged 3 months",
    "oil_lag1": "oil production lagged 1 month",
    "conflict_events_ssd_lag1": "South Sudan conflict event count lag 1 month; stale after 2024 -> 0",
    "conflict_deaths_ssd_lag1": "South Sudan conflict deaths lag 1 month; stale after 2024 -> 0",
    "conflict_events_sdn_lag1": "Sudan conflict event count lag 1 month; stale after 2024 -> 0",
    "conflict_deaths_sdn_lag1": "Sudan conflict deaths lag 1 month; stale after 2024 -> 0",
}
for c in COMMODITIES:
    COMP[f"c_{c}"] = f"current month price of {c.replace('_',' ')}"
for l in [1, 3, 6, 12]:
    COMP[f"fpi_lag{l}"] = f"food price index lagged {l} month(s)"
for mm in range(1, 13):
    COMP[f"m_{mm}"] = f"month-of-year one-hot: 1 if current month == {mm}"

last_row = f.iloc[-1]
as_of = str(last_row["date"].date())
last_known_index = float(last_row["this_month_index"])
feature_spec = {
    "model": "untuned v2 XGBoost", "version_name": version,
    "target_definition": "ln(next_month_index) - ln(this_month_index)",
    "reconstruction": "predicted_level = last_known_index * exp(prediction)",
    "n_features": 47, "feature_order": FEATURES,
    "as_of_month": as_of, "last_known_index": last_known_index,
    "note": ("last_value is the most recent known value for each feature (stale "
             "conflict/oil/CPI features are already forward/zero-filled in the "
             "processed data). The Phase-3 API assembles the vector in feature_order."),
    "features": [
        {"name": name, "dtype": "int" if name.startswith("m_") or name in
         ("pipeline_flowing", "is_lean_season", "season_ord") else "float",
         "computation": COMP.get(name, name),
         "last_value": float(last_row[name])}
        for name in FEATURES
    ],
}
with open(MODELS / "feature_spec.json", "w") as fh:
    json.dump(feature_spec, fh, indent=2)
print(f"saved: feature_spec.json (47 features, as_of {as_of}, last_known_index={last_known_index:.2f})")

# ----------------------------------------------------------- metadata
def r(d): return {k: round(v, 6) for k, v in d.items() if not k.startswith("_")}
metadata = {
    "version_name": version,
    "deployed": True,
    "deployed_model": "XGBoost",
    "trained_at": datetime.now().isoformat(timespec="seconds"),
    "selection_rationale": ("Deploying the untuned v2 XGBoost: it is the strongest "
        "MULTIVARIATE model (uses conflict, oil, exchange-rate data) and beats ARIMA on "
        "MAPE (2.22 vs 2.39). ARIMA is the narrow RMSE winner but is univariate and "
        "ignores the project's datasets, so it is kept as the documented baseline."),
    "target_name": "y_log_change",
    "target_definition": "ln(next_month_index) - ln(this_month_index)",
    "reconstruction": "predicted_level = last_known_index * exp(prediction)",
    "rmse": r(results["XGBoost"]["level"])["RMSE"],
    "mape": r(results["XGBoost"]["level"])["MAPE"],
    "r2_score": r(results["XGBoost"]["level"])["R2"],
    "feature_names": FEATURES, "n_features": 47,
    "training_data_range": {"start_date": train_range[0], "end_date": train_range[1]},
    "baseline_model": {"type": "ARIMA(1,1,2)", "file": "model_arima.pkl",
                       "level": r(results["ARIMA"]["level"])},
    "all_model_results": {n: {"level": r(v["level"]), "change": r(v["change"])}
                          for n, v in results.items()},
    "history": {
        "v1_level_based": {
            "LinearRegression": {"RMSE": 10.042, "MAPE": 21.37, "R2": -7.419},
            "ARIMA": {"RMSE": 1.197, "MAPE": 2.39, "R2": 0.880},
            "RandomForest": {"RMSE": 14.292, "MAPE": 32.39, "R2": -16.053},
            "XGBoost": {"RMSE": 33.499, "MAPE": 79.94, "R2": -92.685},
            "LSTM": {"RMSE": 40.141, "MAPE": 96.16, "R2": -133.517},
            "note": "predicted the LEVEL; tree/NN models could not extrapolate the trend"},
        "v2_change_untuned": {
            "note": "predicted log-change; THIS is the deployed XGBoost",
            "XGBoost": {"RMSE": 1.272, "MAPE": 2.22, "R2": 0.865},
            "ARIMA": {"RMSE": 1.197, "MAPE": 2.39, "R2": 0.880}},
        "v2_change_tuned": {
            "note": "Optuna + 6 extra features REGRESSED XGBoost — not deployed",
            "XGBoost": {"RMSE": 1.635, "MAPE": 3.08, "R2": 0.777}},
    },
    "data_caveat": ("conflict (UCDP) and national CPI end 2024; oil ends Jan 2026 — "
                    "these features are forward/zero-filled across 2025-2026; the API "
                    "must forward-fill them at request time (see feature_spec.json)."),
}
with open(MODELS / "model_metadata.json", "w") as fh:
    json.dump(metadata, fh, indent=2)
print("saved: model_metadata.json (deployed = untuned v2 XGBoost)")
print("\\nDONE. model.pkl is now the untuned v2 XGBoost.")
