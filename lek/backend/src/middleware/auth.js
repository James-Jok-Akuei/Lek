// JWT auth guard for protected /api routes.
const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing bearer token' });
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'invalid or expired token' });
  }
}

// Gate for superadmin-only routes (e.g. admin management). Must run AFTER
// requireAuth so req.admin (and its role) is populated.
function requireSuperadmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'superadmin') {
    return res.status(403).json({ error: 'forbidden: superadmin only' });
  }
  next();
}

module.exports = { requireAuth, requireSuperadmin };
