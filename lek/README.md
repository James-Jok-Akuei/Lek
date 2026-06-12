# Lëk — ML-Based Food Price Inflation Early Warning System

**Lëk** is a machine-learning–powered SMS early warning system for **food price
inflation in South Sudan**. It forecasts the national food price index one month
ahead, flags when prices are predicted to cross danger/severe thresholds, and is
designed to dispatch **SMS alerts** to subscribed users — giving households and
responders advance warning ahead of the lean season.

- **GitHub repo:** https://github.com/James-Jok-Akuei/Lek
- **Video demo:** https://drive.google.com/file/d/12tOk4mmeJHFqzlhUjRvAtra47GnlTsFj/view?usp=sharing
- **Status:** Initial product / MVP. The ML model and the admin dashboard are
  built and runnable today; the live API and SMS dispatch are scaffolded and
  scheduled for the final-product phase (see [Roadmap](#roadmap)).

---

## What works in this initial version

| Component | Status | What you can demo |
|---|---|---|
| **ML training notebook** (`training/train_model.ipynb`) | ✅ Runs end-to-end | Data engineering of 7 sources, data visualizations, 5 trained models, comparison, model selection, saved `model.pkl` |
| **Admin dashboard** (`dashboard/`) | ✅ Runs (React + Vite) | Login → Overview → Predictions / Users / Alerts, with the real trained-model metrics surfaced in the UI |
| **Database** (`database/`) | ✅ Schema + seed | 7-table PostgreSQL schema, 10 South Sudan states seeded |
| **ML API service** (`ml-service/`) | 🚧 Scaffolded | FastAPI service to serve `model.pkl` (planned for final phase) |
| **Backend + SMS** (`backend/`) | 🚧 Scaffolded | Express API + Africa's Talking SMS (planned for final phase) |

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

### 1. Clone
```bash
git clone https://github.com/James-Jok-Akuei/Lek.git
cd Lek/lek
```

### 2. Database
```bash
createdb lek
psql -d lek -f database/schema.sql
psql -d lek -f database/seed.sql
psql -d lek -c "\dt"          # verify 7 tables
```

### 3. Environment variables
```bash
cp .env.example .env          # then fill in values
```

### 4. ML training notebook
```bash
cd training
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r ../ml-service/requirements.txt jupyter matplotlib seaborn
jupyter notebook train_model.ipynb     # Run All to reproduce the model
```
> Note: the raw datasets live in `training/data/raw/` (the UCDP file is large and
> is excluded from git). The notebook regenerates `model.pkl` and the processed
> master table when run.

### 5. Admin dashboard (the main MVP to demo)
```bash
cd dashboard
npm install
npm run dev                    # opens http://localhost:5173
```
Open the URL, log in on the Login screen, and explore Overview → Predictions →
Users → Alerts. (The dashboard currently renders representative data; wiring it to
the live API is part of the final phase.)

### 6. ML API service (scaffolded)
```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload      # Swagger UI at http://localhost:8000/docs
```

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

Planned for the **final-product** phase:

1. Implement the FastAPI `ml-service` to serve `model.pkl` (live Swagger UI).
2. Implement the Express `backend`: user registration, threshold checks, and SMS
   dispatch via Africa's Talking.
3. Wire the dashboard to the live API (replace representative data).
4. Improve the model by forecasting month-over-month change (helps the tree/NN
   models extrapolate) and add per-county forecasting.
5. Deploy all services per `docs/DEPLOYMENT.md`.

---

## Repository layout

```
lek/
├── README.md
├── database/            schema.sql, seed.sql (7 tables, 10 states)
├── training/            train_model.ipynb, data/ (raw + processed)
├── ml-service/          FastAPI service + models/ (model.pkl, metadata)
├── backend/             Express API (scaffold)
├── dashboard/           React + Vite admin dashboard
└── docs/                DEPLOYMENT.md, screenshots/
```
