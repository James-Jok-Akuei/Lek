import { useState } from 'react'
import { RefreshCw, Send, X } from 'lucide-react'
import { StatusBadge } from '../components/Badge'
import { useAsync, getAlerts, getCounties, runAlerts, sendTestAlert } from '../api'

// Send one sample warning SMS to any number, for demos/pilots (POST /api/alerts/test).
function TestAlertModal({ open, onClose, counties, onSent }) {
  const [phone, setPhone] = useState('+211 9')
  const [county, setCounty] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)
  if (!open) return null

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setSending(true)
    try {
      const res = await sendTestAlert({
        phone_number: phone.replace(/\s+/g, ''),
        county: county || undefined,
      })
      setResult(res)
      onSent() // refresh the alert log behind the modal
    } catch (e2) {
      setErr(e2.message || 'Could not send test alert')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl bg-surface p-7">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Send test alert</h2>
            <p className="mt-0.5 text-sm text-muted">Send one sample warning SMS to a number.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition hover:bg-canvas hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">Phone number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
              placeholder="+211 9XX XXX XXX"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-medium text-ink-soft">State (optional)</label>
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-sm outline-none transition focus:border-forest/40 focus:ring-2 focus:ring-forest/10"
            >
              <option value="">Sample state</option>
              {counties.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {err && <p className="text-sm font-medium text-bad">{err}</p>}
          {result && (
            <div className="rounded-xl bg-mint/40 px-4 py-3 text-sm text-ink">
              <p className="font-medium">
                Sent to <span className="tnum">{result.result?.phoneNumber}</span> · {result.result?.status}
                {result.result?.simulated ? ' (simulated)' : ' (live)'}
              </p>
              <p className="mt-1 text-[13px] text-ink-soft">{result.message}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line-strong px-5 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas"
            >
              {result ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
            >
              <Send size={15} strokeWidth={2} />
              {sending ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Alerts() {
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const { data, loading, error } = useAsync(getAlerts, [tick])
  const { data: countiesData } = useAsync(getCounties)
  const counties = countiesData || []
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
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setTestOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-line-strong px-5 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-canvas"
          >
            <Send size={16} strokeWidth={2} />
            Send test alert
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
          >
            <RefreshCw size={16} strokeWidth={2} className={running ? 'animate-spin' : ''} />
            {running ? 'Running…' : 'Run alert check'}
          </button>
        </div>
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
                <th className="px-6 py-3.5">State</th>
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

      <TestAlertModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        counties={counties}
        onSent={() => setTick((t) => t + 1)}
      />
    </div>
  )
}
