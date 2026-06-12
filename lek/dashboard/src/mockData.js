// ---------------------------------------------------------------------------
// Lëk Admin Dashboard — MOCK DATA
// ---------------------------------------------------------------------------
// This file is the single source of truth for the DEMO. Everything the UI
// renders comes from here. There are NO backend calls in this phase.
//
// In a future phase, replace the exports below with calls to the real Lëk
// API (e.g. fetch('/api/counties'), fetch('/api/users'), ...). The shapes
// here are intended to mirror what those endpoints will eventually return.
// ---------------------------------------------------------------------------

// Derive a risk level from a predicted change percentage.
//   < 5%   -> low
//   5–15%  -> medium
//   > 15%  -> high
export function riskFromChange(changePercent) {
  if (changePercent > 15) return 'high'
  if (changePercent >= 5) return 'medium'
  return 'low'
}

// --- Counties / Predictions -----------------------------------------------
// The 10 regions of South Sudan, each with a current food price index, the
// predicted change for the next month, and a derived risk level.
const rawCounties = [
  { name: 'Central Equatoria', currentIndex: 142.3, predictedChange: 6.4 },
  { name: 'Eastern Equatoria', currentIndex: 138.7, predictedChange: 19.2 },
  { name: 'Jonglei', currentIndex: 167.5, predictedChange: 22.8 },
  { name: 'Lakes', currentIndex: 129.4, predictedChange: 4.1 },
  { name: 'Northern Bahr el Ghazal', currentIndex: 154.9, predictedChange: 16.7 },
  { name: 'Unity', currentIndex: 171.2, predictedChange: 24.5 },
  { name: 'Upper Nile', currentIndex: 159.8, predictedChange: 11.3 },
  { name: 'Warrap', currentIndex: 146.1, predictedChange: 8.9 },
  { name: 'Western Bahr el Ghazal', currentIndex: 133.6, predictedChange: 3.7 },
  { name: 'Western Equatoria', currentIndex: 125.8, predictedChange: 2.5 },
]

// The month the forecast targets (4 weeks ahead of "now" in the demo).
export const targetMonth = 'July 2026'

export const counties = rawCounties.map((c, i) => ({
  id: i + 1,
  ...c,
  targetMonth,
  riskLevel: riskFromChange(c.predictedChange),
}))

export const highRiskCounties = counties.filter((c) => c.riskLevel === 'high')

// --- Registered users -------------------------------------------------------
// ~25 mock citizens subscribed to SMS warnings.
const userSeeds = [
  ['+211 912 045 118', 'Central Equatoria', '2026-01-14'],
  ['+211 921 387 642', 'Jonglei', '2026-01-22'],
  ['+211 955 712 903', 'Unity', '2026-02-03'],
  ['+211 916 884 271', 'Eastern Equatoria', '2026-02-09'],
  ['+211 928 119 540', 'Lakes', '2026-02-15'],
  ['+211 977 263 815', 'Upper Nile', '2026-02-21'],
  ['+211 913 590 472', 'Warrap', '2026-02-28'],
  ['+211 924 706 138', 'Northern Bahr el Ghazal', '2026-03-04'],
  ['+211 956 831 209', 'Western Equatoria', '2026-03-10'],
  ['+211 918 442 667', 'Western Bahr el Ghazal', '2026-03-13'],
  ['+211 922 175 384', 'Central Equatoria', '2026-03-19'],
  ['+211 979 308 521', 'Jonglei', '2026-03-25'],
  ['+211 915 627 940', 'Unity', '2026-03-30'],
  ['+211 926 853 112', 'Eastern Equatoria', '2026-04-02'],
  ['+211 957 491 768', 'Lakes', '2026-04-08'],
  ['+211 911 736 205', 'Upper Nile', '2026-04-14'],
  ['+211 923 084 657', 'Warrap', '2026-04-19'],
  ['+211 978 562 330', 'Northern Bahr el Ghazal', '2026-04-23'],
  ['+211 917 209 481', 'Western Equatoria', '2026-04-29'],
  ['+211 929 645 873', 'Central Equatoria', '2026-05-05'],
  ['+211 954 318 026', 'Jonglei', '2026-05-11'],
  ['+211 914 877 359', 'Unity', '2026-05-17'],
  ['+211 925 460 712', 'Upper Nile', '2026-05-23'],
  ['+211 976 193 548', 'Northern Bahr el Ghazal', '2026-05-29'],
  ['+211 919 705 264', 'Eastern Equatoria', '2026-06-04'],
]

