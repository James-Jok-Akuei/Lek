// GET /api/model-versions    — every row in model_versions, oldest first
// GET /api/model-performance — offline evaluation detail proxied from the ml-service
//
// Mounted below app.use('/api', requireAuth), so both require an admin JWT.
const express = require('express');
const { query } = require('../db/pool');
const mlService = require('../services/mlService');

const router = express.Router();

// Postgres DECIMAL arrives as a string; convert to a number, but keep genuine
// NULLs as null so the dashboard can show an empty state instead of a fake 0.
function num(v) {
  return v === null || v === undefined ? null : Number(v);
}

router.get('/model-versions', async (_req, res) => {
  const { rows } = await query(`
    SELECT version_name, trained_at, rmse, mape, r2_score, is_active
    FROM model_versions
    ORDER BY trained_at ASC NULLS LAST, id ASC`);
  res.json(rows.map((r) => ({
    versionName: r.version_name,
    trainedAt: r.trained_at,
    rmse: num(r.rmse),
    mape: num(r.mape),
    r2Score: num(r.r2_score),
    isActive: r.is_active,
  })));
});

router.get('/model-performance', async (_req, res) => {
  try {
    const p = await mlService.modelPerformance();
    // Pass through only what the ML service really has. Missing pieces stay null
    // — the dashboard renders an honest empty state rather than placeholder data.
    res.json({
      versionName: p.version_name ?? null,
      modelType: p.model_type ?? null,
      trainedAt: p.trained_at ?? null,
      trainingDataRange: p.training_data_range ?? null,
      metrics: p.metrics ?? null,
      evaluationNote: p.evaluation_note ?? null,
      featureImportances: Array.isArray(p.feature_importances) && p.feature_importances.length
        ? p.feature_importances.map((f) => ({
            feature: f.feature,
            importance: num(f.importance),
            description: f.description ?? null,
          }))
        : null,
      backtest: p.backtest
        ? {
            versionName: p.backtest.version_name ?? null,
            splitDate: p.backtest.split_date ?? null,
            trainingRange: p.backtest.training_range ?? null,
            unit: p.backtest.unit ?? null,
            nPoints: p.backtest.n_points ?? null,
            period: p.backtest.period ?? null,
            metrics: p.backtest.metrics ?? null,
            series: Array.isArray(p.backtest.series)
              ? p.backtest.series.map((s) => ({
                  targetMonth: s.target_month,
                  actual: num(s.actual),
                  predicted: num(s.predicted),
                }))
              : null,
          }
        : null,
    });
  } catch (err) {
    res.status(502).json({ error: 'ml-service unavailable', detail: err.message });
  }
});

module.exports = router;
