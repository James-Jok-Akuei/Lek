// GET  /api/alerts            — recent alert log
// POST /api/alerts/run        — run the alert engine against the latest predictions
// POST /api/alerts/test       — send one sample warning SMS to a given number (demo/pilot)
// POST /api/alerts/broadcast  — send a custom message to all users (optionally one county)
const express = require('express');
const { query } = require('../db/pool');
const alertEngine = require('../services/alertEngine');
const smsService = require('../services/smsService');

const router = express.Router();

// --- alert log (LEFT JOIN so test sends without a registered user still show) ---
router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT a.id, u.phone_number, c.name AS county, a.message_text,
           a.channel, a.delivery_status, a.sent_at
    FROM alerts a
    LEFT JOIN users u ON u.id = a.user_id
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

// --- run the alert engine ---
router.post('/run', async (_req, res) => {
  try {
    res.json(await alertEngine.runAlerts());
  } catch (err) {
    res.status(500).json({ error: 'alert run failed', detail: err.message });
  }
});

// --- send a single sample warning (lets pilots/demo receive an SMS even when
//     real predictions are below the high-risk threshold) ---
router.post('/test', async (req, res) => {
  const { phone_number, county } = req.body || {};
  if (!phone_number) return res.status(400).json({ error: 'phone_number required' });

  // Use the county's latest predicted change if we have one, else a sample value.
  let countyName = county || 'your area';
  let pct = 15;
  let userId = null;
  let predictionId = null;

  if (county) {
    const { rows } = await query(`
      SELECT p.id, p.predicted_change_pct, c.name
      FROM predictions p JOIN counties c ON c.id = p.county_id
      WHERE LOWER(c.name) = LOWER($1)
      ORDER BY p.prediction_date DESC, p.id DESC LIMIT 1`, [county]);
    if (rows[0]) {
      countyName = rows[0].name;
      pct = Number(rows[0].predicted_change_pct);
      predictionId = rows[0].id;
    }
  }
  // Link to a registered user if this number is known.
  const { rows: u } = await query('SELECT id FROM users WHERE phone_number = $1', [phone_number]);
  if (u[0]) userId = u[0].id;

  const message = alertEngine.composeWarning(countyName, pct);
  try {
    const result = await smsService.sendSMS(phone_number, message, { userId, predictionId });
    res.json({ sample: true, county: countyName, predicted_change_pct: pct, message, result });
  } catch (err) {
    res.status(502).json({ error: 'sms send failed', detail: err.message });
  }
});

// --- manual broadcast of a custom message ---
router.post('/broadcast', async (req, res) => {
  const { message, county } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'message required' });
  if (message.length > smsService.MAX_LEN) {
    return res.status(400).json({ error: `message exceeds ${smsService.MAX_LEN} characters` });
  }

  const params = [];
  let where = "WHERE u.status = 'active'";
  if (county) {
    params.push(county);
    where += ` AND LOWER(c.name) = LOWER($${params.length})`;
  }
  const { rows: users } = await query(`
    SELECT u.id, u.phone_number FROM users u
    LEFT JOIN counties c ON c.id = u.county_id
    ${where}`, params);

  if (!users.length) return res.json({ sent: 0, recipients: 0, note: 'no matching active users' });

  const recipients = users.map((u) => ({ phoneNumber: u.phone_number, userId: u.id }));
  const results = await smsService.sendBulkSMS(recipients, message);
  const sent = results.filter((r) => r.status === 'sent').length;
  res.json({ recipients: users.length, sent, sms_mode: smsService.SIMULATED ? 'simulated' : 'live' });
});

module.exports = router;
