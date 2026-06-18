// GET /api/users  — list SMS subscribers (joined county)
// POST /api/users/register — register a new subscriber
const express = require('express');
const { query } = require('../db/pool');

const router = express.Router();

router.get('/', async (_req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.phone_number, u.language_preference, u.status,
           u.registered_at, c.name AS county
    FROM users u
    LEFT JOIN counties c ON c.id = u.county_id
    ORDER BY u.registered_at DESC`);
  res.json(rows.map((r) => ({
    id: r.id,
    phone: r.phone_number,
    county: r.county,
    language: r.language_preference,
    status: r.status,
    registeredAt: r.registered_at,
  })));
});

router.post('/register', async (req, res) => {
  const { phone_number, county_id, language_preference } = req.body || {};
  if (!phone_number || !county_id) {
    return res.status(400).json({ error: 'phone_number and county_id required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO users (phone_number, county_id, language_preference)
       VALUES ($1, $2, COALESCE($3, 'en')) RETURNING id`,
      [phone_number, county_id, language_preference]);
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'phone already registered' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
