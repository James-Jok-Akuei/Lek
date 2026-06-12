import { NavLink } from 'react-router-dom'
import { LayoutGrid, TrendingUp, Users, Bell } from 'lucide-react'
import Logo from './Logo'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/dashboard/predictions', label: 'Predictions', icon: TrendingUp },
  { to: '/dashboard/users', label: 'Users', icon: Users },
  { to: '/dashboard/alerts', label: 'Alerts', icon: Bell },
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
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-18 w-full max-w-7xl items-center px-6 lg:px-8">
        <Logo className="text-3xl" />

        <div className="ml-auto flex items-center gap-7">
          <nav className="hidden items-center gap-7 md:flex">
            {navItems.map((item) => (
              <NavItem key={item.to} item={item} />
            ))}
          </nav>
          <div className="hidden h-6 w-px bg-line md:block" />
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-lilac text-sm font-semibold text-lilac-ink">
              A
            </span>
            <span className="hidden text-sm font-medium text-ink sm:inline">Welcome, Admin</span>
          </div>
        </div>
      </div>
    </header>
  )
}
