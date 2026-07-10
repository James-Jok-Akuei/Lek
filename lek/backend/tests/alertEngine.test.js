// Unit tests: alert engine threshold logic (services/alertEngine.js).
// The DB and SMS service are mocked — no Postgres or Africa's Talking needed.
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));
jest.mock('../src/services/smsService', () => ({
  sendSMS: jest.fn().mockResolvedValue({ status: 'sent' }),
  SIMULATED: true,
}));

const { query } = require('../src/db/pool');
const smsService = require('../src/services/smsService');
const { runAlerts, composeWarning, DEFAULT_HIGH_RISK_PCT } = require('../src/services/alertEngine');

beforeEach(() => jest.clearAllMocks());

describe('composeWarning', () => {
  test('mentions the county and rounded percentage', () => {
    const msg = composeWarning('Jonglei', 17.4);
    expect(msg).toContain('Jonglei');
    expect(msg).toContain('17%');
  });

  test('stays within one 160-character SMS segment', () => {
    const msg = composeWarning('Northern Bahr el Ghazal', 99.9);
    expect(msg.length).toBeLessThanOrEqual(160);
  });
});

describe('runAlerts', () => {
  test('alerts subscribers only in counties above their severe threshold', async () => {
    // Latest predictions: Jonglei is above its 10% threshold, Unity is below.
    query.mockResolvedValueOnce({
      rows: [
        { prediction_id: 1, county_id: 1, county: 'Jonglei', predicted_change_pct: '12.5', severe_level: '10.0' },
        { prediction_id: 2, county_id: 2, county: 'Unity', predicted_change_pct: '4.0', severe_level: '10.0' },
      ],
    });
    // Active subscribers in Jonglei (only queried for the high-risk county).
    query.mockResolvedValueOnce({
      rows: [
        { id: 11, phone_number: '+211921000003' },
        { id: 12, phone_number: '+211921000012' },
      ],
    });

    const summary = await runAlerts();

    expect(summary.high_risk_counties).toBe(1);
    expect(summary.recipients).toBe(2);
    expect(summary.sms_sent).toBe(2);
    expect(summary.details[0].county).toBe('Jonglei');
    expect(smsService.sendSMS).toHaveBeenCalledTimes(2);
    expect(smsService.sendSMS).toHaveBeenCalledWith(
      '+211921000003',
      expect.stringContaining('Jonglei'),
      { userId: 11, predictionId: 1 });
  });

  test('sends nothing when every county is below threshold', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { prediction_id: 1, county_id: 1, county: 'Jonglei', predicted_change_pct: '3.0', severe_level: '10.0' },
      ],
    });

    const summary = await runAlerts();

    expect(summary.high_risk_counties).toBe(0);
    expect(summary.sms_sent).toBe(0);
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });

  test('falls back to the default threshold when a county has none', async () => {
    // 16% > DEFAULT_HIGH_RISK_PCT (15) — should alert despite severe_level being null.
    query.mockResolvedValueOnce({
      rows: [
        { prediction_id: 3, county_id: 3, county: 'Lakes', predicted_change_pct: '16.0', severe_level: null },
      ],
    });
    query.mockResolvedValueOnce({ rows: [{ id: 20, phone_number: '+211921000007' }] });

    const summary = await runAlerts();

    expect(summary.high_risk_counties).toBe(1);
    expect(summary.details[0].threshold).toBe(DEFAULT_HIGH_RISK_PCT);
  });

  test('a prediction exactly at the threshold does NOT trigger an alert', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { prediction_id: 4, county_id: 4, county: 'Warrap', predicted_change_pct: '10.0', severe_level: '10.0' },
      ],
    });

    const summary = await runAlerts();

    expect(summary.high_risk_counties).toBe(0);
    expect(smsService.sendSMS).not.toHaveBeenCalled();
  });
});
