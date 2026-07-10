"""API tests for the FastAPI service (main.py) using FastAPI's TestClient —
no server or network needed; requests go straight to the app in-process."""
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


class TestHealth:
    def test_health_ok(self):
        res = client.get("/health")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert body["model_loaded"] is True
        assert body["model_type"] == "xgboost"
        assert body["model_version"]

    def test_root_reports_service(self):
        res = client.get("/")
        assert res.status_code == 200
        body = res.json()
        assert body["service"] == "lek-ml-service"
        assert body["model_loaded"] is True


class TestPredict:
    def test_national_forecast(self):
        res = client.post("/predict", json={})
        assert res.status_code == 200
        body = res.json()
        assert body["scope"] == "national"
        assert body["derived"] is False
        assert body["predicted_level"] > 0
        assert isinstance(body["predicted_change_pct"], float)

    def test_county_forecast_is_flagged_derived(self):
        res = client.post("/predict", json={"county": "Unity"})
        assert res.status_code == 200
        body = res.json()
        assert body["scope"] == "county"
        assert body["county"] == "Unity"
        assert body["derived"] is True

    def test_invalid_payload_is_rejected(self):
        # county must be a string — a nested object must fail validation (422).
        res = client.post("/predict", json={"county": {"bad": "type"}})
        assert res.status_code == 422

    def test_malformed_json_is_rejected(self):
        res = client.post("/predict", content=b"not json at all",
                          headers={"Content-Type": "application/json"})
        assert res.status_code == 422


class TestPredictAll:
    def test_returns_all_ten_states(self):
        res = client.get("/predict/all")
        assert res.status_code == 200
        body = res.json()
        assert len(body["counties"]) == 10
        assert "national" in body
        assert "note" in body  # derived-estimates caveat is part of the contract


class TestModelInfo:
    def test_metadata_served(self):
        res = client.get("/model/info")
        assert res.status_code == 200
        assert isinstance(res.json(), dict)
