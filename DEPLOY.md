# Deploying Lëk to Render (free tier)

This guide walks you through deploying all four parts of Lëk to **Render** on the
**free plan**, step by step, in order:

1. PostgreSQL database
2. ML service (FastAPI)
3. Backend (Express)
4. Dashboard (static Vite site)

Everything is defined in [`render.yaml`](render.yaml) (a Render *Blueprint*). You
can deploy the whole stack from that file in one go, then fill in the secrets.

> **Repo layout note:** the app lives in the `lek/` subfolder of this repository,
> so every service in `render.yaml` uses `rootDir: lek/...`. Keep `render.yaml`
> at the repository root (where Render looks for it).

---

## Before you start

- A **Render account** (free): https://render.com
- This repository pushed to **GitHub** (Render deploys from GitHub).
- **`psql`** installed locally (the PostgreSQL client) to initialize the database.
  - macOS: `brew install libpq` then add it to PATH, or install Postgres.app.
- **Node.js** installed locally (to run the one-off admin seed script).

---

## Option A — Deploy everything with the Blueprint (recommended)

1. In the Render dashboard click **New → Blueprint**.
2. Connect this GitHub repo. Render reads `render.yaml` and shows four resources:
   `lek-db`, `lek-ml-service`, `lek-backend`, `lek-dashboard`.
3. Render will prompt you for every `sync: false` value (the secrets). You can
   fill them now or leave blanks and set them afterward (see the env-var tables
   below). Some values (the deployed URLs) you won't know until services exist,
   so it's fine to set them after the first deploy and re-deploy.
