import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Predictions from './pages/Predictions'
import Users from './pages/Users'
import Alerts from './pages/Alerts'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />

      {/* All authenticated pages share the dashboard layout. */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Overview />} />
        <Route path="predictions" element={<Predictions />} />
        <Route path="users" element={<Users />} />
        <Route path="alerts" element={<Alerts />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
