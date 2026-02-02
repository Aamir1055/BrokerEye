import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './shared/contexts/AuthContext'
import { DataProvider } from './shared/contexts/DataContext'
import { GroupProvider } from './shared/contexts/GroupContext'
import { IBProvider } from './shared/contexts/IBContext'
import { LoginPage, LoginMobile } from './modules/auth'
import { DashboardPage, ClientDashboardDesignC } from './modules/dashboard'
import { PositionsPage } from './modules/positions'
import { Client2Page } from './modules/clients'
import { PendingOrdersPage } from './modules/pending-orders'
import { LiveDealingPage, GraphicalAnalyticsPage } from './modules/live-dealing'
import { MarginLevelPage } from './modules/margin-level'
import { ClientPercentagePage } from './modules/client-percentage'
import { SettingsPage } from './modules/settings'
import { BrokerRulePage } from './modules/broker-rules'
import { IBCommissionsPage } from './modules/ib-commissions'
import LoadingSpinner from './shared/components/feedback/LoadingSpinner'

// Lazy load heavy components for code splitting and faster navigation
// IB Commissions module removed for broker branch

// Main App Content Component
const AppContent = () => {
  const { isAuthenticated, loading } = useAuth()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }

    // Check on mount
    checkMobile()

    // Listen for resize events
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (loading) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={isMobile ? <LoginMobile /> : <LoginPage />} />
        <Route path="/login" element={isMobile ? <LoginMobile /> : <LoginPage />} />
        <Route path="/m/login" element={<LoginMobile />} />
        <Route path="/d/login" element={<LoginPage />} />
        <Route path="*" element={isMobile ? <LoginMobile /> : <LoginPage />} />
      </Routes>
    )
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* Preload other routes in the background to speed up navigation */}
      <PreloadRoutes />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/login" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/client2" element={<Client2Page />} />
        <Route path="/positions" element={<PositionsPage />} />
        <Route path="/pending-orders" element={<PendingOrdersPage />} />
        <Route path="/margin-level" element={<MarginLevelPage />} />
        <Route path="/live-dealing" element={<LiveDealingPage />} />
        <Route path="/client-percentage" element={<ClientPercentagePage />} />
        {/* IB Commissions */}
        <Route path="/ib-commissions" element={<IBCommissionsPage />} />
        <Route path="/broker-rules" element={<BrokerRulePage />} />
  <Route path="/analytics" element={<GraphicalAnalyticsPage />} />
          <Route path="/client-dashboard-c" element={<ClientDashboardDesignC />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </Suspense>
  )
}

// Preloads lazy routes after initial render to make navigation snappy
function PreloadRoutes() {
  // All pages now directly imported via modules - no lazy loading needed
  return null
}

function App() {
  // Deployed to root directory (htdocs)
  const getBasename = () => {
    return '/'
  }

  return (
    <Router basename={getBasename()}>
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
