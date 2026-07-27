// Bilingual strings for the SUBSCRIBER-facing channels (USSD menus + alert SMS).
// The admin dashboard stays English-only — this is for basic handsets.
//
// Two rules hold everything together:
//   1. Menu numbers stay ASCII digits in both languages. The subscriber presses a
//      keypad key, so "1" must be "1" whatever the script.
//   2. Arabic text is sent as UCS-2, where ONE SMS segment is 70 characters, not
//      160. Every Arabic string below is written to fit; alertEngine has a test
//      asserting the warning fits for all ten state names.

const LANGUAGES = ['en', 'ar'];
const DEFAULT_LANGUAGE = 'en';

// Keypad key -> language, used by the USSD chooser.
const LANGUAGE_BY_KEY = { 1: 'en', 2: 'ar' };

// Shown before we know the caller's language, so it carries both.
const CHOOSE_LANGUAGE = 'Choose language / اختر اللغة\n1. English\n2. العربية';

// State names in Arabic. Kept here rather than in the database so no migration
// is needed; falls back to the English name if a state is ever missing.
const COUNTY_NAMES_AR = {
  'Central Equatoria': 'وسط الاستوائية',
  'Eastern Equatoria': 'شرق الاستوائية',
  Jonglei: 'جونقلي',
  Lakes: 'البحيرات',
  'Northern Bahr el Ghazal': 'شمال بحر الغزال',
  Unity: 'الوحدة',
  'Upper Nile': 'أعالي النيل',
  Warrap: 'واراب',
  'Western Bahr el Ghazal': 'غرب بحر الغزال',
  'Western Equatoria': 'غرب الاستوائية',
};

const STRINGS = {
  en: {
    mainMenu: 'Welcome to Lek Food Price Alerts\n'
      + '1. Register for alerts\n'
      + '2. Check my county risk\n'
      + '3. Unsubscribe\n'
      + '4. Change language',
    selectCounty: 'Select your county:',
    registered: (county) => `You are registered for alerts in ${county}.`,
    invalidCounty: 'Invalid county selection.',
    noForecast: (county) => `${county}: no forecast available yet.`,
    risk: (county, pct) => `${county}: food prices may change ~${pct}% next month.`,
    unsubscribed: 'You have unsubscribed from Lek alerts.',
    invalidChoice: 'Invalid choice. Please dial again.',
    unavailable: 'Service temporarily unavailable. Please try again later.',
    languageSet: 'Language set to English.',
    // 108 chars — comfortably inside one 160-char GSM-7 segment.
    warning: (county, pct) =>
      `LEK ALERT: Food prices in ${county} may rise ~${pct}% in 4 weeks. `
      + 'Plan ahead. Reply STOP to opt out.',
  },

  ar: {
    mainMenu: 'مرحبا بك في تنبيهات ليك لأسعار الغذاء\n'
      + '1. التسجيل في التنبيهات\n'
      + '2. حالة الخطر في ولايتي\n'
      + '3. إلغاء الاشتراك\n'
      + '4. تغيير اللغة',
    selectCounty: 'اختر ولايتك:',
    registered: (county) => `تم تسجيلك لتلقي التنبيهات في ${county}.`,
    invalidCounty: 'اختيار الولاية غير صحيح.',
    noForecast: (county) => `${county}: لا توجد توقعات بعد.`,
    risk: (county, pct) => `${county}: قد تتغير أسعار الغذاء بنحو ${pct}% الشهر القادم.`,
    unsubscribed: 'تم إلغاء اشتراكك في تنبيهات ليك.',
    invalidChoice: 'اختيار غير صحيح. يرجى الاتصال مرة أخرى.',
    unavailable: 'الخدمة غير متاحة مؤقتا. حاول لاحقا.',
    languageSet: 'تم اختيار اللغة العربية.',
    // Must fit 70 UCS-2 characters INCLUDING the longest state name, so it says
    // "within a month" rather than "in 4 weeks" and omits the STOP line — the
    // USSD menu (option 3) is the Arabic unsubscribe path.
    warning: (county, pct) =>
      `تنبيه ليك: أسعار الغذاء في ${county} قد ترتفع ${pct}% خلال شهر.`,
  },
};

// Normalise anything stored in users.language_preference to a supported code.
function normalizeLanguage(lang) {
  return LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
}

// The string table for a language, always falling back to English.
function t(lang) {
  return STRINGS[normalizeLanguage(lang)];
}

// A state's name in the subscriber's language.
function countyName(englishName, lang) {
  if (normalizeLanguage(lang) !== 'ar') return englishName;
  return COUNTY_NAMES_AR[englishName] || englishName;
}

module.exports = {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_BY_KEY,
  CHOOSE_LANGUAGE,
  COUNTY_NAMES_AR,
  normalizeLanguage,
  t,
  countyName,
};
