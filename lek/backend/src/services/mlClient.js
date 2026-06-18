// DEPRECATED compatibility shim.
//
// The ml-service no longer exposes /forecast or /model (Phase 3 replaced them with
// /predict, /predict/all, /model/info). To avoid calling dead endpoints, the legacy
// callers (routes/forecast.js, services/alertEngine.js) are reshaped onto the new
// mlService here. New code should use services/mlService.js directly.
const mlService = require('./mlService');

// Old getForecast() shape, rebuilt from POST /predict (national).
async function getForecast() {
  const p = await mlService.predict();
  return {
    model_version: p.model_version,
    current_index: p.last_known_index,
    forecast_index: p.predicted_level,
    predicted_change_pct: p.predicted_change_pct,
    target_month: p.target_month,
  };
}

async function getModel() {
  return mlService.modelInfo();
}

async function health() {
  return mlService.health();
}

module.exports = { getForecast, getModel, health };
