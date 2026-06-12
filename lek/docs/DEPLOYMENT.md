# Lëk — Deployment Plan

This document describes how the four Lëk services are deployed and operated. The
initial submission demonstrates the ML model and the admin dashboard; this plan
covers the target production deployment (final-product phase).

## Overview

| Service | Runtime | Target host | Scaling |
|---|---|---|---|
| `dashboard/` (React + Vite) | Static build | Vercel / Netlify (CDN) | CDN edge |
| `ml-service/` (FastAPI) | Python 3.12 + Uvicorn | Render / Railway / Fly.io (container) | 1–2 instances |
| `backend/` (Express) | Node.js 18 | Render / Railway (container) | 1–2 instances |
| PostgreSQL | Managed Postgres | Supabase / Neon / Render Postgres | managed |
| Model artifact (`model.pkl`) | File | Bundled in ml-service image or object storage (S3) | versioned |
| SMS gateway | Africa's Talking API | SaaS | n/a |

## Architecture in production

```
   Users (web)                         Subscribers (SMS)
       │                                      ▲
       ▼                                      │
  ┌─────────────┐    HTTPS    ┌────────────┐  │  ┌──────────────────┐
  │  Dashboard  │ ─────────▶  │  Backend   │ ─┼─▶│ Africa's Talking │
  │  (CDN)      │             │  (Express) │  │  └──────────────────┘
  └─────────────┘             └─────┬──────┘  │
                                    │         │
                         ┌──────────┴───┐     │
                         │  ml-service  │     │
                         │  (FastAPI)   │     │
                         └──────┬───────┘     │
                                │             │
                          ┌─────▼─────┐       │
                          │ PostgreSQL│◀──────┘
                          └───────────┘
```

## 1. Database (PostgreSQL)

- Provision a managed Postgres instance (Supabase / Neon / Render).
- Apply schema and seed:
  ```bash
  psql "$DATABASE_URL" -f database/schema.sql
  psql "$DATABASE_URL" -f database/seed.sql
  ```
- Store `DATABASE_URL` as a secret in each service's environment.
- Enable automated daily backups (managed provider feature).

## 2. ML service (FastAPI)

- Containerize with a slim Python 3.12 image; `pip install -r requirements.txt`.
- Ship `ml-service/models/model.pkl` + `model_metadata.json` inside the image, or
  pull from object storage at startup (S3 / Supabase Storage) for hot model swaps.
- Run: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Exposes Swagger UI at `/docs` for verification.
- Health check: `GET /health`.

## 3. Backend (Express)

- Containerize with Node 18; `npm ci && npm start`.
- Responsibilities: user registration, threshold evaluation, alert creation, and
  SMS dispatch via Africa's Talking.
- Secrets: `DATABASE_URL`, `ML_SERVICE_URL`, `JWT_SECRET`, Africa's Talking creds.
- A scheduled job (cron / worker) runs monthly after new predictions: it compares
  each county's predicted change against `thresholds`, and dispatches SMS to
  subscribed users in affected counties.

## 4. Dashboard (React + Vite)

- Build static assets: `npm run build` → deploy `dist/` to Vercel/Netlify.
- Configure `VITE_API_URL` to point at the deployed backend.
- Auth via JWT issued by the backend.

## 5. Model retraining & versioning

- Retrain in `training/train_model.ipynb` (or a scheduled job) as new monthly data
  arrives from World Bank / EIA / UCDP.
- Each run writes a new `model_metadata.json` (`version_name`, metrics, training
  range) and records a row in the `model_versions` table; only one version is
  `is_active`.
- Promote a new model by swapping `model.pkl` (object storage) and flipping the
  active flag — no redeploy required if loaded at request time.

## 6. Environment configuration

All secrets come from environment variables (`.env.example` is the template):

```
DATABASE_URL, ML_SERVICE_URL, JWT_SECRET, NODE_ENV, PORT,
AFRICAS_TALKING_USERNAME, AFRICAS_TALKING_API_KEY, AFRICAS_TALKING_SHORTCODE
```

## 7. CI/CD (planned)

- GitHub Actions on push to `main`:
  - Lint + tests for `backend/` and `dashboard/`.
  - Build and push Docker images for `ml-service/` and `backend/`.
  - Deploy hooks to the hosting provider; dashboard auto-deploys via Vercel.

## 8. Monitoring (planned)

- Service uptime + `/health` checks (provider dashboards / UptimeRobot).
- SMS delivery status persisted in the `alerts` table (`delivery_status`).
- Model drift watch: track live prediction error against realized prices monthly.
