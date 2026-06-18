// ---------------------------------------------------------------------------
// Lëk dashboard — API client
// ---------------------------------------------------------------------------
// Talks to the Express backend (which proxies the FastAPI ml-service). Handles
// the JWT, attaches it to every request, and returns UI-ready shapes so the
// pages stay simple. Base URL is overridable via VITE_API_URL for deployment.
// ---------------------------------------------------------------------------
import { useEffect, useState } from 'react'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const TOKEN_KEY = 'lek_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
export const isAuthed = () => Boolean(getToken())

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail.error || `${path} ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

// --- auth ---
export async function login(username, password) {
  const data = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(data.token)
  return data
}
export const logout = () => clearToken()

// --- raw fetchers ---
export const getCounties = () => req('/counties')
export const getPredictions = () => req('/predictions')
export const getUsers = () => req('/users')
export const getAlerts = () => req('/alerts')
export const getStats = () => req('/stats')
export const runAlerts = () => req('/alerts/run', { method: 'POST' })
export const registerUser = (body) =>
  req('/users/register', { method: 'POST', body: JSON.stringify(body) })

// --- shaped fetchers ---
function monthLabel(d) {
  return d ? new Date(d).toLocaleString('en-US', { month: 'long', year: 'numeric' }) : ''
}

export async function getModelInfo() {
  const m = await req('/model')
  const algo = (m.version_name?.split('_')[1] || 'model').toUpperCase()
  const r = m.training_data_range || {}
  return {
    versionName: m.version_name,
    algorithm: algo,
    trainedOn: m.trained_at
      ? new Date(m.trained_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '',
    trainingRange: r.start_date ? `${r.start_date.slice(0, 4)}–${r.end_date.slice(0, 4)}` : '',
    rmse: Number(m.rmse)?.toFixed(2),
    mape: Number(m.mape)?.toFixed(2),
    r2: Number(m.r2_score)?.toFixed(2),
  }
}

export async function getNationalForecast() {
  const f = await req('/forecast')
  return {
    targetMonth: monthLabel(f.target_month),
    currentIndex: f.current_index,
    forecastIndex: f.forecast_index,
    changePercent: f.predicted_change_pct,
  }
}

// Everything the Overview page needs, in one parallel load.
export async function loadOverview() {
  const [counties, stats, alerts, modelInfo, nationalForecast] = await Promise.all([
    getCounties(), getStats(), getAlerts(), getModelInfo(), getNationalForecast(),
  ])
  return {
    counties,
    highRiskCounties: counties.filter((c) => c.riskLevel === 'high'),
    stats,
    alerts: alerts.slice(0, 8),
    modelInfo,
    nationalForecast,
  }
}

// --- tiny async hook: { data, loading, error } ---
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  useEffect(() => {
    let alive = true
    // Keep any existing data visible during a refetch (no flicker); resolve below.
    Promise.resolve(fn())
      .then((data) => alive && setState({ loading: false, error: null, data }))
      .catch((error) => alive && setState({ loading: false, error, data: null }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return state
}
