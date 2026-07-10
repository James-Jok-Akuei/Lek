// Integration tests: POST /api/auth/login through the real Express app.
// Only the database is mocked — routing, JSON parsing, bcrypt, and JWT are real.
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { query } = require('../src/db/pool');
const app = require('../src/app');

beforeEach(() => jest.clearAllMocks());

describe('POST /api/auth/login', () => {
  test('400 when username or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  test('401 for an unknown username', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).post('/api/auth/login')
      .send({ username: 'ghost', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('401 for a wrong password', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'admin', password_hash: hash, role: 'superadmin' }],
    });

    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid credentials/i);
  });

  test('200 with a valid JWT for correct credentials', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'admin', password_hash: hash, role: 'superadmin' }],
    });

    const res = await request(app).post('/api/auth/login')
      .send({ username: 'admin', password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body.admin).toEqual({ username: 'admin', role: 'superadmin' });

    // The returned token must verify against our secret and carry the role.
    const payload = jwt.verify(res.body.token, config.jwtSecret);
    expect(payload.username).toBe('admin');
    expect(payload.role).toBe('superadmin');
  });
});