export const users = userSeeds.map(([phone, county, registered], i) => ({
  id: i + 1,
  phone,
  county,
  language: 'English',
  status: 'active',
  registeredDate: registered,
}))

// --- Alert log --------------------------------------------------------------
// ~15 SMS warnings recently dispatched. Messages are kept under 160 chars.
const alertSeeds = [
  ['+211 955 712 903', 'Unity', 25, 'delivered', '2026-06-10 08:14'],
  ['+211 921 387 642', 'Jonglei', 23, 'delivered', '2026-06-10 08:14'],
  ['+211 916 884 271', 'Eastern Equatoria', 19, 'delivered', '2026-06-10 08:15'],
  ['+211 924 706 138', 'Northern Bahr el Ghazal', 17, 'delivered', '2026-06-10 08:15'],
  ['+211 915 627 940', 'Unity', 25, 'pending', '2026-06-10 08:16'],
  ['+211 979 308 521', 'Jonglei', 23, 'delivered', '2026-06-10 08:16'],
  ['+211 926 853 112', 'Eastern Equatoria', 19, 'failed', '2026-06-10 08:17'],
  ['+211 978 562 330', 'Northern Bahr el Ghazal', 17, 'delivered', '2026-06-10 08:17'],
  ['+211 914 877 359', 'Unity', 25, 'delivered', '2026-06-10 08:18'],
  ['+211 954 318 026', 'Jonglei', 23, 'delivered', '2026-06-10 08:18'],
  ['+211 919 705 264', 'Eastern Equatoria', 19, 'pending', '2026-06-10 08:19'],
  ['+211 976 193 548', 'Northern Bahr el Ghazal', 17, 'delivered', '2026-06-10 08:19'],
  ['+211 977 263 815', 'Upper Nile', 11, 'delivered', '2026-05-12 09:02'],
  ['+211 911 736 205', 'Upper Nile', 11, 'failed', '2026-05-12 09:02'],
  ['+211 913 590 472', 'Warrap', 9, 'delivered', '2026-05-12 09:03'],
]

export const alerts = alertSeeds.map(([phone, county, change, status, sentAt], i) => ({
  id: i + 1,
  phone,
  county,
  message: `LEK ALERT: Food prices in ${county} may rise ~${change}% in 4 weeks. Plan ahead & stock essentials.`,
  channel: 'SMS',
  status,
  sentAt,
}))

// --- Price index history + forecast ----------------------------------------
// National average food price index over the last 6 months plus a forecast
// point for the target month. `forecast` is null on historical months and
// `index` is null on the forecast month so the chart can colour them apart.
export const priceHistory = [
  { month: 'Jan 2026', index: 128.4, forecast: null },
  { month: 'Feb 2026', index: 132.1, forecast: null },
  { month: 'Mar 2026', index: 137.9, forecast: null },
  { month: 'Apr 2026', index: 141.6, forecast: null },
  { month: 'May 2026', index: 146.8, forecast: null },
  { month: 'Jun 2026', index: 149.2, forecast: 149.2 },
  { month: 'Jul 2026', index: null, forecast: 167.5 },
]

// --- Trained model ----------------------------------------------------------
// Real values, copied from ml-service/models/model_metadata.json. The selected
// model is ARIMA; it forecasts the NATIONAL food price index one month ahead.
export const modelInfo = {
  versionName: 'v1_arima_20260610',
  algorithm: 'ARIMA',
  trainedOn: '10 Jun 2026',
  trainingRange: '2008–2024',
  rmse: 1.2,
  mape: 2.39,
  r2: 0.88,
}

// --- National forecast (the model's real output) ---------------------------
// The model predicts a single national index for the target month. Derived
// from priceHistory so it always matches the trend chart.
const lastKnown = priceHistory.filter((p) => p.index != null).at(-1)
const forecastPoint = priceHistory.filter((p) => p.forecast != null).at(-1)
export const nationalForecast = {
  targetMonth,
  currentIndex: lastKnown.index,
  forecastIndex: forecastPoint.forecast,
  changePercent: Number(
    (((forecastPoint.forecast - lastKnown.index) / lastKnown.index) * 100).toFixed(1),
  ),
}

// --- Summary statistics -----------------------------------------------------
export const summaryStats = {
  totalUsers: users.length,
  regionsTracked: counties.length,
  alertsSentThisMonth: alerts.filter((a) => a.sentAt.startsWith('2026-06')).length,
  countiesAtHighRisk: highRiskCounties.length,
}
