// GET /api/stats — summary tiles for the dashboard Overview.
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

router.get('/', async (_req, res) => {
  const [users, regions, alertsMonth, highRisk] = await Promise.all([
    query("SELECT COUNT(*)::int AS n FROM users WHERE status = 'active'"),
    query('SELECT COUNT(*)::int AS n FROM counties'),
    query(`SELECT COUNT(*)::int AS n FROM alerts
           WHERE delivery_status = 'sent'
             AND date_trunc('month', sent_at) = date_trunc('month', CURRENT_DATE)`),
    // Distinct states whose LATEST prediction is High risk (>15%, matching the
    // Predictions page). DISTINCT ON collapses repeated prediction runs so each
    // state is counted once — otherwise multiple runs inflate the count.
    query(`SELECT COUNT(*)::int AS n FROM (
             SELECT DISTINCT ON (county_id) county_id, predicted_change_pct
             FROM predictions
             ORDER BY county_id, prediction_date DESC, id DESC
           ) t WHERE predicted_change_pct > 15`),
  ]);
  res.json({
    totalUsers: users.rows[0].n,
    regionsTracked: regions.rows[0].n,
    alertsSentThisMonth: alertsMonth.rows[0].n,
    countiesAtHighRisk: highRisk.rows[0].n,
  });
});

module.exports = router;
