import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { GroupProvider } from './contexts/GroupContext'
import { IBProvider } from './contexts/IBContext'
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
import IBCommissionsPage from './pages/IBCommissionsPage'
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
      <Route path="/ib-commissions" element={<IBCommissionsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<DashboardPage />} />
    </Routes>
  )
}

function App() {
  return (
    <Router basename="/v2">
      <AuthProvider>
        <DataProvider>
          <GroupProvider>
            <IBProvider>
              <AppContent />
            </IBProvider>
          </GroupProvider>
        </DataProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
