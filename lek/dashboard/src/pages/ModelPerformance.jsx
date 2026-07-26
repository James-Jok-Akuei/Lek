import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useAsync, loadModelPerformance } from '../api'

// Theme tokens (index.css) — recharts needs literal colours, not Tailwind classes.
const C = {
  forest: '#1f352c',
  terra: '#bf6a3a',
  gold: '#e6b53e',
  good: '#2e7d5b',
  muted: '#7a7a72',
  faint: '#a6a69d',
  line: '#ededE8',
}

// --- formatting -------------------------------------------------------------
const dash = '—'

function fmt(n, digits = 3) {
  return n === null || n === undefined || Number.isNaN(Number(n))
    ? dash
    : Number(n).toFixed(digits)
}

function pct(n, digits = 2) {
  return n === null || n === undefined || Number.isNaN(Number(n))
    ? dash
    : `${Number(n).toFixed(digits)}%`
}

// "2025-02-01" -> "Feb 2025". Parsed from the string parts on purpose: passing a
// date-only string to new Date() reads it as UTC and can slip a month backwards
// for viewers in negative-offset timezones.
function monthLabelFromISO(s) {
  if (typeof s !== 'string') return ''
  const [y, m] = s.split('-')
  const i = Number(m) - 1
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return names[i] ? `${names[i]} ${y}` : s
}

// Timestamps from Postgres (prediction_date) round-trip correctly through the
// browser's own locale, unlike the date-only strings above.
function dayLabel(ts) {
  return ts ? new Date(ts).toLocaleDateString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : ''
}

// Drop the trailing YYYYMMDD stamp so axis labels stay readable.
const shortVersion = (name) => (name || '').replace(/_\d{8}$/, '') || dash

// --- shared chrome ----------------------------------------------------------
function Card({ title, children, aside }) {
  return (
    <section className="rounded-3xl bg-surface p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

// Every chart states where its numbers came from and what period they cover.
function Caption({ children }) {
  return <p className="mt-4 text-xs leading-relaxed text-faint">{children}</p>
}

// Marks a chart as offline evaluation so it can never be read as live accuracy.
function BacktestTag() {
  return (
    <span
      title="Offline evaluation on held-out data — not a measurement of live prediction accuracy."
      className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted"
    >
      Backtest · held-out data
    </span>
  )
}

function EmptyState({ children, error }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center">
      <p className="text-sm text-muted">{children}</p>
      {error && (
        <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-faint">{error}</p>
      )}
    </div>
  )
}

// Say what actually failed. A 404 on a route that exists in the source almost
// always means the running process predates the code, so name that directly
// rather than blaming the database or the model.
function explain(message) {
  if (!message) return null
  if (/\b404\b/.test(message)) {
    return `${message} — this endpoint is missing from the running server, which usually ` +
      'means the backend process started before this feature was added. Restart it.'
  }
  if (/unauthorized/i.test(message)) return 'Your session expired — sign in again.'
  if (/failed to fetch|networkerror/i.test(message)) {
    return `${message} — the backend could not be reached. Is it running on :3000?`
  }
  return message
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 12,
    border: `1px solid ${C.line}`,
    fontSize: 12,
    fontFamily: 'inherit',
  },
}
const axisStyle = { tick: { fontSize: 11, fill: C.muted }, stroke: C.line }

