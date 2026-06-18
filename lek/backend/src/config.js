// Loads environment from the repo-root .env (one place for all services).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL,
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  nodeEnv: process.env.NODE_ENV || 'development',
  africasTalking: {
    username: process.env.AFRICAS_TALKING_USERNAME || 'sandbox',
    apiKey: process.env.AFRICAS_TALKING_API_KEY || '',
    shortcode: process.env.AFRICAS_TALKING_SHORTCODE || '',
  },
};
