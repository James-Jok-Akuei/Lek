// Admin account management. Protected by requireAuth (in server.js) AND
// requireSuperadmin below — so ONLY a superadmin can reach any of these.
//   GET    /api/admins              list admins (never returns password_hash)
//   POST   /api/admins              create {username, password} — always role 'admin'
//   PATCH  /api/admins/:id/password change password {password}
//   DELETE /api/admins/:id          delete (blocks superadmin + self + last admin)
const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../db/pool');
const { requireSuperadmin } = require('../middleware/auth');

const router = express.Router();

// Every admin-management endpoint is superadmin-only. This is the REAL access
// control; hiding the UI nav is convenience only.
router.use(requireSuperadmin);

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_COST = 10;

// Map a DB row to the public shape — password_hash is never included.
function shape(r) {
  return { id: r.id, username: r.username, role: r.role, createdAt: r.created_at };
}

// --- list ---
router.get('/', async (_req, res) => {
  const { rows } = await query(
    'SELECT id, username, role, created_at FROM admin_users ORDER BY created_at, id');
  res.json(rows.map(shape));
});

// --- create ---
router.post('/', async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  // Single-superadmin rule: new admins are ALWAYS 'admin'. We never honour a
  // role from the request, so no one can create or promote another superadmin.
  const role = 'admin';

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  try {
    const hash = await bcrypt.hash(password, BCRYPT_COST);
    const { rows } = await query(
      `INSERT INTO admin_users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, created_at`,
      [username, hash, role]);
    res.status(201).json(shape(rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'username already exists' });
    }
    res.status(500).json({ error: 'could not create admin' });
  }
});

// --- change password ---
router.patch('/:id/password', async (req, res) => {
  const id = Number(req.params.id);
  const password = String((req.body || {}).password || '');
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'invalid admin id' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { rows } = await query(
    `UPDATE admin_users SET password_hash = $1 WHERE id = $2
     RETURNING id, username, role, created_at`,
    [hash, id]);
  if (!rows[0]) return res.status(404).json({ error: 'admin not found' });
  res.json({ updated: true, ...shape(rows[0]) });
});

// --- delete (never allow zero admins; never let admins delete themselves) ---
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'invalid admin id' });
  }
  // req.admin.sub is the currently-logged-in admin's id (set by requireAuth).
  if (id === Number(req.admin.sub)) {
    return res.status(403).json({ error: 'you cannot delete your own account' });
  }

  const { rows: target } = await query('SELECT id, role FROM admin_users WHERE id = $1', [id]);
  if (!target[0]) return res.status(404).json({ error: 'admin not found' });

  // The superadmin is the single primary account and can never be deleted.
  if (target[0].role === 'superadmin') {
    return res.status(403).json({ error: 'cannot delete the superadmin' });
  }

  const { rows: count } = await query('SELECT COUNT(*)::int AS n FROM admin_users');
  if (count[0].n <= 1) {
    return res.status(409).json({ error: 'cannot delete the last remaining admin' });
  }

  await query('DELETE FROM admin_users WHERE id = $1', [id]);
  res.json({ deleted: true, id });
});

module.exports = router;
