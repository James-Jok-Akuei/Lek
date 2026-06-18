// GET /api/dashboard/summary — overview stats for the dashboard.
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

const HIGH_RISK_PCT = 15; // a county is "high risk" if predicted_change_pct > 15

router.get('/summary', async (_req, res) => {
  const [users, predsMonth, alertsMonth, highRisk] = await Promise.all([
    query("SELECT COUNT(*)::int AS n FROM users WHERE status = 'active'"),
    query(`SELECT COUNT(*)::int AS n FROM predictions
           WHERE date_trunc('month', prediction_date) = date_trunc('month', CURRENT_DATE)`),
    query(`SELECT COUNT(*)::int AS n FROM alerts
           WHERE delivery_status = 'sent'
             AND date_trunc('month', sent_at) = date_trunc('month', CURRENT_DATE)`),
    query(`SELECT COUNT(*)::int AS n FROM (
             SELECT DISTINCT ON (county_id) county_id, predicted_change_pct
             FROM predictions
             ORDER BY county_id, prediction_date DESC, id DESC
           ) latest WHERE predicted_change_pct > $1`, [HIGH_RISK_PCT]),
  ]);
  res.json({
    totalUsers: users.rows[0].n,
    predictionsThisMonth: predsMonth.rows[0].n,
    alertsSentThisMonth: alertsMonth.rows[0].n,
    highRiskCounties: highRisk.rows[0].n,
  });
});

module.exports = router;
