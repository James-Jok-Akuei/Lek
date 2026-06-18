// User (SMS subscriber) management.
//   POST   /api/users          register   {phone_number, county|county_id, language_preference?}
//   GET    /api/users          list (optional ?county=Name)
//   GET    /api/users/:id      one user
//   PATCH  /api/users/:id      update {county|county_id?, status?, language_preference?}
//   DELETE /api/users/:id      remove
// POST /api/users/register is kept as an alias for backward compatibility.
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

const PHONE_RE = /^\+?\d{9,15}$/;

function normalizePhone(raw) {
  return String(raw || '').replace(/[\s-]/g, '');
}

// Resolve a county from either a numeric id or a name; returns id or null.
async function resolveCountyId({ county_id, county }) {
  if (county_id != null && county_id !== '') {
    const { rows } = await query('SELECT id FROM counties WHERE id = $1', [Number(county_id)]);
    return rows[0]?.id ?? null;
  }
  if (county) {
    const { rows } = await query('SELECT id FROM counties WHERE LOWER(name) = LOWER($1)', [county]);
    return rows[0]?.id ?? null;
  }
  return null;
}

function shape(r) {
  return {
    id: r.id,
    phone: r.phone_number,
    county: r.county,
    countyId: r.county_id,
    language: r.language_preference,
    status: r.status,
    registeredAt: r.registered_at,
  };
}

// --- list (optional county filter) ---
router.get('/', async (req, res) => {
  const { county } = req.query;
  const params = [];
  let where = '';
  if (county) {
    params.push(county);
    where = 'WHERE LOWER(c.name) = LOWER($1)';
  }
  const { rows } = await query(`
    SELECT u.id, u.phone_number, u.county_id, u.language_preference, u.status,
           u.registered_at, c.name AS county
    FROM users u
    LEFT JOIN counties c ON c.id = u.county_id
    ${where}
    ORDER BY u.registered_at DESC`, params);
  res.json(rows.map(shape));
});

// --- get one ---
router.get('/:id', async (req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.phone_number, u.county_id, u.language_preference, u.status,
           u.registered_at, c.name AS county
    FROM users u LEFT JOIN counties c ON c.id = u.county_id
    WHERE u.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'user not found' });
  res.json(shape(rows[0]));
});

// --- register ---
async function register(req, res) {
  const body = req.body || {};
  const phone = normalizePhone(body.phone_number);
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'invalid phone_number (expected 9-15 digits, optional +)' });
  }
  const countyId = await resolveCountyId(body);
  if (!countyId) {
    return res.status(400).json({ error: 'unknown or missing county (provide county name or county_id)' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO users (phone_number, county_id, language_preference)
       VALUES ($1, $2, COALESCE($3, 'en'))
       RETURNING id, phone_number, county_id, language_preference, status, registered_at`,
      [phone, countyId, body.language_preference]);
    const { rows: c } = await query('SELECT name FROM counties WHERE id = $1', [countyId]);
    res.status(201).json(shape({ ...rows[0], county: c[0]?.name }));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'phone already registered' });
    res.status(500).json({ error: 'could not register user' });
  }
}
router.post('/', register);
router.post('/register', register); // backward-compatible alias

// --- update ---
router.patch('/:id', async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const params = [];
  if (body.county != null || body.county_id != null) {
    const countyId = await resolveCountyId(body);
    if (!countyId) return res.status(400).json({ error: 'unknown county' });
    params.push(countyId); sets.push(`county_id = $${params.length}`);
  }
  if (body.status != null) {
    if (!['active', 'inactive', 'unsubscribed'].includes(body.status)) {
      return res.status(400).json({ error: 'status must be active|inactive|unsubscribed' });
    }
    params.push(body.status); sets.push(`status = $${params.length}`);
  }
  if (body.language_preference != null) {
    params.push(body.language_preference); sets.push(`language_preference = $${params.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'no updatable fields provided' });

  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, phone_number, county_id, language_preference, status, registered_at`,
    params);
  if (!rows[0]) return res.status(404).json({ error: 'user not found' });
  res.json(shape(rows[0]));
});

// --- delete ---
router.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'user not found' });
  res.json({ deleted: true, id: Number(req.params.id) });
});

module.exports = router;
