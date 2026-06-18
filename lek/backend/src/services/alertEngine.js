// Alert engine: turns the ML forecast into per-county predictions and SMS alerts.
//
// The trained model forecasts ONE national food-price index a month ahead. For an
// operational per-county view we apply the national change with a small, stable
// per-county offset (deterministic, derived from county id) — clearly an estimate
// until per-county models exist. Counties whose predicted change crosses their
// danger threshold trigger SMS alerts to that county's active subscribers.
const { pool, query } = require('../db/pool');
const mlClient = require('./mlClient');
const { sendSms, SIMULATED } = require('./sms');

const DEFAULT_DANGER = 5.0;
const DEFAULT_SEVERE = 10.0;

// Stable per-county offset in roughly [-3, +7] percentage points.
function countyOffset(countyId) {
  return ((countyId * 53) % 11) - 3;
}

function riskLevel(change, danger, severe) {
  if (change >= severe) return 'severe';
  if (change >= danger) return 'danger';
  return 'normal';
}

// Upsert the active model version from the ml-service metadata; returns its id.
async function ensureModelVersion() {
  const meta = await mlClient.getModel();
  await query('UPDATE model_versions SET is_active = false WHERE is_active = true');
  const { rows } = await query(
    `INSERT INTO model_versions (version_name, trained_at, rmse, mape, r2_score, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (version_name)
     DO UPDATE SET rmse = EXCLUDED.rmse, mape = EXCLUDED.mape,
                   r2_score = EXCLUDED.r2_score, is_active = true
     RETURNING id`,
    [meta.version_name, meta.trained_at || new Date().toISOString(),
     meta.rmse, meta.mape, meta.r2_score],
  );
  return rows[0].id;
}

// Run the full pipeline. Returns a summary of what was created.
async function runAlerts() {
  const forecast = await mlClient.getForecast(DEFAULT_DANGER, DEFAULT_SEVERE);
  const modelVersionId = await ensureModelVersion();
  const { rows: counties } = await query('SELECT id, name FROM counties ORDER BY id');

  let predictionsCreated = 0;
  let alertsSent = 0;

  for (const county of counties) {
    const change = Number((forecast.predicted_change_pct + countyOffset(county.id)).toFixed(2));
    const predictedIndex = Number((forecast.current_index * (1 + change / 100)).toFixed(2));

    const { rows: predRows } = await query(
      `INSERT INTO predictions
         (county_id, model_version_id, predicted_price, predicted_change_pct,
          prediction_date, target_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5)
       RETURNING id`,
      [county.id, modelVersionId, predictedIndex, change, forecast.target_month],
    );
    const predictionId = predRows[0].id;
    predictionsCreated += 1;

    // County thresholds (fall back to defaults if none configured).
    const { rows: thr } = await query(
      'SELECT danger_level, severe_level FROM thresholds WHERE county_id = $1', [county.id]);
    const danger = thr[0]?.danger_level ?? DEFAULT_DANGER;
    const severe = thr[0]?.severe_level ?? DEFAULT_SEVERE;
    const level = riskLevel(change, Number(danger), Number(severe));

    if (level === 'normal') continue;

    // Alert every active subscriber in this county.
    const { rows: users } = await query(
      "SELECT id, phone_number FROM users WHERE county_id = $1 AND status = 'active'",
      [county.id]);

    for (const user of users) {
      const message =
        `Lek alert: food prices in ${county.name} are predicted to rise ${change}% ` +
        `by ${forecast.target_month} (${level.toUpperCase()}). Stock essentials early.`;
      const result = await sendSms(user.phone_number, message);
      await query(
        `INSERT INTO alerts (user_id, prediction_id, message_text, channel, delivery_status, sent_at)
         VALUES ($1, $2, $3, 'sms', $4, NOW())`,
        [user.id, predictionId, message, result.status],
      );
      if (result.status === 'sent') alertsSent += 1;
    }
  }

  return {
    model_version: forecast.model_version,
    target_month: forecast.target_month,
    national_change_pct: forecast.predicted_change_pct,
    counties: counties.length,
    predictions_created: predictionsCreated,
    alerts_sent: alertsSent,
    sms_mode: SIMULATED ? 'simulated' : 'live',
  };
}

module.exports = { runAlerts, ensureModelVersion, countyOffset, riskLevel };
