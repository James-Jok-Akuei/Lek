// Unit tests: bilingual subscriber messaging (src/i18n.js) and the SMS segment
// limits that Arabic depends on. The DB, config and SMS client are mocked.
jest.mock('../src/config', () => ({
  africasTalking: { username: 'sandbox', apiKey: '', shortcode: '' },
}));
jest.mock('../src/db/pool', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ id: 1 }] }),
  pool: { end: jest.fn() },
}));

const i18n = require('../src/i18n');
const smsService = require('../src/services/smsService');
const { composeWarning } = require('../src/services/alertEngine');

const COUNTIES = Object.keys(i18n.COUNTY_NAMES_AR);

describe('language normalisation', () => {
  test('accepts the two supported languages', () => {
    expect(i18n.normalizeLanguage('en')).toBe('en');
    expect(i18n.normalizeLanguage('ar')).toBe('ar');
  });

  test('falls back to English for unknown, null or missing values', () => {
    expect(i18n.normalizeLanguage('fr')).toBe('en');
    expect(i18n.normalizeLanguage(null)).toBe('en');
    expect(i18n.normalizeLanguage(undefined)).toBe('en');
  });
});

describe('county names', () => {
  test('translates every seeded state into Arabic', () => {
    for (const c of COUNTIES) {
      expect(i18n.countyName(c, 'ar')).not.toBe(c);
    }
  });

  test('leaves names untouched in English', () => {
    expect(i18n.countyName('Jonglei', 'en')).toBe('Jonglei');
  });

  test('falls back to the English name for an unmapped state', () => {
    expect(i18n.countyName('Atlantis', 'ar')).toBe('Atlantis');
  });
});

describe('composeWarning', () => {
  test('defaults to English and mentions county and rounded percentage', () => {
    const msg = composeWarning('Jonglei', 17.4);
    expect(msg).toContain('Jonglei');
    expect(msg).toContain('17%');
  });

  test('writes the Arabic warning with the Arabic state name', () => {
    const msg = composeWarning('Jonglei', 17.4);
    const ar = composeWarning('Jonglei', 17.4, 'ar');
    expect(ar).not.toBe(msg);
    expect(ar).toContain(i18n.COUNTY_NAMES_AR.Jonglei);
    expect(ar).toContain('17%');
    expect(ar).not.toContain('Jonglei'); // the Latin name must not leak through
  });

  test('an unknown language falls back to English rather than failing', () => {
    expect(composeWarning('Lakes', 12, 'fr')).toBe(composeWarning('Lakes', 12, 'en'));
  });

  // The reason the Arabic wording is shorter than the English one.
  test('every English warning fits one 160-char GSM-7 segment', () => {
    for (const c of COUNTIES) {
      for (const pct of [5, 17, 100]) {
        expect(composeWarning(c, pct, 'en').length).toBeLessThanOrEqual(smsService.MAX_LEN);
      }
    }
  });

  test('every Arabic warning fits one 70-char UCS-2 segment', () => {
    for (const c of COUNTIES) {
      for (const pct of [5, 17, 100]) {
        const msg = composeWarning(c, pct, 'ar');
        expect(msg.length).toBeLessThanOrEqual(smsService.MAX_LEN_UNICODE);
        // And it must survive clamping untouched — no mid-word truncation.
        expect(smsService.clamp(msg)).toBe(msg);
      }
    }
  });
});

describe('SMS segment limits', () => {
  test('detects Arabic script as unicode and ASCII as GSM-7', () => {
    expect(smsService.isUnicodeMessage('LEK ALERT: prices may rise')).toBe(false);
    expect(smsService.isUnicodeMessage('تنبيه ليك')).toBe(true);
  });

  test('clamps ASCII at 160 but unicode at 70', () => {
    expect(smsService.clamp('x'.repeat(400))).toHaveLength(160);
    expect(smsService.clamp('ت'.repeat(400))).toHaveLength(70);
  });

  test('short messages of either alphabet pass through unchanged', () => {
    expect(smsService.clamp('  hello  ')).toBe('hello');
    expect(smsService.clamp('  مرحبا  ')).toBe('مرحبا');
  });
});

describe('USSD menu strings', () => {
  test('both main menus stay inside the ~182-char USSD screen limit', () => {
    for (const lang of i18n.LANGUAGES) {
      expect(i18n.t(lang).mainMenu.length).toBeLessThanOrEqual(182);
    }
  });

  test('menu options are ASCII digits in both languages, so keypads match', () => {
    for (const lang of i18n.LANGUAGES) {
      for (const n of ['1.', '2.', '3.', '4.']) {
        expect(i18n.t(lang).mainMenu).toContain(n);
      }
    }
  });

  test('the language chooser carries both languages, since it precedes the choice', () => {
    expect(i18n.CHOOSE_LANGUAGE).toContain('English');
    expect(i18n.CHOOSE_LANGUAGE).toContain('العربية');
  });
});
