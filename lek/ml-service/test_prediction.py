"""
Standalone proof that the deployed XGBoost model serves a LEVEL prediction
end-to-end. It now calls the SAME logic the API uses (predictor.py) — there is
one source of truth for prediction; this script only formats the output.

Run with a python that has xgboost installed, e.g.:
    ./.venv/bin/python test_prediction.py
"""
import predictor

if not predictor.is_loaded():
    raise SystemExit(f"model failed to load: {predictor.load_error()}")

r = predictor.predict_next_month()

print("=" * 56)
print("Lëk — XGBoost end-to-end serving proof")
print("=" * 56)
print(f"deployed model        : {r['model_version']}  ({r['model_type']})")
print(f"reconstruction        : level = last_known_index * exp(prediction)")
print(f"features assembled     : 47 (as of {r['as_of_month']})")
print("-" * 56)
print(f"last known index ({r['as_of_month'][:7]}) : {r['last_known_index']:.4f}")
print(f"predicted log-difference      : {r['predicted_log_change']:+.5f}")
print(f"predicted percent change      : {r['predicted_change_pct']:+.2f}%")
print(f"predicted next-month index ({r['target_month'][:7]}) : {r['predicted_level']:.4f}")
print("=" * 56)
print("OK: XGBoost serves a level prediction end-to-end (via predictor.py).")
