import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@lek.ss')
  const [password, setPassword] = useState('')

  // Mock auth: accept ANY input and go straight to the dashboard.
  function handleSubmit(e) {
    e.preventDefault()
    navigate('/dashboard')
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
          {/* Email — label sits inside the field */}
          <div className="rounded-lg border border-line-strong px-5 py-3 transition focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
            <label className="block text-xs font-medium text-faint">Email ID</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-0.5 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
            />
          </div>

          {/* Password */}
          <div className="rounded-lg border border-line-strong px-5 py-3 transition focus-within:border-forest/50 focus-within:ring-2 focus-within:ring-forest/10">
            <label className="block text-xs font-medium text-faint">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-0.5 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
            />
          </div>

          <p className="text-[13px] leading-relaxed text-muted">
            By signing in, you agree to Lëk&apos;s{' '}
            <span className="font-semibold text-terra">Terms of Use</span> &amp;{' '}
            <span className="font-semibold text-terra">Privacy Policy</span>
          </p>

          <button
            type="submit"
            className="w-full rounded-full bg-forest py-4 text-base font-semibold text-white transition hover:bg-forest-hover"
          >
            Sign in
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