// --- A. accuracy by model version ------------------------------------------
// One plain sentence about the active version versus the one before it, built
// only from values that actually exist. Regressions are stated, not hidden.
function versionComparison(versions) {
  if (!versions || versions.length === 0) return null
  if (versions.length === 1) {
    return `Only one model version has been recorded (${versions[0].versionName}), ` +
      'so there is no previous version to compare it against.'
  }
  const i = versions.findIndex((v) => v.isActive)
  if (i === -1) {
    return 'No version is marked active in the database, so no comparison is shown.'
  }
  if (i === 0) {
    return `The active version (${versions[0].versionName}) is the earliest recorded ` +
      'version, so there is no previous version to compare it against.'
  }

  const cur = versions[i]
  const prev = versions[i - 1]
  const metrics = [
    { key: 'mape', label: 'MAPE', lowerIsBetter: true, fmt: (v) => pct(v) },
    { key: 'rmse', label: 'RMSE', lowerIsBetter: true, fmt: (v) => fmt(v) },
    { key: 'r2Score', label: 'R²', lowerIsBetter: false, fmt: (v) => fmt(v) },
  ]

  const better = []
  const worse = []
  const same = []
  for (const m of metrics) {
    const a = prev[m.key]
    const b = cur[m.key]
    if (a === null || a === undefined || b === null || b === undefined) continue
    const phrase = `${m.label} from ${m.fmt(a)} to ${m.fmt(b)}`
    if (a === b) same.push(m.label)
    else if (m.lowerIsBetter ? b < a : b > a) better.push({ verb: m.lowerIsBetter ? 'reduced' : 'raised', phrase })
    else worse.push({ verb: m.lowerIsBetter ? 'raised' : 'lowered', phrase })
  }

  if (!better.length && !worse.length) {
    return `${cur.versionName} and ${prev.versionName} have no comparable metrics recorded.`
  }

  const join = (list) => list.map((x) => `${x.verb} ${x.phrase}`).join(', ')
  const head = `${shortVersion(cur.versionName)} (active)`
  if (better.length && !worse.length) {
    return `${head} improved on ${shortVersion(prev.versionName)}: ${join(better)}.`
  }
  if (!better.length && worse.length) {
    return `${head} did not improve on ${shortVersion(prev.versionName)}: ${join(worse)}.`
  }
  return `${head} ${join(better)} versus ${shortVersion(prev.versionName)}, ` +
    `but ${join(worse)}.`
}

// Bold the active version's axis label and mark it, so the highlight is not
// carried by colour alone.
function VersionTick({ x, y, payload, activeLabel }) {
  const isActive = payload.value === activeLabel
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0} y={0} dy={12} textAnchor="middle"
        fontSize={11}
        fontWeight={isActive ? 700 : 400}
        fill={isActive ? C.forest : C.muted}
      >
        {payload.value}
      </text>
      {isActive && (
        <text x={0} y={0} dy={26} textAnchor="middle" fontSize={10} fill={C.good}>
          ● active
        </text>
      )}
    </g>
  )
}

