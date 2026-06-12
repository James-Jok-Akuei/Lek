import { useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { RiskBadge } from '../components/Badge'
import { counties } from '../mockData'

const RISK_ORDER = { high: 3, medium: 2, low: 1 }

export default function Predictions() {
  // Sort by risk level; toggle high→low / low→high.
  const [sortDesc, setSortDesc] = useState(true)

  const rows = [...counties].sort((a, b) => {
    const diff = RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel]
    return sortDesc ? diff : -diff
  })

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Predictions</h1>
          <span
            title="Illustrative — the model forecasts the national index; per-county forecasting is planned."
            className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted"
          >
            County estimates
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          Estimated food-price change per region, four weeks ahead. The trained
          model forecasts the <span className="font-medium text-ink-soft">national</span>{' '}
          index; these per-county figures are illustrative until per-county
          forecasting is built.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface p-7">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-khaki text-left text-[13px] font-semibold text-ink-soft">
                <th className="rounded-l-xl px-6 py-3.5">County</th>
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
                  <td className="tnum h-14 px-6 text-right font-medium text-ink-soft">+{c.predictedChange.toFixed(1)}%</td>
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
