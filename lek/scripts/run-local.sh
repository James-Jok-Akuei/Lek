#!/usr/bin/env bash
# Start all three Lëk services locally (no Docker), for development/demo.
#
# Prerequisites (one-time):
#   1. PostgreSQL running, with the `lek` database created and seeded:
#        createdb lek
#        psql -d lek -f database/schema.sql
#        psql -d lek -f database/seed.sql
#   2. ml-service venv:   cd ml-service && python3.12 -m venv .venv && \
#        ./.venv/bin/pip install -r requirements-serve.txt
#   3. backend deps:      cd backend && npm install && node scripts/seed.js
#   4. dashboard deps:    cd dashboard && npm install
#   5. A repo-root .env   (copy from .env.example and adjust DATABASE_URL)
#
# Then from the repo root: ./scripts/run-local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pids=()

cleanup() { echo; echo "stopping…"; for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

echo "→ ml-service  http://localhost:8000  (Swagger at /docs)"
( cd "$ROOT/ml-service" && ./.venv/bin/uvicorn main:app --port 8000 ) &
pids+=($!)

echo "→ backend     http://localhost:3000"
( cd "$ROOT/backend" && node src/server.js ) &
pids+=($!)

echo "→ dashboard   http://localhost:5173"
( cd "$ROOT/dashboard" && npm run dev ) &
pids+=($!)

echo
echo "All services starting. Sign in at http://localhost:5173 with admin / admin123."
echo "Press Ctrl+C to stop all."
wait
