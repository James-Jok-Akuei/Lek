// Integration tests: JWT protection + /api/counties + /api/health through the
// real Express app. The database and ML service client are mocked.
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));
jest.mock('../src/services/mlService', () => ({
  health: jest.fn().mockResolvedValue({ status: 'ok' }),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { query } = require('../src/db/pool');
const mlService = require('../src/services/mlService');
const app = require('../src/app');

function adminToken(role = 'admin') {
  return jwt.sign({ sub: 1, username: 'admin', role }, config.jwtSecret, { expiresIn: '1h' });
}

beforeEach(() => jest.clearAllMocks());

describe('JWT protection on /api routes', () => {
  test('401 without a token', async () => {
    const res = await request(app).get('/api/counties');
    expect(res.status).toBe(401);
  });

  test('401 with a garbage token', async () => {
    const res = await request(app).get('/api/counties')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  test('401 with a token signed by the wrong secret', async () => {
    const forged = jwt.sign({ sub: 1, username: 'admin', role: 'superadmin' },
      'some-other-secret', { expiresIn: '1h' });
    const res = await request(app).get('/api/counties')
      .set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/counties', () => {
  test('returns counties with derived risk levels', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Jonglei', region: 'Greater Upper Nile', current_index: '120.5', predicted_change: '12.0', target_date: '2026-08-01' },
        { id: 2, name: 'Unity', region: 'Greater Upper Nile', current_index: '98.2', predicted_change: '6.5', target_date: '2026-08-01' },
        { id: 3, name: 'Lakes', region: 'Bahr el Ghazal', current_index: '101.0', predicted_change: '1.2', target_date: '2026-08-01' },
        { id: 4, name: 'Warrap', region: 'Bahr el Ghazal', current_index: null, predicted_change: null, target_date: null },
      ],
    });

    const res = await request(app).get('/api/counties')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);

    // >=10% is high, >=5% medium, below low; missing prediction defaults to low.
    const byName = Object.fromEntries(res.body.map((c) => [c.name, c]));
    expect(byName.Jonglei.riskLevel).toBe('high');
    expect(byName.Unity.riskLevel).toBe('medium');
    expect(byName.Lakes.riskLevel).toBe('low');
    expect(byName.Warrap.riskLevel).toBe('low');
    expect(byName.Warrap.predictedChange).toBe(0);
    expect(byName.Jonglei.targetMonth).toBe('Aug 2026');
  });
});

describe('GET /api/health', () => {
  test('200 ok when the DB and ML service respond', async () => {
    query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }); // SELECT 1

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok', ml_service: 'ok' });
  });

  test('503 degraded when the DB is down', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));
    mlService.health.mockResolvedValueOnce({ status: 'down' });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database).toBe('down');
  });
});
