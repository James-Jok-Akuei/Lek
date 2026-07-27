// Alert engine: turns the LATEST stored predictions into SMS warnings.
//
// Prediction generation now lives in services/predictionService.js (Phase 4). This
// engine only ALERTS: it reads the most recent prediction per county, finds the
// high-risk ones, and SMSes that county's active subscribers a short, calm warning.
const { query } = require('../db/pool');
const smsService = require('./smsService');
const i18n = require('../i18n');

const DEFAULT_HIGH_RISK_PCT = 15.0; // used when a county has no threshold row

// Short, simple, calm — "inform, don't frighten" (proposal NFR6/ethics). Written
// in the subscriber's own language, with the state name translated too. Each
// wording is sized for one SMS segment in its own alphabet (160 GSM-7 / 70 UCS-2).
function composeWarning(county, pct, lang = i18n.DEFAULT_LANGUAGE) {
  const localCounty = i18n.countyName(county, lang);
  return i18n.t(lang).warning(localCounty, Math.round(pct));
}

// Run against the latest predictions; SMS at-risk users; return a summary.
async function runAlerts() {
  const { rows: latest } = await query(`
    SELECT DISTINCT ON (p.county_id)
           p.id AS prediction_id, p.county_id, c.name AS county,
           p.predicted_change_pct, t.severe_level
    FROM predictions p
    JOIN counties c ON c.id = p.county_id
    LEFT JOIN thresholds t ON t.county_id = p.county_id
    ORDER BY p.county_id, p.prediction_date DESC, p.id DESC`);

  let highRiskCounties = 0;
  let recipients = 0;
  let smsSent = 0;
  const details = [];

  for (const row of latest) {
    const threshold = row.severe_level != null ? Number(row.severe_level) : DEFAULT_HIGH_RISK_PCT;
    const pct = Number(row.predicted_change_pct);
    if (pct <= threshold) continue; // below high-risk — no alert

    highRiskCounties += 1;
    const { rows: users } = await query(
      `SELECT id, phone_number, language_preference FROM users
       WHERE county_id = $1 AND status = 'active'`,
      [row.county_id]);
    recipients += users.length;

    // Composed per subscriber, not per county: two people in the same state can
    // have chosen different languages.
    const byLanguage = {};
    for (const u of users) {
      const lang = i18n.normalizeLanguage(u.language_preference);
      const r = await smsService.sendSMS(
        u.phone_number, composeWarning(row.county, pct, lang),
        { userId: u.id, predictionId: row.prediction_id });
      if (r.status === 'sent') smsSent += 1;
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    }
    details.push({
      county: row.county, predicted_change_pct: pct, threshold,
      users: users.length, by_language: byLanguage,
    });
  }

  return {
    default_high_risk_pct: DEFAULT_HIGH_RISK_PCT,
    high_risk_counties: highRiskCounties,
    recipients,
    sms_sent: smsSent,
    sms_mode: smsService.SIMULATED ? 'simulated' : 'live',
    details,
  };
}

module.exports = { runAlerts, composeWarning, DEFAULT_HIGH_RISK_PCT };
