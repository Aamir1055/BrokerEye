import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { GroupProvider } from './contexts/GroupContext'
import { IBProvider } from './contexts/IBContext'
import LoginPage from './pages/LoginPage'
import LoadingSpinner from './components/LoadingSpinner'

// Lazy load heavy components for code splitting and faster navigation
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ClientsPage = lazy(() => import('./pages/ClientsPage'))
const PositionsPage = lazy(() => import('./pages/PositionsPage'))
const PendingOrdersPage = lazy(() => import('./pages/PendingOrdersPage'))
const MarginLevelPage = lazy(() => import('./pages/MarginLevelPage'))
const LiveDealingPage = lazy(() => import('./pages/LiveDealingPage'))
const ClientPercentagePage = lazy(() => import('./pages/ClientPercentagePage'))
const BrokerRulePage = lazy(() => import('./pages/BrokerRulePage'))
const IBCommissionsPage = lazy(() => import('./pages/IBCommissionsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const GraphicalAnalyticsPage = lazy(() => import('./pages/GraphicalAnalyticsPage'))

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
    <Suspense fallback={<LoadingSpinner />}>
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
  <Route path="/analytics" element={<GraphicalAnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </Suspense>
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
