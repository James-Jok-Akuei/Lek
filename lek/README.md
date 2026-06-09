# Lëk

**Lëk** is an ML-based SMS early warning system for food price inflation in South Sudan. It forecasts food price changes per county and sends SMS alerts to subscribed users when prices are predicted to cross danger or severe thresholds — giving households and responders advance warning ahead of the lean season.

## Services

The system is a monorepo of four services:

| Service | Stack | Purpose |
|---------|-------|---------|
| `ml-service/` | Python + FastAPI | Serves price predictions from the trained model. |
| `backend/` | Node.js + Express | Core API: user registration, alert dispatch (SMS via Africa's Talking), admin endpoints. |
| `dashboard/` | React + Vite | Admin dashboard for monitoring predictions, alerts, and thresholds. |
| `training/` | Jupyter | Notebooks for training and evaluating the forecasting model. |

A PostgreSQL database (`database/`) backs the system.

## Running locally

Prerequisites: PostgreSQL, Node.js, Python 3.

1. **Database**
   ```bash
   createdb lek
   psql -d lek -f database/schema.sql
   psql -d lek -f database/seed.sql
   ```

2. **Environment** — copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

3. **ML service** (port 8000)
   ```bash
   cd ml-service
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

4. **Backend** (port 3000)
   ```bash
   cd backend
   npm install
   npm start
   ```

5. **Dashboard** (Vite dev server)
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```
