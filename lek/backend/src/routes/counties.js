// GET /api/counties — counties with their latest prediction + derived risk level.
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

function risk(change) {
  if (change >= 10) return 'high';
  if (change >= 5) return 'medium';
  return 'low';
}

function monthLabel(date) {
  if (!date) return null;
  return new Date(date).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT c.id, c.name, c.region,
           p.predicted_price        AS current_index,
           p.predicted_change_pct   AS predicted_change,
           p.target_date
    FROM counties c
    LEFT JOIN LATERAL (
      SELECT predicted_price, predicted_change_pct, target_date
      FROM predictions WHERE county_id = c.id
      ORDER BY prediction_date DESC, id DESC LIMIT 1
    ) p ON true
    ORDER BY c.id`);

  res.json(rows.map((r) => {
    const change = Number(r.predicted_change ?? 0);
    return {
      id: r.id,
      name: r.name,
      region: r.region,
      currentIndex: Number(r.current_index ?? 0),
      predictedChange: change,
      targetMonth: monthLabel(r.target_date),
      riskLevel: risk(change),
    };
  }));
});

module.exports = router;
