// Thin client for the FastAPI ml-service (Node 18+ global fetch).
const config = require('../config');

const BASE = config.mlServiceUrl;

async function getForecast(danger = 5, severe = 10) {
  const res = await fetch(`${BASE}/forecast?danger_level=${danger}&severe_level=${severe}`);
  if (!res.ok) throw new Error(`ml-service /forecast ${res.status}`);
  return res.json();
}

async function getModel() {
  const res = await fetch(`${BASE}/model`);
  if (!res.ok) throw new Error(`ml-service /model ${res.status}`);
  return res.json();
}

async function health() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok ? res.json() : { status: 'down' };
  } catch {
    return { status: 'down' };
  }
}

module.exports = { getForecast, getModel, health };