function AccuracyByVersion({ versions, error }) {
  const rows = versions || []
  const activeRow = rows.find((v) => v.isActive)
  const activeLabel = activeRow ? shortVersion(activeRow.versionName) : null
  const sentence = versionComparison(rows)

  const data = rows.map((v) => ({
    label: shortVersion(v.versionName),
    fullName: v.versionName,
    isActive: v.isActive,
    RMSE: v.rmse,
    MAPE: v.mape,
    'R²': v.r2Score,
  }))

  const series = [
    { key: 'RMSE', color: C.forest },
    { key: 'MAPE', color: C.terra },
    { key: 'R²', color: C.gold },
  ]

  const period = rows.length
    ? `${dayLabel(rows[0].trainedAt)} – ${dayLabel(rows[rows.length - 1].trainedAt)}`
    : null

  return (
    <Card title="Accuracy by model version" aside={<BacktestTag />}>
      {sentence && (
        <p className="mt-3 rounded-2xl bg-cream px-4 py-3 text-sm leading-relaxed text-ink-soft">
          {sentence}
        </p>
      )}

      {!versions ? (
        <EmptyState error={explain(error)}>Could not load model versions.</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>
          No model versions recorded yet. A row is written to <code>model_versions</code>{' '}
          the first time a prediction run stores results.
        </EmptyState>
      ) : (
        <>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  height={44}
                  {...axisStyle}
                  tick={<VersionTick activeLabel={activeLabel} />}
                />
                <YAxis {...axisStyle} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, name) => [
                    name === 'MAPE' ? pct(value) : fmt(value), name,
                  ]}
                  labelFormatter={(label) =>
                    data.find((d) => d.label === label)?.fullName || label}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {series.map((s) => (
                  <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]}>
                    {data.map((d, i) => (
                      // Inactive versions are dimmed so the active one reads first.
                      <Cell
                        key={i}
                        fillOpacity={d.isActive ? 1 : 0.35}
                        stroke={d.isActive ? s.color : 'none'}
                        strokeWidth={d.isActive ? 1 : 0}
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Caption>
            Source: <code>model_versions</code> table ({rows.length}{' '}
            {rows.length === 1 ? 'version' : 'versions'}), ordered oldest to newest
            {period ? ` · trained ${period}` : ''}. Figures are offline backtest scores on
            held-out data recorded at training time — not validation of live predictions.
            RMSE and MAPE are better when lower; R² is better when higher. MAPE is a
            percentage; RMSE is in food-price-index units; R² is unitless.
          </Caption>
        </>
      )}
    </Card>
  )
}

// --- B. backtest predicted vs actual ---------------------------------------
function BacktestChart({ backtest, error }) {
  const series = backtest?.series || null
  const data = (series || []).map((p) => ({
    month: monthLabelFromISO(p.targetMonth),
    Actual: p.actual,
    Predicted: p.predicted,
  }))

  return (
    <Card title="Backtest: predicted vs actual" aside={<BacktestTag />}>
      {!data.length ? (
        <EmptyState error={explain(error)}>
          No backtest series available. The ML service exposes one only when{' '}
          <code>models/backtest.json</code> is present and matches the deployed model.
        </EmptyState>
      ) : (
        <>
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="month" {...axisStyle} minTickGap={12} />
                <YAxis {...axisStyle} domain={['auto', 'auto']} />
                <Tooltip {...tooltipStyle} formatter={(v, n) => [fmt(v, 2), n]} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line
                  type="monotone" dataKey="Actual" stroke={C.forest}
                  strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone" dataKey="Predicted" stroke={C.terra}
                  strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2.5 }} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <Caption>
            Source: the deployed model replayed over its held-out test split
            {backtest.splitDate ? ` (from ${monthLabelFromISO(backtest.splitDate)})` : ''} ·{' '}
            {backtest.nPoints} monthly points
            {backtest.period
              ? ` covering ${monthLabelFromISO(backtest.period.start)} – ${monthLabelFromISO(backtest.period.end)}`
              : ''}
            {backtest.unit ? ` · ${backtest.unit}` : ''}. This is offline backtest evaluation
            on data the model never trained on — it does not validate any live prediction.
            {backtest.metrics
              ? ` Over this window: RMSE ${fmt(backtest.metrics.rmse)}, MAPE ${pct(backtest.metrics.mape)}, R² ${fmt(backtest.metrics.r2_score)}.`
              : ''}
          </Caption>
        </>
      )}
    </Card>
  )
}

// --- C. feature importances -------------------------------------------------
const TOP_FEATURES = 12

