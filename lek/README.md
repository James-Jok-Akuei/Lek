# Lëk — ML-Based Food Price Inflation Early Warning System

**Lëk** is a machine-learning–powered SMS early warning system for **food price
inflation in South Sudan**. It forecasts the national food price index one month
ahead, flags when prices are predicted to cross danger/severe thresholds, and is
designed to dispatch **SMS alerts** to subscribed users — giving households and
responders advance warning ahead of the lean season.

- **GitHub repo:** https://github.com/James-Jok-Akuei/Lek
- **Video demo:** https://drive.google.com/file/d/12tOk4mmeJHFqzlhUjRvAtra47GnlTsFj/view?usp=sharing
- **Status:** Working end-to-end MVP. The full stack runs locally — the ML model
  is served by an API, the backend turns forecasts into per-county predictions and
  SMS alerts, and the dashboard reads it all live. SMS runs in simulated mode until
  Africa's Talking credentials are supplied (see [Roadmap](#roadmap)).

---

## What works today

| Component | Status | What you can demo |
|---|---|---|
| **ML training notebook** (`training/train_model.ipynb`) | ✅ Runs end-to-end | Data engineering of 7 sources, data visualizations, 5 trained models, comparison, model selection, saved `model.pkl` |
| **ML API service** (`ml-service/`) | ✅ Live FastAPI | Serves the ARIMA model; `/forecast`, `/predict`, `/model`, interactive Swagger UI at `/docs` |
| **Backend API** (`backend/`) | ✅ Live Express | JWT admin auth, per-county predictions, threshold checks, alert engine; `/api/*` |
| **SMS dispatch** (Africa's Talking) | ✅ Simulated mode | Alert engine sends SMS (logged when no API key is set); plug in a key to go live |
| **Admin dashboard** (`dashboard/`) | ✅ Live data | Login → Overview → Predictions / Users / Alerts, all reading the backend API; register subscribers, run an alert check |
| **Database** (`database/`) | ✅ Schema + seed | 7-table PostgreSQL schema, 10 South Sudan states seeded |

---

## Architecture

The system is a **monorepo of four services** backed by PostgreSQL:

```
                         ┌─────────────────────┐
  Raw data (7 sources)   │  training/           │   model.pkl +
  World Bank, EIA,  ───▶ │  train_model.ipynb   │ ─────────────┐
  UCDP, manual CSVs      │  (5 models compared) │   metadata   │
                         └─────────────────────┘              ▼
                                                   ┌──────────────────────┐
   ┌───────────────┐      REST/JSON                │  ml-service/ FastAPI │
   │ dashboard/    │ ◀──────────────────────────▶  │  serves predictions  │
   │ React + Vite  │                               └──────────┬───────────┘
   └───────────────┘                                          │
          ▲                                                   ▼
          │           ┌────────────────────┐       ┌──────────────────────┐
          └─────────▶ │ backend/ Express   │ ────▶ │ Africa's Talking SMS  │
                      │ users, alerts, auth│       │  → subscribers        │
                      └─────────┬──────────┘       └──────────────────────┘
                                ▼
                        ┌───────────────┐
                        │ PostgreSQL    │  counties, users, predictions,
                        │ (database/)   │  alerts, thresholds, model_versions
                        └───────────────┘
```

| Service | Stack | Purpose |
|---------|-------|---------|
| `training/` | Jupyter, scikit-learn, statsmodels, XGBoost, TensorFlow | Train & evaluate the forecasting model |
| `ml-service/` | Python + FastAPI | Serve price predictions from `model.pkl` (Swagger UI at `/docs`) |
| `backend/` | Node.js + Express | User registration, alert dispatch (SMS), admin endpoints |
| `dashboard/` | React + Vite + Tailwind | Admin dashboard for predictions, alerts, users, thresholds |
| `database/` | PostgreSQL | 7-table relational schema |

---

## The ML model (notebook highlights)

`training/train_model.ipynb` runs end-to-end and covers:

1. **Data engineering** — merges 7 raw sources (World Bank food prices & exchange
   rates, EIA oil output, UCDP conflict events, World Bank CPI, pipeline status,
   seasonal calendar) into one monthly master table (Jan 2007 → May 2026).
2. **Data visualization** — target trajectory, variable distributions, a
   feature–target correlation heatmap, and seasonality boxplots.
3. **Five models** — Linear Regression, ARIMA, Random Forest, XGBoost, and an LSTM.
4. **Honest evaluation** on a time-based hold-out (Jan 2025 → May 2026).

**Result:** **ARIMA** is the selected model — **R² = 0.88, MAPE = 2.4%, RMSE = 1.20**.
The notebook reports honestly that the tree/neural models underperform here because
the food price index trends strongly upward and **100% of the test window lies above
the training range** — tree models cannot extrapolate beyond it, while ARIMA's
differencing captures the trend. (Fix path: model month-over-month change instead of
the level — planned for the final phase.)

The trained model and its metadata are saved to:
- `ml-service/models/model.pkl`
- `ml-service/models/model_metadata.json`

---

## Setup and running locally

**Prerequisites:** PostgreSQL 14+, Node.js 18+, Python 3.12.

### Quickest path — Docker

```bash
git clone https://github.com/James-Jok-Akuei/Lek.git
cd Lek/lek
docker compose up --build
```
Then open **http://localhost:8080** and sign in with **admin / admin123**.
(ML service Swagger: http://localhost:8000/docs.) Compose brings up Postgres
(schema + counties), the ML service, the backend (which seeds the admin user,
subscribers, and thresholds on start), and the dashboard.

### Manual path

**1. Clone & database**
```bash
git clone https://github.com/James-Jok-Akuei/Lek.git && cd Lek/lek
createdb lek
psql -d lek -f database/schema.sql
psql -d lek -f database/seed.sql
cp .env.example .env          # adjust DATABASE_URL for your Postgres
```

**2. ML service** (port 8000)
```bash
cd ml-service
python3.12 -m venv .venv && ./.venv/bin/pip install -r requirements-serve.txt
./.venv/bin/uvicorn main:app --port 8000     # Swagger UI at /docs
```

**3. Backend** (port 3000)
```bash
cd backend
npm install
node scripts/seed.js          # admin user (admin/admin123), subscribers, thresholds
node src/server.js
```

**4. Dashboard** (port 5173)
```bash
cd dashboard
npm install
npm run dev
```
Open http://localhost:5173, sign in with **admin / admin123**, and explore
Overview → Predictions → Users → Alerts. Use **Run alert check** on the Alerts
page to generate fresh predictions and (simulated) SMS alerts.

> Shortcut: with the prerequisites done once, `./scripts/run-local.sh` starts all
> three services together.

**To reproduce the model:** open `training/train_model.ipynb` (its venv installs
the full stack incl. TensorFlow). The raw datasets live in `training/data/raw/`
(the large UCDP file is excluded from git). Running the notebook regenerates
`ml-service/models/model.pkl` and the processed master table.

**To enable real SMS:** set `AFRICAS_TALKING_API_KEY` (and shortcode) in `.env`;
otherwise alerts are logged in simulated mode.

---

## Designs

See [`docs/`](docs/) and the screenshots below.

- **Dashboard screenshots:** `docs/screenshots/` _(add your captured PNGs here)_
- **Figma mockups:** _<add link if you create them>_

| Screen | File |
|---|---|
| Login | `docs/screenshots/login.png` |
| Overview | `docs/screenshots/overview.png` |
| Predictions | `docs/screenshots/predictions.png` |
| Users | `docs/screenshots/users.png` |
| Alerts | `docs/screenshots/alerts.png` |

---

## Deployment plan

The full deployment plan is in **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** —
covering hosting for each service, the database, the model artifact, the SMS
gateway, environment configuration, and CI/CD.

---

## Roadmap

Done in this build:

- ✅ FastAPI `ml-service` serving the model with live Swagger UI.
- ✅ Express `backend`: JWT auth, per-county predictions, threshold checks, alert
  engine, and SMS dispatch (simulated until a key is supplied).
- ✅ Dashboard wired to the live API (no more mock data).

Planned for the **final-product** phase:

1. Improve the model by forecasting month-over-month change (helps the tree/NN
   models extrapolate) and add genuine per-county forecasting.
2. Supply live Africa's Talking credentials and schedule the monthly alert run.
3. Deploy all services to the cloud per `docs/DEPLOYMENT.md` (Dockerfiles and
   `docker-compose.yml` are included).

---

## Repository layout

```
lek/
├── README.md
├── docker-compose.yml   full-stack one-command bring-up
├── database/            schema.sql, seed.sql (7 tables, 10 states)
├── training/            train_model.ipynb, data/ (raw + processed)
├── ml-service/          FastAPI service + models/ (model.pkl, metadata, history)
├── backend/             Express API (auth, predictions, alerts, SMS engine)
├── dashboard/           React + Vite admin dashboard (live API)
├── scripts/             run-local.sh
└── docs/                DEPLOYMENT.md, screenshots/
```
