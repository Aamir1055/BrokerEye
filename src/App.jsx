import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import ClientsPage from './pages/ClientsPage'
import LoadingSpinner from './components/LoadingSpinner'

// Main App Content Component
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  )
}

export default App