function FeatureImportances({ performance, error }) {
  const all = performance?.featureImportances || null
  const top = (all || []).slice(0, TOP_FEATURES)
  const data = top.map((f) => ({
    feature: f.feature,
    Importance: f.importance,
    description: f.description,
  })).reverse() // recharts draws the first row at the bottom

  return (
    <Card title="Most influential features" aside={<BacktestTag />}>
      {!data.length ? (
        <EmptyState error={explain(error)}>
          No feature importances available from the ML service for the deployed model.
        </EmptyState>
      ) : (
        <>
          <div className="mt-5 w-full" style={{ height: Math.max(240, data.length * 26 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" {...axisStyle} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={150}
                  interval={0}
                  tick={{ fontSize: 10, fill: C.muted }}
                  stroke={C.line}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [fmt(v, 4), 'Importance']}
                  labelFormatter={(label) =>
                    data.find((d) => d.feature === label)?.description || label}
                />
                <Bar dataKey="Importance" fill={C.good} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Caption>
            Source: gain-based importances read from the deployed model artifact
            {performance?.versionName ? ` (${performance.versionName})` : ''} · top{' '}
            {top.length} of {all.length} features, fixed at training time
            {performance?.trainingDataRange
              ? ` on ${performance.trainingDataRange.start_date} – ${performance.trainingDataRange.end_date} data`
              : ''}
            . These describe how the model was fitted during offline training and
            backtesting; they say nothing about the accuracy of live predictions.
          </Caption>
        </>
      )}
    </Card>
  )
}

// --- D. prediction activity -------------------------------------------------
function PredictionActivity({ activity, error }) {
  const rows = activity || []
  const data = rows.map((a) => ({
    date: dayLabel(a.predictionDate),
    'Avg predicted change %': a.avgChangePct,
    predictionsMade: a.predictionsMade,
    min: a.minChangePct,
    max: a.maxChangePct,
  }))

  return (
    <Card
      title="Prediction activity over time"
      aside={
        <span
          title="Forecasts the system issued — not scored accuracy."
          className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-medium text-muted"
        >
          Live forecasts · unscored
        </span>
      }
    >
      {!activity ? (
        <EmptyState error={explain(error)}>Could not load prediction activity.</EmptyState>
      ) : !data.length ? (
        <EmptyState>
          No predictions stored yet. Rows appear here after a prediction run.
        </EmptyState>
      ) : (
        <>
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="date" {...axisStyle} minTickGap={8} />
                <YAxis {...axisStyle} unit="%" />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [pct(v), 'Avg predicted change']}
                  labelFormatter={(label) => {
                    const row = data.find((d) => d.date === label)
                    return row
                      ? `${label} · ${row.predictionsMade} predictions · range ${pct(row.min)} to ${pct(row.max)}`
                      : label
                  }}
                />
                <Bar dataKey="Avg predicted change %" fill={C.forest} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Caption>
            Source: <code>predictions</code> table, average <code>predicted_change_pct</code>{' '}
            grouped by <code>prediction_date</code> ·{' '}
            {data.length === 1
              ? `1 run day (${data[0].date})`
              : `${data.length} run days, ${data[0].date} – ${data[data.length - 1].date}`}
            . These are forecasts the system issued, shown as recorded. They carry no
            accuracy score: a forecast can only be scored once its target date has passed
            and the actual price index for that month is published.
          </Caption>
        </>
      )}
    </Card>
  )
}

// --- page -------------------------------------------------------------------
export default function ModelPerformance() {
  const { data, loading, error } = useAsync(loadModelPerformance)

  if (loading) {
    return <p className="py-20 text-center text-muted">Loading model performance…</p>
  }
  if (error) {
    return (
      <p className="py-20 text-center text-bad">
        Could not load model performance. Is the backend running on :3000?
      </p>
    )
  }

  const {
    versions, versionsError, performance, performanceError, activity, activityError,
  } = data
  const active = (versions || []).find((v) => v.isActive) || null
  // Every source failing at once is a service-level problem, not four data gaps.
  const allFailed = versionsError && performanceError && activityError

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Model Performance</h1>
        <p className="mt-1 text-sm text-muted">
          How the deployed forecasting model was evaluated before release
          {active ? <> · active version <span className="font-medium text-ink-soft">{active.versionName}</span></> : null}
        </p>
      </header>

      {/* The page-level honesty note — applies to every accuracy figure below. */}
      <div className="rounded-3xl bg-khaki px-6 py-4 sm:px-7">
        <p className="text-sm leading-relaxed text-ink-soft">
          Accuracy figures come from held-out backtesting. Live predictions cannot be
          scored until their four-week target dates pass and actual price data is
          published.
        </p>
      </div>

      {allFailed ? (
        <div className="rounded-3xl border border-dashed border-line-strong px-6 py-4">
          <p className="text-sm text-ink-soft">
            None of this page's data sources responded.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{explain(versionsError)}</p>
        </div>
      ) : performanceError ? (
        <div className="rounded-3xl border border-dashed border-line-strong px-6 py-4">
          <p className="text-sm text-muted">
            Feature importances and the backtest series are unavailable. Database-backed
            sections below are unaffected.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-faint">{explain(performanceError)}</p>
        </div>
      ) : null}

      <AccuracyByVersion versions={versions} error={versionsError} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <BacktestChart backtest={performance?.backtest || null} error={performanceError} />
        <FeatureImportances performance={performance} error={performanceError} />
      </div>

      <PredictionActivity activity={activity} error={activityError} />
    </div>
  )
}
