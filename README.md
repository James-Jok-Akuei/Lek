# Lëk

Lëk is a machine-learning early warning system that predicts food price inflation in South Sudan and delivers warnings over SMS and USSD to citizens on basic phones, with an admin dashboard for monitoring.

## Live links

- Dashboard: https://lek-dashboard.onrender.com
- Backend API: https://lek-backend.onrender.com
- ML service API docs: https://lek-ml-service.onrender.com/docs
- Demo video: (link to be added)

All services run on Render's free tier. A service that has been idle spins down, so the first request after a period of inactivity can take up to about 50 seconds to respond while it wakes up. Subsequent requests are fast.

## Features

- National food price inflation forecasting using an XGBoost model that predicts the next month's change in the national food price index.
- SMS warnings sent through Africa's Talking. When no API key is configured the service runs in a simulated mode that logs messages instead of sending them, so the pipeline works end to end without credentials.
- USSD menu (Africa's Talking sandbox code `*384*9509#`) that lets a citizen on a basic phone register for alerts, check the risk for their county, and unsubscribe.
- Admin dashboard for viewing predictions, managing users, and reviewing alerts, including a function to send a test alert SMS to a chosen number.
- Role-based access control with a single superadmin account that manages the other admin accounts. New accounts are always created with the `admin` role; the superadmin cannot be created, promoted to, or deleted through the API.

## Tech stack

| Layer | Technology |
|---|---|
| ML service | Python, FastAPI, XGBoost |
| Backend | Node.js, Express, PostgreSQL |
| Dashboard | React, Vite, Tailwind |
| Messaging | Africa's Talking (SMS and USSD) |
| Deployment | Render (render.yaml blueprint) |

## Architecture

```
                  ┌─────────────────────┐
                  │   Africa's Talking  │
                  │     SMS / USSD      │
                  └──────────┬──────────┘
                             │  (SMS out, USSD callbacks in)
                             ▼
  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
  │   Dashboard   │───▶│    Backend    │───▶│  ML service   │
  │ React + Vite  │    │ Express + API │    │ FastAPI + XGB │
  └───────────────┘    └───────┬───────┘    └───────────────┘
                               │
                               ▼
                        ┌───────────────┐
                        │  PostgreSQL   │
                        └───────────────┘
```

The dashboard is a thin client: it only ever talks to the backend API and holds no business logic of its own. The backend is the hub. It calls the ML service for forecasts, reads and writes application state in PostgreSQL, and exchanges messages with Africa's Talking, sending outbound SMS alerts and handling inbound USSD session callbacks. Forecasts from the model are national; the per-county figures shown in the dashboard and over USSD are derived from the national prediction.

## Running locally

The application lives in the `lek/` subfolder of this repository. The commands below assume you have changed into that folder after cloning.

### Prerequisites

- Node.js (18 or newer)
- Python 3.12
- PostgreSQL (14 or newer)

### 1. Clone and enter the app folder

```bash
git clone https://github.com/James-Jok-Akuei/Lek.git
cd Lek/lek
```

### 2. Database

Create the database and load the schema and seed data (the 10 South Sudan states):

```bash
createdb lek
psql -d lek -f database/schema.sql
psql -d lek -f database/seed.sql
```

### 3. ML service (port 8000)

```bash
cd ml-service
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements-serve.txt
./.venv/bin/uvicorn main:app --port 8000
```

The interactive API docs are then at http://localhost:8000/docs.

### 4. Backend (port 3000)

From the `lek/` folder:

```bash
cd backend
npm install
cp ../.env.example ../.env     # then edit ../.env (see below)
node scripts/seed.js           # creates the superadmin (username: admin) and demo data
npm run dev
```

Before running the seed script, set `ADMIN_INITIAL_PASSWORD` in `../.env` to the password you want for the admin account, for example:

```
ADMIN_INITIAL_PASSWORD=admin123
```

The seed script then creates the superadmin with username `admin` and that password, so you would sign in with `admin` / `admin123`. If you leave `ADMIN_INITIAL_PASSWORD` blank, the script instead generates a strong random password and prints it to the console once.

### 5. Dashboard (port 5173)

From the `lek/` folder:

```bash
cd dashboard
npm install
npm run dev
```

### 6. Open it

Open http://localhost:5173 and sign in with `admin` and the password you set above. From there you can view the Overview, Predictions, Users, and Alerts pages, and (as the superadmin) manage other admins.

### Run everything at once

Once the prerequisites above have been done once, you can start all three services together from the `lek/` folder:

```bash
./scripts/run-local.sh
```

## Deployment

The system is deployed on Render using the `render.yaml` blueprint at the root of this repository. The blueprint defines four resources, all on the free tier: a PostgreSQL database, the ML service, the backend, and the dashboard (a static site). Because Render's free web services spin down when idle, a scheduled ping from cron-job.org hits the backend health endpoint to keep it warm.

Full step-by-step instructions, including database initialization, environment variables, wiring the cross-service URLs, the keep-alive setup, and the free-tier limitations, are in [DEPLOY.md](DEPLOY.md).

## Testing

Screenshots of the tested flows live in `lek/docs/screenshots/`.

### USSD flow (simulator)

Registering for alerts, checking county risk, and unsubscribing through the Africa's Talking USSD simulator using the sandbox code `*384*9509#`.

![USSD flow in the Africa's Talking simulator](lek/docs/screenshots/ussd-test.png)

### SMS and test alert

A test alert sent from the dashboard Alerts page (or `POST /api/alerts/test`) and arriving in the Africa's Talking simulator inbox.

![Test alert SMS in the Africa's Talking simulator inbox](lek/docs/screenshots/sms-test.png)

![Dashboard Alerts page with the alert log](lek/docs/screenshots/alerts.png)

### Prediction

The dashboard Predictions view showing the national forecast and per-county figures.

![Dashboard Predictions view](lek/docs/screenshots/predictions.png)

The ML service Swagger UI, used to call the model directly with different inputs.

![ML service Swagger API docs](lek/docs/screenshots/swagger-api.png)

### Dashboard and RBAC

The login screen.

![Dashboard login screen](lek/docs/screenshots/login.png)

The Overview page.

![Dashboard Overview page](lek/docs/screenshots/overview.png)

The Users page.

![Dashboard Users page](lek/docs/screenshots/users.png)

The Manage Admins page, available only to the superadmin (role-based access control).

![Manage Admins page showing role-based access control](lek/docs/screenshots/admins-rbac.png)

### Desktop, mobile, and deployed

The dashboard at a desktop browser width.

![Dashboard at desktop width](lek/docs/screenshots/dashboard-desktop.png)

The dashboard at a mobile browser width.

![Dashboard at mobile width](lek/docs/screenshots/dashboard-mobile.png)

The dashboard running against the services deployed on Render.

![Dashboard running against the deployed Render services](lek/docs/screenshots/dashboard-deployed.png)

### Deployment keep-alive

The cron-job.org schedule that pings the backend health endpoint to keep the free-tier service awake.

![cron-job.org keep-alive jobs](lek/docs/screenshots/cron-keepalive.png)

## Project structure

```
lek/
├── ml-service/        FastAPI service serving the XGBoost model
│   ├── main.py            API endpoints (/predict, /predict/all, /model/info, /health)
│   ├── predictor.py       model loading and prediction logic
│   ├── models/            model.pkl, metadata, and feature spec
│   └── requirements-serve.txt
├── backend/           Express API (auth, predictions, alerts, USSD, admin)
│   ├── src/
│   │   ├── routes/        HTTP routes (auth, predictions, alerts, ussd, admins, ...)
│   │   ├── services/      alert engine, SMS, ML client, scheduler
│   │   ├── middleware/     JWT auth and superadmin gate
│   │   └── server.js
│   └── scripts/seed.js    seeds the superadmin and demo data
├── dashboard/         React + Vite + Tailwind admin dashboard
│   └── src/
│       ├── pages/         Login, Overview, Predictions, Users, Alerts, Admins
│       └── components/
├── database/          PostgreSQL schema and seed data
│   ├── schema.sql
│   └── seed.sql
├── scripts/run-local.sh   starts all three services locally
└── docker-compose.yml
```
