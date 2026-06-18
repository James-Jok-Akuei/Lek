// GET /api/predictions — most recent prediction run, joined with county names.
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT p.id, c.name AS county, p.predicted_price, p.predicted_change_pct,
           p.prediction_date, p.target_date, mv.version_name AS model_version
    FROM predictions p
    JOIN counties c ON c.id = p.county_id
    LEFT JOIN model_versions mv ON mv.id = p.model_version_id
    WHERE p.prediction_date = (SELECT MAX(prediction_date) FROM predictions)
    ORDER BY p.predicted_change_pct DESC`);

  res.json(rows.map((r) => ({
    id: r.id,
    county: r.county,
    predictedIndex: Number(r.predicted_price),
    predictedChange: Number(r.predicted_change_pct),
    predictionDate: r.prediction_date,
    targetDate: r.target_date,
    modelVersion: r.model_version,
  })));
});

module.exports = router;
