// Single shared PostgreSQL connection pool.
const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Managed Postgres (e.g. Render's external URL) requires SSL; local Postgres
  // does not. Controlled by DATABASE_SSL so local dev is unaffected by default.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
