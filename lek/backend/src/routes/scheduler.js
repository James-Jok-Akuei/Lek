// POST /api/scheduler/run-now — (protected) trigger the monthly predict-then-alert
// job immediately, on demand. Lets us test/demo the full automated cycle without
// waiting for the 1st of the month. Runs the exact same job the cron task runs.
const express = require('express');
const scheduler = require('../services/scheduler');

const router = express.Router();

router.post('/run-now', async (_req, res) => {
  // runMonthlyJob() catches per-step failures internally and never throws, so a
  // partial failure still returns a 200 with the errors listed in the summary.
  const summary = await scheduler.runMonthlyJob('manual');
  res.json(summary);
});

module.exports = router;
