// GET  /api/alerts     — recent alert log (joined user + county)
// POST /api/alerts/run — run the alert engine (predictions + threshold + SMS)
const express = require('express');
const { query } = require('../db/pool');
const alertEngine = require('../services/alertEngine');

const router = express.Router();

router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT a.id, u.phone_number, c.name AS county, a.message_text,
           a.channel, a.delivery_status, a.sent_at
    FROM alerts a
    JOIN users u ON u.id = a.user_id
    LEFT JOIN counties c ON c.id = u.county_id
    ORDER BY a.sent_at DESC
    LIMIT 50`);
  res.json(rows.map((r) => ({
    id: r.id,
    phone: r.phone_number,
    county: r.county,
    message: r.message_text,
    channel: r.channel,
    status: r.delivery_status,
    sentAt: r.sent_at,
  })));
});

router.post('/run', async (_req, res) => {
  try {
    res.json(await alertEngine.runAlerts());
  } catch (err) {
    res.status(500).json({ error: 'alert run failed', detail: err.message });
  }
});

module.exports = router;
