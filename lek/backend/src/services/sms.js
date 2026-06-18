// SMS dispatch via Africa's Talking.
//
// If no API key is configured, runs in SIMULATED mode: messages are logged to
// the console instead of being sent, and reported as delivery_status 'sent'.
// This lets the full alert pipeline run end-to-end without live credentials.
const config = require('../config');

let smsClient = null;
const SIMULATED = !config.africasTalking.apiKey;

if (!SIMULATED) {
  // Lazy require so the dependency is only needed when actually sending.
  const AfricasTalking = require('africastalking')({
    username: config.africasTalking.username,
    apiKey: config.africasTalking.apiKey,
  });
  smsClient = AfricasTalking.SMS;
}

async function sendSms(to, message) {
  if (SIMULATED) {
    console.log(`[SMS:simulated] to=${to} :: ${message}`);
    return { status: 'sent', simulated: true };
  }
  try {
    const opts = { to: [to], message };
    if (config.africasTalking.shortcode) opts.from = config.africasTalking.shortcode;
    const raw = await smsClient.send(opts);
    return { status: 'sent', simulated: false, raw };
  } catch (err) {
    console.error(`[SMS:failed] to=${to} :: ${err.message}`);
    return { status: 'failed', simulated: false };
  }
}

module.exports = { sendSms, SIMULATED };
