// Unit tests: JWT auth guards (middleware/auth.js). No DB or network needed.
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { requireAuth, requireSuperadmin } = require('../src/middleware/auth');

// Minimal Express-style res double that records status/json calls.
function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('requireAuth', () => {
  test('rejects a request with no Authorization header', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/missing bearer token/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a malformed (non-Bearer) header', () => {
    const req = { headers: { authorization: 'Basic abc123' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid token', () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an expired token', () => {
    const token = jwt.sign({ sub: 1, username: 'admin', role: 'admin' },
      config.jwtSecret, { expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts a valid token and attaches the admin payload', () => {
    const token = jwt.sign({ sub: 7, username: 'admin', role: 'superadmin' },
      config.jwtSecret, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.admin.username).toBe('admin');
    expect(req.admin.role).toBe('superadmin');
  });
});

describe('requireSuperadmin', () => {
  test('blocks a regular admin', () => {
    const req = { admin: { username: 'juliet', role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();

    requireSuperadmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('blocks when no admin is attached at all', () => {
    const req = {};
    const res = mockRes();
    const next = jest.fn();

    requireSuperadmin(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('allows a superadmin through', () => {
    const req = { admin: { username: 'admin', role: 'superadmin' } };
    const res = mockRes();
    const next = jest.fn();

    requireSuperadmin(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
