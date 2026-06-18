// Prediction service: pulls forecasts from the ml-service and persists them.
const { query } = require('../db/pool');
const mlService = require('./mlService');

// Upsert the deployed model into model_versions and mark it active. Returns its row.
async function ensureActiveModelVersion() {
  const meta = await mlService.modelInfo();
  await query('UPDATE model_versions SET is_active = false WHERE is_active = true');
  const { rows } = await query(
    `INSERT INTO model_versions (version_name, trained_at, rmse, mape, r2_score, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (version_name)
     DO UPDATE SET rmse = EXCLUDED.rmse, mape = EXCLUDED.mape,
                   r2_score = EXCLUDED.r2_score, is_active = true
     RETURNING id, version_name`,
    [meta.version_name, meta.trained_at || new Date().toISOString(),
     meta.rmse, meta.mape, meta.r2_score]);
  return rows[0];
}

// Call the ml-service /predict/all, store one prediction row per county linked to
// the active model_version, and return what was stored.
async function runPredictions() {
  const all = await mlService.predictAll();
  const mv = await ensureActiveModelVersion();

  const { rows: counties } = await query('SELECT id, name FROM counties');
  const idByName = Object.fromEntries(counties.map((c) => [c.name, c.id]));

  const stored = [];
  for (const c of all.counties) {
    const countyId = idByName[c.county];
    if (!countyId) continue;
    const { rows } = await query(
      `INSERT INTO predictions
         (county_id, model_version_id, predicted_price, predicted_change_pct,
          prediction_date, target_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
       RETURNING id`,
      [countyId, mv.id, c.predicted_level, c.predicted_change_pct, all.target_month]);
    stored.push({
      id: rows[0].id, county: c.county,
      predicted_level: c.predicted_level,
      predicted_change_pct: c.predicted_change_pct,
      derived: c.derived ?? true,
    });
  }

  return {
    model_version: mv.version_name,
    target_month: all.target_month,
    national: all.national,
    predictions_created: stored.length,
    predictions: stored,
  };
}

module.exports = { ensureActiveModelVersion, runPredictions };
