// POST /api/ussd — Africa's Talking USSD callback (PUBLIC, no JWT).
//
// AT posts form-urlencoded {sessionId, serviceCode, phoneNumber, text}. `text` is
// the accumulated input, levels separated by '*'. Responses MUST begin with:
//   "CON " to continue the session, or "END " to terminate it.
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

function normalizePhone(raw) {
  return String(raw || '').replace(/[\s-]/g, '');
}

async function listCounties() {
  const { rows } = await query('SELECT id, name FROM counties ORDER BY id');
  return rows;
}

function countyMenu(counties) {
  return counties.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
}

router.post('/', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  const phone = normalizePhone(req.body.phoneNumber);
  const text = (req.body.text || '').trim();
  const parts = text === '' ? [] : text.split('*');

  try {
    // --- main menu ---
    if (parts.length === 0) {
      return res.send(
        'CON Welcome to Lek Food Price Alerts\n'
        + '1. Register for alerts\n'
        + '2. Check my county risk\n'
        + '3. Unsubscribe');
    }

    const choice = parts[0];
    const counties = await listCounties();

    // --- 1. Register ---
    if (choice === '1') {
      if (parts.length === 1) {
        return res.send(`CON Select your county:\n${countyMenu(counties)}`);
      }
      const county = counties[parseInt(parts[1], 10) - 1];
      if (!county) return res.send('END Invalid county selection.');
      await query(
        `INSERT INTO users (phone_number, county_id, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (phone_number)
         DO UPDATE SET county_id = EXCLUDED.county_id, status = 'active'`,
        [phone, county.id]);
      return res.send(`END You are registered for alerts in ${county.name}.`);
    }

    // --- 2. Check county risk ---
    if (choice === '2') {
      let county = null;
      if (parts.length >= 2) {
        county = counties[parseInt(parts[1], 10) - 1];
      } else {
        const { rows } = await query('SELECT county_id FROM users WHERE phone_number = $1', [phone]);
        if (rows[0]?.county_id) county = counties.find((c) => c.id === rows[0].county_id);
      }
      if (!county) {
        return res.send(`CON Select your county:\n${countyMenu(counties)}`);
      }
      const { rows: p } = await query(`
        SELECT predicted_change_pct FROM predictions
        WHERE county_id = $1 ORDER BY prediction_date DESC, id DESC LIMIT 1`, [county.id]);
      if (!p[0]) return res.send(`END ${county.name}: no forecast available yet.`);
      const pct = Math.round(Number(p[0].predicted_change_pct));
      return res.send(`END ${county.name}: food prices may change ~${pct}% next month.`);
    }

    // --- 3. Unsubscribe ---
    if (choice === '3') {
      await query("UPDATE users SET status = 'inactive' WHERE phone_number = $1", [phone]);
      return res.send('END You have unsubscribed from Lek alerts.');
    }

    return res.send('END Invalid choice. Please dial again.');
  } catch (err) {
    console.error('USSD error:', err.message);
    return res.send('END Service temporarily unavailable. Please try again later.');
  }
});

module.exports = router;
