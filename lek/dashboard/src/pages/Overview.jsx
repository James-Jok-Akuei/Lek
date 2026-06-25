import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { StatusBadge } from '../components/Badge'
import { useAsync, loadOverview } from '../api'

// --- National forecast + real model status ---------------------------------
// The model forecasts ONE national index a month ahead; this banner shows that
// real output and the facts of the trained model behind it.
function ForecastBanner({ modelInfo, nationalForecast }) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl bg-cream px-8 py-7 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm font-medium text-ink-soft">
          National food-price forecast · {nationalForecast.targetMonth}
        </p>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="tnum text-5xl font-extrabold tracking-tight text-ink">
            +{nationalForecast.changePercent}%
          </span>
          <span className="text-sm text-ink-soft">
            index {nationalForecast.currentIndex} → {nationalForecast.forecastIndex}
          </span>
        </div>
      </div>

      <div className="lg:text-right">
        <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink">
          <span className="h-2 w-2 rounded-full bg-good" />
          {modelInfo.algorithm} model · {modelInfo.versionName}
        </span>
        <p className="mt-2.5 text-xs text-muted">
          R² {modelInfo.r2} · MAPE {modelInfo.mape}% · RMSE {modelInfo.rmse} · trained{' '}
          {modelInfo.trainedOn} on {modelInfo.trainingRange} data
        </p>
      </div>
    </div>
  )
}

// --- Stat tiles -------------------------------------------------------------
function StatTile({ tone, label, value, suffix }) {
  return (
    <div className={`rounded-3xl px-7 py-6 ${tone}`}>
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="tnum text-4xl font-extrabold tracking-tight text-ink">{value}</span>
        {suffix && <span className="text-sm text-ink-soft">{suffix}</span>}
      </p>
    </div>
  )
}

function StatTiles({ stats }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-3xl bg-forest px-7 py-6">
        <p className="text-sm font-medium text-white/70">Alerts Sent</p>
        <p className="mt-6 flex items-baseline gap-1.5">
          <span className="tnum text-4xl font-extrabold tracking-tight text-white">
            {stats.alertsSentThisMonth}
          </span>
          <span className="text-sm text-white/70">this month</span>
        </p>
      </div>
      <StatTile tone="bg-mint" label="Registered Users" value={stats.totalUsers} />
      <StatTile tone="bg-lilac" label="Regions Tracked" value={stats.regionsTracked} />
      <StatTile
        tone="bg-sand"
        label="States at High Risk"
        value={stats.countiesAtHighRisk}
        suffix="of 10 regions"
      />
    </div>
  )
}

// Small tag marking state-level figures as illustrative estimates.
function EstimateTag() {
  return (
    <span
      title="Illustrative — the model forecasts the national index; per-state forecasting is planned."
      className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted"
    >
      State estimates
    </span>
  )
}

// --- Forecasts (tabs + carousel) -------------------------------------------
const PAGE = 2
const RISK_LABEL = { high: 'High risk', medium: 'Watch', low: 'Stable' }
const RISK_DOT = { high: 'bg-bad', medium: 'bg-warn', low: 'bg-good' }
const RISK_TEXT = { high: 'text-bad', medium: 'text-warn', low: 'text-good' }

function ForecastsPanel({ counties, highRiskCounties }) {
  const [tab, setTab] = useState('risk')
  const [page, setPage] = useState(0)

  const list = tab === 'risk' ? highRiskCounties : counties
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const safePage = Math.min(page, pages - 1)
  const shown = list.slice(safePage * PAGE, safePage * PAGE + PAGE)

  function switchTab(next) {
    setTab(next)
    setPage(0)
  }

  return (
    <section className="rounded-3xl bg-surface p-7">
      <div className="flex items-center justify-between border-b border-line">
        <div className="flex items-center gap-7">
          {[
            ['risk', 'At Risk'],
            ['all', 'All Regions'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`relative -mb-px pb-3 text-base transition-colors ${
                tab === key ? 'font-semibold text-forest' : 'font-medium text-muted hover:text-ink'
              }`}
            >
              {label}
              {tab === key && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-forest" />
              )}
            </button>
          ))}
        </div>
        <EstimateTag />
      </div>

      <p className="mt-4 text-[13px] text-muted">
        All states currently reflect the national forecast; per-state models are planned for
        future work.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {shown.map((c) => (
          <div key={c.id} className="rounded-2xl border border-line p-4">
            <p className="text-[15px] font-semibold leading-snug text-ink">{c.name}</p>
            <div className="mt-3 inline-flex rounded-lg border border-line px-3 py-1.5 text-xs text-ink-soft">
              Target · {c.targetMonth}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${RISK_TEXT[c.riskLevel]}`}>
                <span className={`h-2 w-2 rounded-full ${RISK_DOT[c.riskLevel]}`} />
                {RISK_LABEL[c.riskLevel]}
              </span>
              <span className="tnum text-sm font-semibold text-ink">+{c.predictedChange}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-ink-soft transition hover:bg-canvas disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={safePage >= pages - 1}
            className="grid h-8 w-8 place-items-center rounded-full border border-line-strong text-ink-soft transition hover:bg-canvas disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
          <div className="ml-2 flex items-center gap-1.5">
            {Array.from({ length: pages }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === safePage ? 'w-5 bg-forest' : 'w-1.5 bg-line-strong'
                }`}
              />
            ))}
          </div>
        </div>
        <Link
          to="/dashboard/predictions"
          className="text-sm font-medium text-forest hover:underline"
        >
          View All
        </Link>
      </div>
    </section>
  )
}

