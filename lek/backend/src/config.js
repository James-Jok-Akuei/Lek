// Loads environment from the repo-root .env (one place for all services).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Browser origins allowed to call this API (CORS). Comma-separated list in
// ALLOWED_ORIGINS for production (the deployed dashboard URL); defaults to the
// local Vite dev server so local development needs no extra config.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  // Enable SSL for the Postgres connection (needed when reaching a managed DB
  // such as Render over its EXTERNAL URL). Off by default so local Postgres,
  // which has no SSL, keeps working unchanged.
  databaseSsl: process.env.DATABASE_SSL === 'true',
  allowedOrigins,
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
  // Monthly predict-then-alert cron job. Off unless explicitly set to "true"
  // so it never fires during local dev/tests; trigger manually via the route.
  schedulerEnabled: process.env.SCHEDULER_ENABLED === 'true',
  africasTalking: {
    username: process.env.AFRICAS_TALKING_USERNAME || 'sandbox',
    apiKey: process.env.AFRICAS_TALKING_API_KEY || '',
    shortcode: process.env.AFRICAS_TALKING_SHORTCODE || '',
  },
};
