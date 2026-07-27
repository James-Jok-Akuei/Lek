// POST /api/ussd — Africa's Talking USSD callback (PUBLIC, no JWT).
//
// AT posts form-urlencoded {sessionId, serviceCode, phoneNumber, text}. `text` is
// the accumulated input, levels separated by '*'. Responses MUST begin with:
//   "CON " to continue the session, or "END " to terminate it.
//
// Language: a caller we already know is served in the language stored on their
// user row. A caller we do not know picks one on the FIRST screen, and that
// choice is saved when they register. So the language step costs a returning
// subscriber nothing, and every later screen is in their own language.
const express = require('express');
const { query } = require('../db/pool');
const i18n = require('../i18n');

const router = express.Router();

function normalizePhone(raw) {
  return String(raw || '').replace(/[\s-]/g, '');
}

async function findUser(phone) {
  const { rows } = await query(
    'SELECT id, county_id, language_preference FROM users WHERE phone_number = $1',
    [phone]);
  return rows[0] || null;
}

async function listCounties() {
  const { rows } = await query('SELECT id, name FROM counties ORDER BY id');
  return rows;
}

// Menu numbers stay ASCII digits in both languages — the caller presses a key.
function countyMenu(counties, lang) {
  return counties
    .map((c, i) => `${i + 1}. ${i18n.countyName(c.name, lang)}`)
    .join('\n');
}

router.post('/', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  const phone = normalizePhone(req.body.phoneNumber);
  const text = (req.body.text || '').trim();
  const parts = text === '' ? [] : text.split('*');

  // Fall back to English if the language cannot be determined before the catch.
  let lang = i18n.DEFAULT_LANGUAGE;

  try {
    const user = await findUser(phone);
    // Steps AFTER any language prompt, so the rest of the flow indexes the same
    // way whether or not the caller had to choose a language first.
    let steps = parts;

    if (user?.language_preference) {
      lang = i18n.normalizeLanguage(user.language_preference);
    } else {
      if (parts.length === 0) {
        return res.send(`CON ${i18n.CHOOSE_LANGUAGE}`);
      }
      const picked = i18n.LANGUAGE_BY_KEY[parts[0]];
      if (!picked) {
        return res.send(`END ${i18n.CHOOSE_LANGUAGE}`);
      }
      lang = picked;
      steps = parts.slice(1);
    }

    const t = i18n.t(lang);

    // --- main menu ---
    if (steps.length === 0) {
      return res.send(`CON ${t.mainMenu}`);
    }

    const choice = steps[0];
    const counties = await listCounties();

    // --- 1. Register ---
    if (choice === '1') {
      if (steps.length === 1) {
        return res.send(`CON ${t.selectCounty}\n${countyMenu(counties, lang)}`);
      }
      const county = counties[parseInt(steps[1], 10) - 1];
      if (!county) return res.send(`END ${t.invalidCounty}`);
      // The language chosen on this call is stored with the registration.
      await query(
        `INSERT INTO users (phone_number, county_id, language_preference, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (phone_number)
         DO UPDATE SET county_id = EXCLUDED.county_id,
                       language_preference = EXCLUDED.language_preference,
                       status = 'active'`,
        [phone, county.id, lang]);
      return res.send(`END ${t.registered(i18n.countyName(county.name, lang))}`);
    }

    // --- 2. Check county risk ---
    if (choice === '2') {
      let county = null;
      if (steps.length >= 2) {
        county = counties[parseInt(steps[1], 10) - 1];
      } else if (user?.county_id) {
        county = counties.find((c) => c.id === user.county_id);
      }
      if (!county) {
        return res.send(`CON ${t.selectCounty}\n${countyMenu(counties, lang)}`);
      }
      const localName = i18n.countyName(county.name, lang);
      const { rows: p } = await query(`
        SELECT predicted_change_pct FROM predictions
        WHERE county_id = $1 ORDER BY prediction_date DESC, id DESC LIMIT 1`, [county.id]);
      if (!p[0]) return res.send(`END ${t.noForecast(localName)}`);
      const pct = Math.round(Number(p[0].predicted_change_pct));
      return res.send(`END ${t.risk(localName, pct)}`);
    }

    // --- 3. Unsubscribe ---
    if (choice === '3') {
      await query("UPDATE users SET status = 'inactive' WHERE phone_number = $1", [phone]);
      return res.send(`END ${t.unsubscribed}`);
    }

    // --- 4. Change language ---
    if (choice === '4') {
      if (steps.length === 1) {
        return res.send(`CON ${i18n.CHOOSE_LANGUAGE}`);
      }
      const picked = i18n.LANGUAGE_BY_KEY[steps[1]];
      if (!picked) return res.send(`END ${t.invalidChoice}`);
      await query(
        'UPDATE users SET language_preference = $1 WHERE phone_number = $2',
        [picked, phone]);
      // Confirm in the language just chosen, not the previous one.
      return res.send(`END ${i18n.t(picked).languageSet}`);
    }

    return res.send(`END ${t.invalidChoice}`);
  } catch (err) {
    console.error('USSD error:', err.message);
    return res.send(`END ${i18n.t(lang).unavailable}`);
  }
});

module.exports = router;
