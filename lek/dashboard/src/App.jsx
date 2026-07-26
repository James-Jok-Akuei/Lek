import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import Footer from './components/Footer'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Predictions from './pages/Predictions'
import ModelPerformance from './pages/ModelPerformance'
import Users from './pages/Users'
import Alerts from './pages/Alerts'
import Admins from './pages/Admins'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsOfUse from './pages/TermsOfUse'
import { isAuthed, getCurrentAdmin } from './api'

// Redirect to the login screen if there is no valid session token.
function RequireAuth({ children }) {
  return isAuthed() ? children : <Navigate to="/login" replace />
}

// Superadmin-only route guard. A regular admin who types the URL directly is
// redirected back to the dashboard (the API is the real enforcement).
function RequireSuperadmin({ children }) {
  return getCurrentAdmin()?.role === 'superadmin'
    ? children
    : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    // App shell: a full-height flex column so the footer sits at the bottom of
    // short pages without ever overlapping content (no position: fixed).
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />

          {/* Public — must stay outside RequireAuth so they are readable logged out. */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />

          {/* All authenticated pages share the dashboard layout. */}
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Overview />} />
            <Route path="predictions" element={<Predictions />} />
            <Route path="model-performance" element={<ModelPerformance />} />
            <Route path="users" element={<Users />} />
            <Route path="alerts" element={<Alerts />} />
            <Route
              path="admins"
              element={
                <RequireSuperadmin>
                  <Admins />
                </RequireSuperadmin>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>

      <Footer />
    </div>
  )
}
