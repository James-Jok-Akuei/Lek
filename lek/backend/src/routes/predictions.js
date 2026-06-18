// POST /api/predictions/run    — (protected) pull /predict/all from ML, store rows
// GET  /api/predictions        — most recent prediction run, joined with county names
// GET  /api/predictions/latest — the most recent prediction per county
const express = require('express');
const { query } = require('../db/pool');
const predictionService = require('../services/predictionService');

const router = express.Router();

function shape(r) {
  return {
    id: r.id,
    county: r.county,
    predictedIndex: Number(r.predicted_price),
    predictedChange: Number(r.predicted_change_pct),
    predictionDate: r.prediction_date,
    targetDate: r.target_date,
    modelVersion: r.model_version,
  };
}

router.post('/run', async (_req, res) => {
  try {
    res.json(await predictionService.runPredictions());
  } catch (err) {
    res.status(502).json({ error: 'prediction run failed', detail: err.message });
  }
});

router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT p.id, c.name AS county, p.predicted_price, p.predicted_change_pct,
           p.prediction_date, p.target_date, mv.version_name AS model_version
    FROM predictions p
    JOIN counties c ON c.id = p.county_id
    LEFT JOIN model_versions mv ON mv.id = p.model_version_id
    WHERE p.prediction_date = (SELECT MAX(prediction_date) FROM predictions)
    ORDER BY p.predicted_change_pct DESC`);
  res.json(rows.map(shape));
});

router.get('/latest', async (_req, res) => {
  const { rows } = await query(`
    SELECT DISTINCT ON (p.county_id)
           p.id, c.name AS county, p.predicted_price, p.predicted_change_pct,
           p.prediction_date, p.target_date, mv.version_name AS model_version
    FROM predictions p
    JOIN counties c ON c.id = p.county_id
    LEFT JOIN model_versions mv ON mv.id = p.model_version_id
    ORDER BY p.county_id, p.prediction_date DESC, p.id DESC`);
  res.json(rows.map(shape));
});

module.exports = router;
