// Risk and status indicators: a small muted dot + plain label. No big pills.

const RISK_DOT = {
  low: 'bg-good',
  medium: 'bg-warn',
  high: 'bg-bad',
}

const RISK_TEXT = {
  low: 'text-good',
  medium: 'text-warn',
  high: 'text-bad',
}

export function RiskBadge({ level }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm capitalize">
      <span className={`h-2 w-2 rounded-full ${RISK_DOT[level]}`} />
      <span className={`font-medium ${RISK_TEXT[level]}`}>{level}</span>
    </span>
  )
}

const STATUS_DOT = {
  delivered: 'bg-good',
  pending: 'bg-warn',
  failed: 'bg-bad',
  active: 'bg-good',
}

const STATUS_TEXT = {
  delivered: 'text-good',
  pending: 'text-warn',
  failed: 'text-bad',
  active: 'text-good',
}

export function StatusBadge({ status }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm capitalize">
      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] ?? 'bg-faint'}`} />
      <span className={`font-medium ${STATUS_TEXT[status] ?? 'text-muted'}`}>{status}</span>
    </span>
  )
}
