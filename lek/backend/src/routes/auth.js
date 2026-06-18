// Admin authentication: POST /api/auth/login -> JWT.
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const config = require('../config');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  const { rows } = await query(
    'SELECT id, username, password_hash, role FROM admin_users WHERE username = $1',
    [username]);
  const admin = rows[0];
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  const token = jwt.sign(
    { sub: admin.id, username: admin.username, role: admin.role },
    config.jwtSecret, { expiresIn: '12h' });
  res.json({ token, admin: { username: admin.username, role: admin.role } });
});

module.exports = router;
