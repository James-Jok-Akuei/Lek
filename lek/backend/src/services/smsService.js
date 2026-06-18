// SMS dispatch via Africa's Talking (sandbox or live), with alert-log persistence.
//
// Credentials come ONLY from environment variables (config.africasTalking); the
// API key is never logged. If no API key is set, runs in SIMULATED mode (logs
// instead of sending) so the pipeline still works end-to-end. Every send writes a
// row to the alerts table.
const config = require('../config');
const { query } = require('../db/pool');

const MAX_LEN = 160; // proposal NFR6: SMS must stay within one 160-char segment
const SIMULATED = !config.africasTalking.apiKey;

let smsClient = null;
if (!SIMULATED) {
  const AfricasTalking = require('africastalking')({
    username: config.africasTalking.username,
    apiKey: config.africasTalking.apiKey, // from env; never logged
  });
  smsClient = AfricasTalking.SMS;
}

function clamp(message) {
  const m = String(message || '').trim();
  return m.length > MAX_LEN ? m.slice(0, MAX_LEN) : m;
}

// Map the Africa's Talking response to a delivery_status we store.
function statusFromResponse(raw) {
  const rec = raw?.SMSMessageData?.Recipients?.[0];
  if (!rec) return 'sent'; // sandbox may return an empty recipients list on success
  return /success|sent|queued|submitted/i.test(rec.status) ? 'sent' : 'failed';
}

async function logAlert({ userId = null, predictionId = null, message, status }) {
  const { rows } = await query(
    `INSERT INTO alerts (user_id, prediction_id, message_text, channel, delivery_status, sent_at)
     VALUES ($1, $2, $3, 'SMS', $4, NOW())
     RETURNING id`,
    [userId, predictionId, message, status]);
  return rows[0].id;
}

// Send one SMS and persist an alert row. Returns { status, alertId, ... }.
async function sendSMS(phoneNumber, message, { userId = null, predictionId = null } = {}) {
  const text = clamp(message);

  if (SIMULATED) {
    console.log(`[SMS:simulated] to=${phoneNumber} :: ${text}`);
    const alertId = await logAlert({ userId, predictionId, message: text, status: 'sent' });
    return { phoneNumber, status: 'sent', simulated: true, alertId };
  }

  try {
    const opts = { to: [phoneNumber], message: text };
    if (config.africasTalking.shortcode) opts.from = config.africasTalking.shortcode;
    const raw = await smsClient.send(opts);
    const status = statusFromResponse(raw);
    const alertId = await logAlert({ userId, predictionId, message: text, status });
    return {
      phoneNumber, status, simulated: false, alertId,
      providerMessage: raw?.SMSMessageData?.Message,
    };
  } catch (err) {
    // Log the failure (status only — never the API key).
    console.error(`[SMS:failed] to=${phoneNumber} :: ${err.message}`);
    const alertId = await logAlert({ userId, predictionId, message: text, status: 'failed' });
    return { phoneNumber, status: 'failed', simulated: false, alertId, error: err.message };
  }
}

// Send the same message to many recipients. recipients: [{ phoneNumber, userId?, predictionId? }]
async function sendBulkSMS(recipients, message) {
  const results = [];
  for (const r of recipients) {
    results.push(await sendSMS(r.phoneNumber, message, { userId: r.userId, predictionId: r.predictionId }));
  }
  return results;
}

module.exports = { sendSMS, sendBulkSMS, SIMULATED, MAX_LEN, clamp };
