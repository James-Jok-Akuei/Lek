import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutGrid, TrendingUp, Users, Bell, ShieldCheck, LogOut } from 'lucide-react'
import Logo from './Logo'
import { logout, getCurrentAdmin } from '../api'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/dashboard/predictions', label: 'Predictions', icon: TrendingUp },
  { to: '/dashboard/users', label: 'Users', icon: Users },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell },
  // Admin management is superadmin-only (nav hidden for regular admins; the
  // route and the API are independently guarded).
  { to: '/dashboard/admins', label: 'Admins', icon: ShieldCheck, superadminOnly: true },
]

function NavItem({ item }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `relative flex items-center gap-2 py-1.5 text-sm transition-colors ${
          isActive ? 'font-semibold text-forest' : 'font-medium text-muted hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={isActive ? 2.1 : 1.8} />
          {item.label}
          {isActive && (
            <span className="absolute -bottom-4.5 left-0 right-0 h-0.5 rounded-full bg-forest" />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function TopNav() {
  const navigate = useNavigate()
  const me = getCurrentAdmin()
  const isSuperadmin = me?.role === 'superadmin'
  const items = navItems.filter((item) => !item.superadminOnly || isSuperadmin)
  const username = me?.username || 'Admin'
  const [confirmOpen, setConfirmOpen] = useState(false)
  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center px-6 lg:px-8">
        <Logo className="text-3xl" />

        <div className="ml-auto flex items-center gap-7">
          <nav className="hidden items-center gap-7 md:flex">
            {items.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>
          <div className="hidden h-6 w-px bg-line md:block" />
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-lilac text-sm font-semibold uppercase text-lilac-ink">
              {username.charAt(0)}
            </span>
            <span className="hidden text-sm font-medium text-ink sm:inline">{username}</span>
            <button
              onClick={() => setConfirmOpen(true)}
              className="ml-1 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-ink-soft transition hover:bg-canvas hover:text-ink"
            >
              <LogOut size={16} strokeWidth={1.8} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <SignOutModal onClose={() => setConfirmOpen(false)} onConfirm={handleLogout} />
      )}
    </header>
  )
}

// Confirmation before signing out, so an accidental click doesn't end the session.
function SignOutModal({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/20" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-7">
        <h2 className="text-lg font-semibold text-ink">Sign out?</h2>
        <p className="mt-1 text-sm text-muted">
          You will be returned to the login screen and need to sign in again to continue.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line-strong px-5 py-2 text-sm font-medium text-ink-soft transition hover:bg-canvas"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white transition hover:bg-forest-hover"
          >
            <LogOut size={15} strokeWidth={2} />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
