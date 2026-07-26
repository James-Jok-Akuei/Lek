import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'

export default function DashboardLayout() {
  return (
    // flex-1 (not min-h-screen) so the app shell in App.jsx can push the footer
    // to the bottom of the viewport on short pages.
    <div className="flex flex-1 flex-col bg-canvas">
      <TopNav />

      <main className="mx-auto w-full max-w-400 flex-1 px-6 py-7 lg:px-10">
        <Outlet />
      </main>
    </div>
  )
}
