// Lëk backend API — Express entry point.
const express = require('express');
const cors = require('cors');
const config = require('./config');
const { query, pool } = require('./db/pool');
const mlService = require('./services/mlService');
const scheduler = require('./services/scheduler');
const { requireAuth } = require('./middleware/auth');

const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // Africa's Talking USSD posts form-urlencoded

// --- public routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ussd', require('./routes/ussd')); // PUBLIC: AT USSD callback (no JWT)

// Health: reports backend status + whether the DB and ML service are reachable.
app.get('/api/health', async (_req, res) => {
  let database = 'down';
  try {
    await query('SELECT 1');
    database = 'ok';
  } catch (err) {
    console.error('health: DB check failed:', err.message);
  }
  const ml = await mlService.health();
  const healthy = database === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    service: 'lek-backend',
    database,
    ml_service: ml.status || 'unknown',
  });
});

// --- everything below requires a valid admin JWT ---
app.use('/api', requireAuth);
app.use('/api', require('./routes/forecast'));        // /api/model, /api/forecast (compat)
app.use('/api/counties', require('./routes/counties'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/scheduler', require('./routes/scheduler'));

// Consistent JSON errors (no raw stack traces to clients).
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

// Startup: confirm the DB connection before announcing readiness.
async function start() {
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM counties');
    console.log(`[backend] database connected (counties: ${rows[0].n})`);
  } catch (err) {
    console.error(`[backend] DATABASE CONNECTION FAILED: ${err.message}`);
    console.error('[backend] check DATABASE_URL in .env and that Postgres is running.');
  }
  app.listen(config.port, () => {
    console.log(`[backend] listening on http://localhost:${config.port}`);
    console.log(`[backend] ml-service: ${config.mlServiceUrl}`);
    // Start the monthly predict-then-alert cron (no-op unless SCHEDULER_ENABLED=true).
    scheduler.start();
  });
}

start();

module.exports = app;
