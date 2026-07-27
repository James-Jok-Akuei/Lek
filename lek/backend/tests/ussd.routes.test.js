// Integration tests: the USSD callback (routes/ussd.js) through the real Express
// app. This endpoint is PUBLIC — Africa's Talking posts to it without a JWT —
// so these also guard that it stays reachable unauthenticated.
jest.mock('../src/db/pool', () => ({
  query: jest.fn(),
  pool: { end: jest.fn() },
}));
jest.mock('../src/services/mlService', () => ({
  health: jest.fn().mockResolvedValue({ status: 'ok' }),
}));

const request = require('supertest');
const { query } = require('../src/db/pool');
const i18n = require('../src/i18n');
const app = require('../src/app');

const COUNTIES = [
  { id: 1, name: 'Central Equatoria' },
  { id: 2, name: 'Jonglei' },
  { id: 3, name: 'Unity' },
];
const PHONE = '+211921000099';

// Route the mocked pool by SQL shape rather than call order, so the tests do not
// break when an unrelated query is added.
function mockDb({ user = null, prediction = null } = {}) {
  const calls = { insert: null, languageUpdate: null, unsubscribe: null };
  query.mockImplementation((sql, params) => {
    if (/FROM users WHERE phone_number/.test(sql)) {
      return Promise.resolve({ rows: user ? [user] : [] });
    }
    if (/FROM counties/.test(sql)) return Promise.resolve({ rows: COUNTIES });
    if (/INSERT INTO users/.test(sql)) {
      calls.insert = params;
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    if (/UPDATE users SET language_preference/.test(sql)) {
      calls.languageUpdate = params;
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    if (/status = 'inactive'/.test(sql)) {
      calls.unsubscribe = params;
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    if (/FROM predictions/.test(sql)) {
      return Promise.resolve({ rows: prediction ? [prediction] : [] });
    }
    return Promise.resolve({ rows: [] });
  });
  return calls;
}

const dial = (text) => request(app).post('/api/ussd')
  .type('form')
  .send({ sessionId: 's1', serviceCode: '*384#', phoneNumber: PHONE, text });

beforeEach(() => jest.clearAllMocks());

describe('language selection for a new caller', () => {
  test('the first screen offers both languages', async () => {
    mockDb();
    const res = await dial('');

    expect(res.status).toBe(200);
    expect(res.text.startsWith('CON ')).toBe(true);
    expect(res.text).toContain('English');
    expect(res.text).toContain('العربية');
  });

  test('choosing 2 shows the main menu in Arabic', async () => {
    mockDb();
    const res = await dial('2');

    expect(res.text).toBe(`CON ${i18n.t('ar').mainMenu}`);
  });

  test('choosing 1 shows the main menu in English', async () => {
    mockDb();
    const res = await dial('1');

    expect(res.text).toBe(`CON ${i18n.t('en').mainMenu}`);
  });

  test('an invalid language key ends the session with the chooser', async () => {
    mockDb();
    const res = await dial('9');

    expect(res.text.startsWith('END ')).toBe(true);
    expect(res.text).toContain('English');
  });
});

describe('a returning subscriber skips the language step', () => {
  test('an Arabic subscriber goes straight to the Arabic menu', async () => {
    mockDb({ user: { id: 7, county_id: 2, language_preference: 'ar' } });
    const res = await dial('');

    expect(res.text).toBe(`CON ${i18n.t('ar').mainMenu}`);
  });

  test('an English subscriber goes straight to the English menu', async () => {
    mockDb({ user: { id: 7, county_id: 2, language_preference: 'en' } });
    const res = await dial('');

    expect(res.text).toBe(`CON ${i18n.t('en').mainMenu}`);
  });
});

describe('registration stores the chosen language', () => {
  test('an Arabic registration saves ar and confirms in Arabic', async () => {
    const calls = mockDb();
    // 2 = Arabic, 1 = register, 2 = second county in the list
    const res = await dial('2*1*2');

    expect(calls.insert).toEqual([PHONE, 2, 'ar']);
    expect(res.text.startsWith('END ')).toBe(true);
    expect(res.text).toContain(i18n.COUNTY_NAMES_AR.Jonglei);
  });

  test('an English registration saves en', async () => {
    const calls = mockDb();
    const res = await dial('1*1*2');

    expect(calls.insert).toEqual([PHONE, 2, 'en']);
    expect(res.text).toContain('Jonglei');
  });

  test('the county menu is listed in Arabic for an Arabic caller', async () => {
    mockDb();
    const res = await dial('2*1');

    expect(res.text.startsWith('CON ')).toBe(true);
    expect(res.text).toContain(i18n.COUNTY_NAMES_AR['Central Equatoria']);
    expect(res.text).toContain('1. '); // keypad digits stay ASCII
  });

  test('an out-of-range county selection is rejected in the caller language', async () => {
    mockDb();
    const res = await dial('2*1*99');

    expect(res.text).toBe(`END ${i18n.t('ar').invalidCounty}`);
  });
});

describe('checking risk', () => {
  test('reports the forecast in Arabic with the Arabic state name', async () => {
    mockDb({
      user: { id: 7, county_id: 2, language_preference: 'ar' },
      prediction: { predicted_change_pct: '12.5' },
    });
    const res = await dial('2');

    expect(res.text).toBe(`END ${i18n.t('ar').risk(i18n.COUNTY_NAMES_AR.Jonglei, 13)}`);
  });

  test('says so honestly when no forecast exists yet', async () => {
    mockDb({ user: { id: 7, county_id: 2, language_preference: 'ar' } });
    const res = await dial('2');

    expect(res.text).toBe(`END ${i18n.t('ar').noForecast(i18n.COUNTY_NAMES_AR.Jonglei)}`);
  });
});

describe('unsubscribe and language change', () => {
  test('unsubscribing confirms in the subscriber language', async () => {
    const calls = mockDb({ user: { id: 7, county_id: 2, language_preference: 'ar' } });
    const res = await dial('3');

    expect(calls.unsubscribe).toEqual([PHONE]);
    expect(res.text).toBe(`END ${i18n.t('ar').unsubscribed}`);
  });

  test('switching language updates the row and confirms in the NEW language', async () => {
    const calls = mockDb({ user: { id: 7, county_id: 2, language_preference: 'en' } });
    const res = await dial('4*2');

    expect(calls.languageUpdate).toEqual(['ar', PHONE]);
    expect(res.text).toBe(`END ${i18n.t('ar').languageSet}`);
  });

  test('switching back to English works the same way', async () => {
    const calls = mockDb({ user: { id: 7, county_id: 2, language_preference: 'ar' } });
    const res = await dial('4*1');

    expect(calls.languageUpdate).toEqual(['en', PHONE]);
    expect(res.text).toBe(`END ${i18n.t('en').languageSet}`);
  });
});

describe('robustness', () => {
  test('needs no JWT — the gateway posts unauthenticated', async () => {
    mockDb();
    const res = await dial('');

    expect(res.status).toBe(200); // not 401
  });

  test('a database failure ends the session politely, not with a stack trace', async () => {
    query.mockRejectedValue(new Error('connection refused'));
    const res = await dial('');

    expect(res.status).toBe(200);
    expect(res.text).toBe(`END ${i18n.t('en').unavailable}`);
    expect(res.text).not.toContain('connection refused');
  });

  test('an unknown menu choice is rejected in the caller language', async () => {
    mockDb({ user: { id: 7, county_id: 2, language_preference: 'ar' } });
    const res = await dial('8');

    expect(res.text).toBe(`END ${i18n.t('ar').invalidChoice}`);
  });
});
