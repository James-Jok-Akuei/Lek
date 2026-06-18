# Lëk ML service — FastAPI serving the trained ARIMA model.
FROM python:3.12-slim

WORKDIR /app

# Install only the serving deps (fast image; the winning model is ARIMA).
COPY requirements-serve.txt .
RUN pip install --no-cache-dir -r requirements-serve.txt

# App code + model artifacts (models/model.pkl, model_metadata.json, history.csv).
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
