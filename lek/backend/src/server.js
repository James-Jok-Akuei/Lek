// Lëk backend API — entry point. Boots the Express app defined in app.js.
const app = require('./app');
const config = require('./config');
const { query } = require('./db/pool');
const scheduler = require('./services/scheduler');

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
