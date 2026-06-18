// Proxies the ml-service model + national forecast to the dashboard.
const express = require('express');
const mlClient = require('../services/mlClient');

const router = express.Router();

router.get('/model', async (_req, res) => {
  try {
    res.json(await mlClient.getModel());
  } catch (err) {
    res.status(502).json({ error: 'ml-service unavailable', detail: err.message });
  }
});

router.get('/forecast', async (req, res) => {
  const danger = Number(req.query.danger) || 5;
  const severe = Number(req.query.severe) || 10;
  try {
    res.json(await mlClient.getForecast(danger, severe));
  } catch (err) {
    res.status(502).json({ error: 'ml-service unavailable', detail: err.message });
  }
});

module.exports = router;