// --- Risk by region (performance table) ------------------------------------
const BAR_FILL = { high: 'bg-bad/35', medium: 'bg-warn/35', low: 'bg-good/35' }

function PerformancePanel({ counties }) {
  const ranked = [...counties]
    .sort((a, b) => b.predictedChange - a.predictedChange)
    .slice(0, 5)
  const max = Math.max(...ranked.map((c) => c.predictedChange))

  return (
    <section className="rounded-3xl bg-surface p-7">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Risk by Region</h2>
        <EstimateTag />
      </div>
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-left text-[13px] font-semibold text-muted">
            <th className="pb-3 font-semibold">#</th>
            <th className="pb-3 font-semibold">Region</th>
            <th className="pb-3 font-semibold">Predicted change</th>
            <th className="pb-3 text-right font-semibold">Index</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((c, i) => (
            <tr key={c.id} className="align-middle">
              <td className="tnum py-3 pr-2 text-muted">{String(i + 1).padStart(2, '0')}</td>
              <td className="py-3 pr-4 font-medium text-ink">{c.name}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-canvas">
                    <div
                      className={`h-full rounded-md ${BAR_FILL[c.riskLevel]}`}
                      style={{ width: `${(c.predictedChange / max) * 100}%` }}
                    />
                  </div>
                  <span className="tnum w-12 text-right text-ink-soft">+{c.predictedChange}%</span>
                </div>
              </td>
              <td className="tnum py-3 text-right font-medium text-ink">{c.currentIndex}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// --- Recent alerts (orders-style table) ------------------------------------
function RecentAlerts({ alerts }) {
  const rows = alerts

  return (
    <section className="rounded-3xl bg-surface p-7">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">Recent Alerts</h2>
        <Link to="/dashboard/alerts" className="text-sm font-medium text-forest hover:underline">
          View All
        </Link>
      </div>

      <div className="mt-6 max-h-80 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="rounded-xl bg-khaki text-left text-[13px] font-semibold text-ink-soft">
              <th className="rounded-l-xl px-5 py-3.5">Recipient</th>
              <th className="px-5 py-3.5">State</th>
              <th className="px-5 py-3.5">Sent</th>
              <th className="rounded-r-xl px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="tnum px-5 py-4 font-medium text-ink">{a.phone}</td>
                <td className="px-5 py-4 text-ink-soft">{a.county}</td>
                <td className="tnum px-5 py-4 text-ink-soft">
                  {new Date(a.sentAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function Overview() {
  const { data, loading, error } = useAsync(loadOverview)

  if (loading) {
    return <p className="py-20 text-center text-muted">Loading dashboard…</p>
  }
  if (error) {
    return (
      <p className="py-20 text-center text-bad">
        Could not load data. Is the backend running on :3000 and the ml-service on :8000?
      </p>
    )
  }

  const { counties, highRiskCounties, stats, alerts, modelInfo, nationalForecast } = data
  return (
    <div className="space-y-6">
      <ForecastBanner modelInfo={modelInfo} nationalForecast={nationalForecast} />
      <StatTiles stats={stats} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ForecastsPanel counties={counties} highRiskCounties={highRiskCounties} />
        <PerformancePanel counties={counties} />
      </div>
      <RecentAlerts alerts={alerts} />
    </div>
  )
}
