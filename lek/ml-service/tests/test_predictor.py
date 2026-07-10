"""Unit tests for predictor.py — model loading and prediction outputs.

These run against the real deployed model artifact (models/model.pkl), so they
also guard against a broken/missing artifact or a feature-spec mismatch.
"""
import math

import pytest

import predictor


def test_model_loads():
    assert predictor.is_loaded(), f"model failed to load: {predictor.load_error()}"
    assert predictor.load_error() is None


def test_model_identity():
    assert predictor.model_type() == "XGBoost"
    assert predictor.model_version()  # non-empty version string


def test_metadata_available():
    md = predictor.metadata()
    assert isinstance(md, dict) and md, "model_metadata.json should load non-empty"


class TestPredictNextMonth:
    def test_returns_all_expected_fields(self):
        r = predictor.predict_next_month()
        for key in ("model_version", "model_type", "as_of_month", "target_month",
                    "last_known_index", "predicted_log_change",
                    "predicted_change_pct", "predicted_level"):
            assert key in r, f"missing field: {key}"

    def test_prediction_values_are_sane(self):
        r = predictor.predict_next_month()
        # A price index must be positive; a one-month change beyond +/-80% would
        # mean the model or feature assembly is broken.
        assert r["last_known_index"] > 0
        assert r["predicted_level"] > 0
        assert -80.0 < r["predicted_change_pct"] < 80.0
        assert math.isfinite(r["predicted_log_change"])

    def test_level_is_reconstructed_from_log_change(self):
        # predicted_log_change is rounded to 5 dp in the response, so reconstruct
        # with a matching tolerance rather than exact equality.
        r = predictor.predict_next_month()
        expected = r["last_known_index"] * math.exp(r["predicted_log_change"])
        assert r["predicted_level"] == pytest.approx(expected, rel=1e-4)

    def test_target_month_is_month_after_as_of(self):
        r = predictor.predict_next_month()
        assert r["target_month"] > r["as_of_month"]  # ISO dates compare correctly
        assert r["target_month"].endswith("-01")     # first of the month


class TestPredictForCounty:
    def test_national_when_no_county_given(self):
        r = predictor.predict_for_county(None)
        assert r["scope"] == "national"
        assert r["derived"] is False

    def test_county_result_is_flagged_derived(self):
        r = predictor.predict_for_county("Jonglei")
        assert r["scope"] == "county"
        assert r["county"] == "Jonglei"
        assert r["derived"] is True
        assert "note" in r  # honesty note: national model applied to county


class TestPredictAllCounties:
    def test_covers_all_ten_states(self):
        r = predictor.predict_all_counties()
        names = [c["county"] for c in r["counties"]]
        assert names == predictor.SOUTH_SUDAN_STATES
        assert len(names) == 10

    def test_county_figures_match_national(self):
        r = predictor.predict_all_counties()
        for c in r["counties"]:
            assert c["predicted_change_pct"] == r["national"]["predicted_change_pct"]
            assert c["derived"] is True
