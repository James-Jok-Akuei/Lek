import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { RiskBadge } from '../components/Badge'
import { useAsync, getCounties, getNationalForecast } from '../api'

const RISK_ORDER = { high: 3, medium: 2, low: 1 }

// Risk thresholds — Low below 5%, Medium 5–15%, High above 15%.
function riskFromPct(pct) {
  const n = Number(pct)
  if (n > 15) return 'high'
  if (n >= 5) return 'medium'
  return 'low'
}

// Load the 10 states' figures + the single national forecast in one go.
async function loadPredictions() {
  const [states, national] = await Promise.all([getCounties(), getNationalForecast()])
  return { states, national }
}

// --- National forecast hero ------------------------------------------------
// The model produces ONE national figure; this card is the page's focal point.
function NationalForecastCard({ national }) {
  const level = riskFromPct(national.changePercent)
  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-cream px-8 py-7 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-medium text-ink-soft">
          National Food Price Forecast · {national.targetMonth}
        </p>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="tnum text-5xl font-extrabold tracking-tight text-ink">
            +{national.changePercent}%
          </span>
          <span className="text-sm text-ink-soft">
            index {national.currentIndex} → {national.forecastIndex}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">Predicted change in the national food price index, four weeks ahead.</p>
      </div>

      <div className="shrink-0 rounded-2xl bg-surface px-5 py-4 lg:text-right">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Risk level</p>
        <div className="mt-2 lg:justify-end lg:flex">
          <span className="text-lg font-semibold">
            <RiskBadge level={level} />
          </span>
        </div>
      </div>
    </section>
  )
}

export default function Predictions() {
  // Sort by risk level; toggle high→low / low→high.
  const [sortDesc, setSortDesc] = useState(true)
  const { data, loading, error } = useAsync(loadPredictions)

  if (loading) return <p className="py-20 text-center text-muted">Loading predictions…</p>
  if (error) return <p className="py-20 text-center text-bad">Could not load predictions.</p>

  const { states, national } = data
  const rows = [...(states || [])].sort((a, b) => {
    const diff = RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel]
    return sortDesc ? diff : -diff
  })

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Predictions</h1>
        <p className="mt-1 text-sm text-muted">
          The trained model forecasts the{' '}
          <span className="font-medium text-ink-soft">national</span> food price index one
          month ahead.
        </p>
      </header>

      <NationalForecastCard national={national} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface p-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">By State</h2>
          <span
            title="Illustrative — the model forecasts the national index; per-state forecasting is planned."
            className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted"
          >
            State estimates
          </span>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          All states currently reflect the national forecast; per-state models are planned
          for future work.
        </p>

        <div className="mt-5 min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-khaki text-left text-[13px] font-semibold text-ink-soft">
                <th className="rounded-l-xl px-6 py-3.5">State</th>
                <th className="px-6 py-3.5 text-right">Current Index</th>
                <th className="px-6 py-3.5 text-right">Predicted Change</th>
                <th className="px-6 py-3.5">Target Month</th>
                <th className="rounded-r-xl px-6 py-3.5">
                  <button
                    onClick={() => setSortDesc((v) => !v)}
                    className="inline-flex items-center gap-1 font-semibold transition hover:text-ink"
                    title="Sort by risk level"
                  >
                    Risk
                    <ChevronsUpDown size={13} strokeWidth={1.8} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 transition-colors hover:bg-canvas/60">
                  <td className="h-14 px-6 font-medium text-ink">{c.name}</td>
                  <td className="tnum h-14 px-6 text-right text-ink-soft">{c.currentIndex.toFixed(1)}</td>
                  {/* De-emphasised: every state shares the national figure by design. */}
                  <td className="h-14 px-6 text-right">
                    <span className="tnum text-muted">+{c.predictedChange.toFixed(1)}%</span>
                    <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-faint">nat'l</span>
                  </td>
                  <td className="h-14 px-6 text-ink-soft">{c.targetMonth}</td>
                  <td className="h-14 px-6">
                    <RiskBadge level={c.riskLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-faint">
        Risk thresholds — Low below 5%, Medium 5–15%, High above 15%.
      </p>
    </div>
  )
}