4. Click **Apply**. Render creates the database and all three services.
5. **Initialize the database** (see [Initialize the database](#initialize-the-database)) —
   the DB starts empty, so the backend and dashboard won't show data until you do.
6. Set the cross-service URLs and re-deploy (see
   [Wire the service URLs](#wire-the-service-urls)).

If you'd rather create each resource by hand, follow Option B.

---

## Option B — Create each service manually (in order)

### 1. PostgreSQL database

- **New → PostgreSQL**, plan **Free**, name `lek-db`, database `lek`, user `lek`.
- After it's created, open it and copy two connection strings from **Connections**:
  - **Internal Database URL** — used by the backend (same-region, no SSL needed).
  - **External Database URL** — used by *you* from your laptop to load the schema.

### 2. ML service

- **New → Web Service**, connect the repo, plan **Free**.
- **Root Directory:** `lek/ml-service`
- **Runtime:** Python
- **Build Command:** `pip install -r requirements-serve.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`
- Env vars: see the [ML service table](#ml-service-env-vars).

### 3. Backend

- **New → Web Service**, connect the repo, plan **Free**.
- **Root Directory:** `lek/backend`
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check Path:** `/api/health`
- Env vars: see the [Backend table](#backend-env-vars).

### 4. Dashboard

- **New → Static Site**, connect the repo, plan **Free**.
- **Root Directory:** `lek/dashboard`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- Add a **Rewrite rule** so SPA routing works: source `/*` → destination
  `/index.html` (the Blueprint sets this automatically).
- Env vars: see the [Dashboard table](#dashboard-env-vars).

---

## Environment variables

Render injects `PORT` automatically into web services — **do not set it**. The
backend and ML service already read it.

### ML service env vars

| Variable | Value | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.12.7` | Matches the version used in development. |
| `ALLOWED_ORIGINS` | *(optional)* your dashboard URL | Only needed if the browser calls the ML service directly. The dashboard talks to the backend, not the ML service, so this can be left unset. |

### Backend env vars

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | from `lek-db` | Auto-wired by the Blueprint. Manually: paste the **Internal Database URL**. |
| `NODE_ENV` | `production` | |
| `SCHEDULER_ENABLED` | `true` | Runs the monthly predict-then-alert cron. |
| `JWT_SECRET` | a long random string | e.g. `openssl rand -base64 32`. |
| `ML_SERVICE_URL` | `https://lek-ml-service.onrender.com` | Your deployed ML service URL (no trailing slash). |
| `ALLOWED_ORIGINS` | `https://lek-dashboard.onrender.com` | Your deployed dashboard URL (CORS). Comma-separate multiple. |
| `AFRICAS_TALKING_USERNAME` | `sandbox` or your AT username | |
| `AFRICAS_TALKING_API_KEY` | your AT API key | Leave blank to run SMS in simulated/log mode. |
| `AFRICAS_TALKING_SHORTCODE` | your AT shortcode | |
| `ADMIN_INITIAL_PASSWORD` | a strong password | Used by the admin seed; this becomes the `admin` login password. |

> The backend connects to the database over Render's **internal** URL, which does
> not require SSL, so you do **not** set `DATABASE_SSL` on the backend service.
> `DATABASE_SSL=true` is only used when *you* seed from your laptop over the
> external URL (see below).

### Dashboard env vars

| Variable | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://lek-backend.onrender.com/api` | Baked in at **build time** — if you change it you must trigger a redeploy. Must end in `/api`. |

---

## Wire the service URLs

The cross-service URLs only exist after the services are first created, so:

1. Once `lek-ml-service`, `lek-backend`, and `lek-dashboard` exist, copy each
   service's `https://...onrender.com` URL from its page.
2. Set on the **backend**: `ML_SERVICE_URL` (the ML URL) and `ALLOWED_ORIGINS`
   (the dashboard URL).
3. Set on the **dashboard**: `VITE_API_URL` = the backend URL + `/api`.
4. **Redeploy** the backend and the dashboard so the new values take effect
   (the dashboard especially — `VITE_API_URL` is baked in at build time).

---

## Initialize the database

Render's database starts **empty**. Run these **from your laptop** using the
database's **External Database URL** (it ends with something like
`.oregon-postgres.render.com/lek`). All commands are run from the repo root.

```bash
# 1. Put the External Database URL in a variable (note the surrounding quotes).
export EXTERNAL_DB_URL="postgresql://lek:...@dpg-xxxx.oregon-postgres.render.com/lek"

# 2. Create the tables (schema).
psql "$EXTERNAL_DB_URL" -f lek/database/schema.sql

# 3. Seed the 10 counties.
psql "$EXTERNAL_DB_URL" -f lek/database/seed.sql

# 4. Seed the admin user (+ demo subscribers and thresholds).
#    DATABASE_SSL=true is required to reach Render's external URL from your machine.
cd lek/backend
DATABASE_URL="$EXTERNAL_DB_URL" DATABASE_SSL=true \
  ADMIN_INITIAL_PASSWORD="choose-a-strong-password" \
  node scripts/seed.js
cd ../..
```

After step 4 you can log in to the dashboard with username `admin` and the
password you chose. (If you omit `ADMIN_INITIAL_PASSWORD`, the script prints a
generated password once — copy it.)

> `psql` negotiates SSL with Render automatically. The Node seed script needs
> `DATABASE_SSL=true` because it connects via `pg` — this flag is read by the
> code and only affects this one external connection; it does not change local
> development.

---

## Keep the backend awake (free-tier cold starts)

Free web services **spin down after ~15 minutes of inactivity** and take ~50s to
wake. To keep the backend warm, set up a free keep-alive ping:

1. Go to https://cron-job.org (free) and create an account.
2. Create a new cron job:
   - **URL:** `https://lek-backend.onrender.com/api/health`
   - **Schedule:** every 10 minutes.
3. Save. The health endpoint is public and lightweight.

> Note: pinging only keeps **one** service warm. The ML service and dashboard
> static site will still cold-start independently. You can add a second cron job
> hitting `https://lek-ml-service.onrender.com/health` if you want the ML service
> kept warm too.

---

## Free Postgres expires after 30 days

Render's **free PostgreSQL database is deleted ~30 days after creation**. When
that happens you must create a new free database and re-initialize it:

1. Create a new **Free** PostgreSQL instance (`lek-db`).
2. Update the backend's `DATABASE_URL` to the new internal URL (if you used the
   Blueprint's auto-wiring it updates automatically; otherwise paste it).
3. Re-run all four steps in [Initialize the database](#initialize-the-database)
   with the new External Database URL.
4. Redeploy the backend.

Keep your `schema.sql`/`seed.sql` and the seed command handy — re-seeding is the
same process every time.

---

## Honest free-tier limitations

- **ML service memory:** the free tier gives **512 MB RAM**. We deliberately
  install `requirements-serve.txt` (xgboost + scikit-learn/statsmodels/pandas,
  **no TensorFlow**) to stay within it, but loading the model plus pandas is
  still tight. If the service is OOM-killed at startup, the only real fix on free
  tier is to slim dependencies further; otherwise upgrade that one service.
- **Cold starts:** ~50s to wake a spun-down service. The first request after idle
  will be slow (and may even time out the dashboard's first call — just retry).
  The keep-alive ping mitigates this for the backend only.
- **Database expiry:** free Postgres is deleted after ~30 days (see above).
- **No Shell / Jobs on free tier:** that's why the database is initialized from
  your laptop rather than via a Render shell or one-off job.
- **Build minutes / bandwidth:** generous but finite on free; heavy redeploys of
  the ML service (large pip install) are the slowest part.

---

## Local development is unchanged

None of the deployment changes affect running Lëk locally. All new env vars
default to localhost values:

- `ALLOWED_ORIGINS` defaults to `http://localhost:5173,http://127.0.0.1:5173`
- `DATABASE_SSL` defaults to `false` (local Postgres has no SSL)
- `VITE_API_URL` defaults to `http://localhost:3000/api`
- `PORT` defaults to `3000` (backend) / `8000` (ML service)

Run locally exactly as before — see the project `README.md` and
`scripts/run-local.sh`.
