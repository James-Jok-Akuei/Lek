import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { login } from '../api'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Real auth: POST to the backend, store the JWT, then enter the dashboard.
  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/dashboard')
    } catch {
      setError('Invalid username or password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      {/* Wordmark */}
      <div className="mb-10 text-center leading-none tracking-tight">
        <span className="text-6xl font-bold text-ink">Lëk</span>
        <span className="text-5xl font-light text-forest"> for Admins</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-xl rounded-xl bg-surface p-10 sm:p-12">
        <h1 className="text-xl font-semibold text-ink">
          Sign in to manage predictions &amp; alerts
        </h1>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {/* Username — label sits inside the field */}
          <div className="rounded-lg border border-line-strong px-5 py-3 transition focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
            <label className="block text-xs font-medium text-faint">Username</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin"
              className="mt-0.5 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
            />
          </div>

          {/* Password */}
          <div className="rounded-lg border border-line-strong px-5 py-3 transition focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
            <label className="block text-xs font-medium text-faint">Password</label>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-0.5 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="shrink-0 rounded-md p-1 text-faint transition hover:text-ink"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-bad/10 px-4 py-2.5 text-sm font-medium text-bad">{error}</p>
          )}

          <p className="text-[13px] leading-relaxed text-muted">
            By signing in, you agree to Lëk&apos;s{' '}
            <span className="font-semibold text-terra">Terms of Use</span> &amp;{' '}
            <span className="font-semibold text-terra">Privacy Policy</span>
          </p>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-forest py-4 text-base font-semibold text-white transition hover:bg-forest-hover disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm font-medium text-ink">
          Are you a citizen looking for price alerts?{' '}
          <span className="cursor-pointer font-semibold text-terra">Get alerts by SMS</span>
        </p>
      </div>
    </div>
  )
}
