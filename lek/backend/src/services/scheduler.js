// Monthly scheduler: automates the predict-then-alert cycle that admins
// otherwise run by hand via POST /api/predictions/run and POST /api/alerts/run.
// This is the "Cron Timer fires the monthly trigger" step from the system
// sequence diagram.
//
// SINGLE SOURCE OF TRUTH: this calls the exact same service functions those
// routes call — predictionService.runPredictions() then alertEngine.runAlerts().
// No prediction or alert logic is duplicated here.
//
// ALTERNATIVE (per the proposal): instead of this in-process node-cron job, a
// GitHub Actions workflow on a cron schedule could POST to
// /api/scheduler/run-now. node-cron keeps the whole cycle self-contained in the
// backend with no external scheduler to host or authenticate.
const cron = require('node-cron');
const config = require('../config');
const predictionService = require('./predictionService');
const alertEngine = require('./alertEngine');

// 1st of each month at 06:00 (server local time), early morning before users
// start their day.
const MONTHLY_SCHEDULE = '0 6 1 * *';

let task = null;

// Next 1st-of-month 06:00 at or after `from`, for startup logging.
function nextRun(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), 1, 6, 0, 0, 0);
  if (d <= from) d.setMonth(d.getMonth() + 1);
  return d;
}

// Run the full predict-then-alert cycle once and return a summary. Each step is
// wrapped so that a failure is logged but NEVER throws out of here — a bad ML
// call or SMS error must not crash the server. Used by both the cron task and
// the manual POST /api/scheduler/run-now endpoint.
async function runMonthlyJob(trigger = 'cron') {
  const startedAt = new Date().toISOString();
  console.log(`[scheduler] monthly job START (trigger=${trigger}, ${startedAt})`);

  const summary = {
    trigger,
    startedAt,
    finishedAt: null,
    predictions: null,
    alerts: null,
    errors: [],
  };

  // Step 1 — predictions: pull from ML service, store rows (same as
  // POST /api/predictions/run).
  try {
    const predictions = await predictionService.runPredictions();
    summary.predictions = predictions;
    console.log(`[scheduler] predictions stored: ${predictions.predictions_created} county(ies) `
      + `(model ${predictions.model_version}, target ${predictions.target_month})`);
  } catch (err) {
    summary.errors.push({ step: 'predictions', message: err.message });
    console.error(`[scheduler] predictions step FAILED: ${err.message}`);
  }

  // Step 2 — alerts: find high-risk counties from the latest predictions and SMS
  // at-risk users (same as POST /api/alerts/run). runAlerts() reads the latest
  // stored predictions, so it naturally builds on step 1.
  try {
    const alerts = await alertEngine.runAlerts();
    summary.alerts = alerts;
    console.log(`[scheduler] alerts: ${alerts.high_risk_counties} high-risk county(ies), `
      + `${alerts.recipients} recipient(s), ${alerts.sms_sent} SMS sent (${alerts.sms_mode})`);
  } catch (err) {
    summary.errors.push({ step: 'alerts', message: err.message });
    console.error(`[scheduler] alerts step FAILED: ${err.message}`);
  }

  summary.finishedAt = new Date().toISOString();
  const ok = summary.errors.length === 0;
  console.log(`[scheduler] monthly job ${ok ? 'DONE' : 'DONE WITH ERRORS'} `
    + `(${summary.finishedAt})`);
  return summary;
}

// Schedule the monthly job if enabled. Call once at server startup.
function start() {
  if (!config.schedulerEnabled) {
    console.log('[scheduler] DISABLED (SCHEDULER_ENABLED is not "true") — '
      + 'trigger manually with POST /api/scheduler/run-now');
    return;
  }
  // runMonthlyJob never throws, so the cron callback can't crash the process.
  task = cron.schedule(MONTHLY_SCHEDULE, () => { runMonthlyJob('cron'); });
  console.log(`[scheduler] ENABLED — cron "${MONTHLY_SCHEDULE}" (1st of each month, 06:00). `
    + `Next run: ${nextRun().toISOString()}`);
}

module.exports = { start, runMonthlyJob, MONTHLY_SCHEDULE, nextRun };
