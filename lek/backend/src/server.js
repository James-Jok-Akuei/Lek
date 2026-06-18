// Lëk backend API — Express entry point.
const express = require('express');
const cors = require('cors');
const config = require('./config');
const mlClient = require('./services/mlClient');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// --- public routes ---
app.use('/api/auth', require('./routes/auth'));

app.get('/api/health', async (_req, res) => {
  const ml = await mlClient.health();
  res.json({ status: 'ok', service: 'lek-backend', ml_service: ml.status || 'unknown' });
});

// --- everything below requires a valid admin JWT ---
app.use('/api', requireAuth);
app.use('/api', require('./routes/forecast'));      // /api/model, /api/forecast
app.use('/api/counties', require('./routes/counties'));
app.use('/api/predictions', require('./routes/predictions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/stats', require('./routes/stats'));

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(config.port, () => {
  console.log(`Lëk backend listening on http://localhost:${config.port}`);
  console.log(`  ml-service: ${config.mlServiceUrl}`);
});

module.exports = app;
