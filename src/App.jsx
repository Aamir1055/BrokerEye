import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { GroupProvider } from './contexts/GroupContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import ClientsPage from './pages/ClientsPage'
import LiveDealingPage from './pages/LiveDealingPage'
import PositionsPage from './pages/PositionsPage'
import PendingOrdersPage from './pages/PendingOrdersPage'
import MarginLevelPage from './pages/MarginLevelPage'
import ClientPercentagePage from './pages/ClientPercentagePage'
import BrokerRulePage from './pages/BrokerRulePage'
import LoadingSpinner from './components/LoadingSpinner'

// Main App Content Component
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/login" element={<DashboardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/clients" element={<ClientsPage />} />
      <Route path="/positions" element={<PositionsPage />} />
      <Route path="/pending-orders" element={<PendingOrdersPage />} />
      <Route path="/margin-level" element={<MarginLevelPage />} />
      <Route path="/live-dealing" element={<LiveDealingPage />} />
      <Route path="/client-percentage" element={<ClientPercentagePage />} />
      <Route path="/broker-rules" element={<BrokerRulePage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <DataProvider>
          <GroupProvider>
            <AppContent />
          </GroupProvider>
        </DataProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
