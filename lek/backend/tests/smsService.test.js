// Unit tests: SMS service in SIMULATED mode (services/smsService.js).
// Config is mocked with no API key so nothing real is ever sent; the DB write
// that logs each alert is mocked too.
jest.mock('../src/config', () => ({
  africasTalking: { username: 'sandbox', apiKey: '', shortcode: '' },
}));
jest.mock('../src/db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: 42 }] }),
  pool: { end: jest.fn() },
}));

const { query } = require('../src/db/pool');
const smsService = require('../src/services/smsService');

beforeEach(() => jest.clearAllMocks());

describe('clamp', () => {
  test('trims whitespace and keeps short messages intact', () => {
    expect(smsService.clamp('  hello  ')).toBe('hello');
  });

  test('cuts messages down to one 160-character segment', () => {
    const long = 'x'.repeat(400);
    expect(smsService.clamp(long)).toHaveLength(smsService.MAX_LEN);
  });

  test('handles null/undefined without crashing', () => {
    expect(smsService.clamp(null)).toBe('');
    expect(smsService.clamp(undefined)).toBe('');
  });
});

describe('sendSMS (simulated mode)', () => {
  test('runs simulated when no API key is configured', () => {
    expect(smsService.SIMULATED).toBe(true);
  });

  test('returns sent status and logs an alert row', async () => {
    const result = await smsService.sendSMS('+211921000001', 'Test warning',
      { userId: 5, predictionId: 9 });

    expect(result.status).toBe('sent');
    expect(result.simulated).toBe(true);
    expect(result.alertId).toBe(42);
    // The alert log INSERT received the user, prediction, and message.
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO alerts'),
      [5, 9, 'Test warning', 'sent']);
  });
});

describe('sendBulkSMS', () => {
  test('sends one message per recipient and returns all results', async () => {
    const recipients = [
      { phoneNumber: '+211921000001', userId: 1 },
      { phoneNumber: '+211921000002', userId: 2 },
      { phoneNumber: '+211921000003', userId: 3 },
    ];

    const results = await smsService.sendBulkSMS(recipients, 'Bulk warning');

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'sent')).toBe(true);
    expect(query).toHaveBeenCalledTimes(3);
  });
});
