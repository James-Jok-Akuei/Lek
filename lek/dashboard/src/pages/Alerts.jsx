import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { StatusBadge } from '../components/Badge'
import { useAsync, getAlerts, runAlerts } from '../api'

export default function Alerts() {
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const { data, loading, error } = useAsync(getAlerts, [tick])
  const alerts = data || []

  const counts = alerts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  const summary = [
    { label: 'Total sent', value: alerts.length, dot: 'bg-faint' },
    { label: 'Sent', value: counts.sent ?? 0, dot: 'bg-good' },
    { label: 'Pending', value: counts.pending ?? 0, dot: 'bg-warn' },
    { label: 'Failed', value: counts.failed ?? 0, dot: 'bg-bad' },
  ]

  // Trigger a fresh prediction + alert run on the backend, then reload the log.
  async function handleRun() {
    setRunning(true)
    try {
      await runAlerts()
    } finally {
      setRunning(false)
      setTick((t) => t + 1)
    }
  }

  if (loading) return <p className="py-20 text-center text-muted">Loading alerts…</p>
  if (error) return <p className="py-20 text-center text-bad">Could not load alerts.</p>

  return (
    <div className="flex h-[calc(100vh-130px)] flex-col space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Alerts</h1>
          <p className="mt-1 text-sm text-muted">SMS price warnings dispatched to subscribers.</p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="inline-flex items-center gap-2 self-start rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw size={16} strokeWidth={2} className={running ? 'animate-spin' : ''} />
          {running ? 'Running…' : 'Run alert check'}
        </button>
      </header>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {summary.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className="tnum text-sm font-semibold text-ink">{s.value}</span>
            <span className="text-[13px] text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface p-7">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-khaki text-left text-[13px] font-semibold text-ink-soft">
                <th className="rounded-l-xl px-6 py-3.5">Phone Number</th>
                <th className="px-6 py-3.5">County</th>
                <th className="px-6 py-3.5 min-w-[24rem]">Message</th>
                <th className="px-6 py-3.5">Channel</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="rounded-r-xl px-6 py-3.5">Sent At</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-line last:border-0 align-middle transition-colors hover:bg-canvas/60">
                  <td className="tnum px-6 py-4 font-medium text-ink whitespace-nowrap">{a.phone}</td>
                  <td className="px-6 py-4 text-ink-soft whitespace-nowrap">{a.county}</td>
                  <td className="px-6 py-4 text-ink-soft">{a.message}</td>
                  <td className="px-6 py-4 text-muted">{a.channel}</td>
                  <td className="px-6 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="tnum px-6 py-4 text-ink-soft whitespace-nowrap">
                    {new Date(a.sentAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
