// Client for the FastAPI ml-service (Phase 3 endpoints). Wraps each call with a
// timeout and clear error handling. Node 18+ global fetch + AbortController.
const config = require('../config');

const BASE = config.mlServiceUrl;
const TIMEOUT_MS = 8000;

async function call(path, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      ...opts,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ml-service ${path} -> ${res.status} ${body}`.trim());
    }
    return res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`ml-service ${path} timed out after ${TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// GET /health — never throws; returns {status:'down'} if unreachable.
async function health() {
  try {
    return await call('/health');
  } catch {
    return { status: 'down' };
  }
}

// POST /predict {county?} — national forecast, or a (derived) county forecast.
async function predict(county) {
  return call('/predict', { method: 'POST', body: JSON.stringify(county ? { county } : {}) });
}

// GET /predict/all — forecast for all 10 states.
async function predictAll() {
  return call('/predict/all');
}

// GET /model/info — deployed-model metadata.
async function modelInfo() {
  return call('/model/info');
}

module.exports = { health, predict, predictAll, modelInfo };
