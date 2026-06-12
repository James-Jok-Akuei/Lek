import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-canvas">
      <TopNav />

      <main className="mx-auto w-full max-w-7xl px-6 py-7 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
