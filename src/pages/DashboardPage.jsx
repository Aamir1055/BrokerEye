import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import Sidebar from '../components/Sidebar'
import QuickActionCard from '../components/dashboard/QuickActionCard'
import MiniDataTable from '../components/dashboard/MiniDataTable'
import WebSocketIndicator from '../components/WebSocketIndicator'

const DashboardPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { clients, positions, orders, clientStats, loading, connectionState } = useData()
  const navigate = useNavigate()

  // Format Indian number (with commas)
  const formatIndianNumber = (value) => {
    if (value === null || value === undefined) return '0.00'
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Calculate additional metrics from clients array
  const dashboardStats = useMemo(() => {
    let totalDeposit = 0
    let totalWithdrawal = 0
    let totalCorrection = 0
    let creditIn = 0
    let creditOut = 0

    clients.forEach(client => {
      // Sum lifetime deposits and withdrawals if they exist
      totalDeposit += (client.totalDeposit || 0)
      totalWithdrawal += (client.totalWithdrawal || 0)
      totalCorrection += (client.correction || 0)
      
      // Credit IN/OUT logic: positive credit = IN, negative would be OUT
      const credit = client.credit || 0
      if (credit > 0) {
        creditIn += credit
      } else if (credit < 0) {
        creditOut += Math.abs(credit)
      }
    })

    const netDeposit = totalDeposit - totalWithdrawal
    const netClient = clientStats.totalBalance + clientStats.totalCredit
    const floatingPnL = clientStats.totalPnl || clientStats.totalProfit // Use totalPnl as floating P&L

    return {
      totalDeposit,
      totalWithdrawal,
      netDeposit,
      totalCorrection,
      creditIn,
      creditOut,
      netClient,
      floatingPnL
    }
  }, [clients, clientStats])

  // Format currency for tables
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }

  // Calculate total positions P&L
  const totalPositionsPnL = useMemo(() => {
    return positions.reduce((sum, pos) => sum + (pos.profit || 0), 0)
  }, [positions])

  // Get top profitable clients
  const topProfitableClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => (b.lifetimePnL || 0) - (a.lifetimePnL || 0))
      .slice(0, 5)
      .map(client => [
        client.login || '-',
        client.name || '-',
        formatCurrency(client.balance || 0),
        <span className={(client.lifetimePnL || 0) >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {formatCurrency(client.lifetimePnL || 0)}
        </span>
      ])
  }, [clients])

  // Get recent large positions
  const recentPositions = useMemo(() => {
    return [...positions]
      .sort((a, b) => Math.abs(b.profit || 0) - Math.abs(a.profit || 0))
      .slice(0, 5)
      .map(pos => [
        pos.login || '-',
        pos.symbol || '-',
        pos.type === 0 ? 'BUY' : 'SELL',
        formatCurrency(pos.volume || 0),
        <span className={(pos.profit || 0) >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
          {formatCurrency(pos.profit || 0)}
        </span>
      ])
  }, [positions])

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-x-hidden">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-white shadow-sm"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Welcome back, {user?.full_name || user?.username}
                </p>
              </div>
            </div>
            <WebSocketIndicator />
          </div>

          {/* Face Cards - 17 Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {/* 1. Total Client */}
            <div className="bg-white rounded shadow-sm border border-blue-200 p-2">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Total Client</p>
              <p className="text-sm font-bold text-gray-900">
                {clientStats.totalClients}
              </p>
            </div>

            {/* 2. Total Deposit */}
            <div className="bg-white rounded shadow-sm border border-green-200 p-2">
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Total Deposit</p>
              <p className="text-sm font-bold text-green-700">
                {formatIndianNumber(dashboardStats.totalDeposit)}
              </p>
            </div>

            {/* 3. Total Withdrawal */}
            <div className="bg-white rounded shadow-sm border border-red-200 p-2">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1">Total Withdrawal</p>
              <p className="text-sm font-bold text-red-700">
                {formatIndianNumber(dashboardStats.totalWithdrawal)}
              </p>
            </div>

            {/* 4. Net Deposit */}
            <div className={`bg-white rounded shadow-sm border ${dashboardStats.netDeposit >= 0 ? 'border-emerald-200' : 'border-rose-200'} p-2`}>
              <p className={`text-[10px] font-semibold ${dashboardStats.netDeposit >= 0 ? 'text-emerald-600' : 'text-rose-600'} uppercase tracking-wider mb-1`}>Net Deposit</p>
              <p className={`text-sm font-bold ${dashboardStats.netDeposit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {dashboardStats.netDeposit >= 0 ? '▲ ' : '▼ '}
                {dashboardStats.netDeposit >= 0 ? '' : '-'}
                {formatIndianNumber(Math.abs(dashboardStats.netDeposit))}
              </p>
            </div>

            {/* 5. Total Balance */}
            <div className="bg-white rounded shadow-sm border border-indigo-200 p-2">
              <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider mb-1">Total Balance</p>
              <p className="text-sm font-bold text-gray-900">
                {formatIndianNumber(clientStats.totalBalance)}
              </p>
            </div>

            {/* 6. Total Equity */}
            <div className="bg-white rounded shadow-sm border border-sky-200 p-2">
              <p className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider mb-1">Total Equity</p>
              <p className="text-sm font-bold text-gray-900">
                {formatIndianNumber(clientStats.totalEquity)}
              </p>
            </div>

            {/* 7. Total Correction */}
            <div className="bg-white rounded shadow-sm border border-purple-200 p-2">
              <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1">Total Correction</p>
              <p className="text-sm font-bold text-gray-900">
                {formatIndianNumber(dashboardStats.totalCorrection)}
              </p>
            </div>

            {/* 8. Total Credit IN */}
            <div className="bg-white rounded shadow-sm border border-emerald-200 p-2">
              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Total Credit IN</p>
              <p className="text-sm font-bold text-emerald-700">
                {formatIndianNumber(dashboardStats.creditIn)}
              </p>
            </div>

            {/* 9. Total Credit Out */}
            <div className="bg-white rounded shadow-sm border border-orange-200 p-2">
              <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1">Total Credit Out</p>
              <p className="text-sm font-bold text-orange-700">
                {formatIndianNumber(dashboardStats.creditOut)}
              </p>
            </div>

            {/* 10. Net Client */}
            <div className="bg-white rounded shadow-sm border border-cyan-200 p-2">
              <p className="text-[10px] font-semibold text-cyan-600 uppercase tracking-wider mb-1">Net Client</p>
              <p className="text-sm font-bold text-gray-900">
                {formatIndianNumber(dashboardStats.netClient)}
              </p>
            </div>

            {/* 11. Floating P & L */}
            <div className={`bg-white rounded shadow-sm border ${dashboardStats.floatingPnL >= 0 ? 'border-green-200' : 'border-red-200'} p-2`}>
              <div className="flex items-center justify-between mb-1">
                <p className={`text-[10px] font-semibold ${dashboardStats.floatingPnL >= 0 ? 'text-green-600' : 'text-red-600'} uppercase`}>Floating P&L</p>
                <div className={`w-6 h-6 ${dashboardStats.floatingPnL >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'} rounded-lg flex items-center justify-center`}>
                  <svg className={`w-3 h-3 ${dashboardStats.floatingPnL >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    {dashboardStats.floatingPnL >= 0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    )}
                  </svg>
                </div>
              </div>
              <p className={`text-sm font-bold ${dashboardStats.floatingPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {dashboardStats.floatingPnL >= 0 ? '▲ ' : '▼ '}
                {dashboardStats.floatingPnL >= 0 ? '' : '-'}
                {formatIndianNumber(Math.abs(dashboardStats.floatingPnL))}
              </p>
            </div>

            {/* 12. Lifetime P&L */}
            <div className={`bg-white rounded shadow-sm border ${clientStats.lifetimePnL >= 0 ? 'border-violet-200' : 'border-pink-200'} p-2`}>
              <p className={`text-[10px] font-semibold ${clientStats.lifetimePnL >= 0 ? 'text-violet-600' : 'text-pink-600'} uppercase tracking-wider mb-1`}>Lifetime P&L</p>
              <p className={`text-sm font-bold ${clientStats.lifetimePnL >= 0 ? 'text-violet-700' : 'text-pink-700'}`}>
                {clientStats.lifetimePnL >= 0 ? '▲ ' : '▼ '}
                {clientStats.lifetimePnL >= 0 ? '' : '-'}
                {formatIndianNumber(Math.abs(clientStats.lifetimePnL))}
              </p>
            </div>

            {/* 13. Daily Deposit */}
            <div className="bg-white rounded shadow-sm border border-green-200 p-2">
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Daily Deposit</p>
              <p className="text-sm font-bold text-green-700">
                {formatIndianNumber(clientStats.dailyDeposit)}
              </p>
            </div>

            {/* 14. Daily Withdrawal */}
            <div className="bg-white rounded shadow-sm border border-red-200 p-2">
              <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-1">Daily Withdrawal</p>
              <p className="text-sm font-bold text-red-700">
                {formatIndianNumber(clientStats.dailyWithdrawal)}
              </p>
            </div>

            {/* 15. Daily P&L */}
            <div className={`bg-white rounded shadow-sm border ${clientStats.dailyPnL >= 0 ? 'border-emerald-200' : 'border-rose-200'} p-2`}>
              <p className={`text-[10px] font-semibold ${clientStats.dailyPnL >= 0 ? 'text-emerald-600' : 'text-rose-600'} uppercase tracking-wider mb-1`}>Daily P&L</p>
              <p className={`text-sm font-bold ${clientStats.dailyPnL >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {clientStats.dailyPnL >= 0 ? '▲ ' : '▼ '}
                {clientStats.dailyPnL >= 0 ? '' : '-'}
                {formatIndianNumber(Math.abs(clientStats.dailyPnL))}
              </p>
            </div>

            {/* 16. This Week P&L */}
            <div className={`bg-white rounded shadow-sm border ${clientStats.thisWeekPnL >= 0 ? 'border-cyan-200' : 'border-amber-200'} p-2`}>
              <p className={`text-[10px] font-semibold ${clientStats.thisWeekPnL >= 0 ? 'text-cyan-600' : 'text-amber-600'} uppercase tracking-wider mb-1`}>This Week P&L</p>
              <p className={`text-sm font-bold ${clientStats.thisWeekPnL >= 0 ? 'text-cyan-700' : 'text-amber-700'}`}>
                {clientStats.thisWeekPnL >= 0 ? '▲ ' : '▼ '}
                {clientStats.thisWeekPnL >= 0 ? '' : '-'}
                {formatIndianNumber(Math.abs(clientStats.thisWeekPnL))}
              </p>
            </div>

            {/* 17. This Month P&L */}
            <div className={`bg-white rounded shadow-sm border ${clientStats.thisMonthPnL >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
              <p className={`text-[10px] font-semibold ${clientStats.thisMonthPnL >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase tracking-wider mb-1`}>This Month P&L</p>
              <p className={`text-sm font-bold ${clientStats.thisMonthPnL >= 0 ? 'text-teal-700' : 'text-orange-700'}`}>
                {clientStats.thisMonthPnL >= 0 ? '▲ ' : '▼ '}
                {clientStats.thisMonthPnL >= 0 ? '' : '-'}
                {formatIndianNumber(Math.abs(clientStats.thisMonthPnL))}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <QuickActionCard
                title="View Clients"
                description="Manage client accounts"
                path="/clients"
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
                gradient="from-blue-500 to-blue-600"
              />

              <QuickActionCard
                title="View Positions"
                description="Monitor open positions"
                path="/positions"
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
                gradient="from-green-500 to-green-600"
              />

              <QuickActionCard
                title="Pending Orders"
                description={`${orders.length} pending`}
                path="/orders"
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                }
                gradient="from-orange-500 to-orange-600"
              />

              <QuickActionCard
                title="Live Dealing"
                description="Real-time trades"
                path="/live-dealing"
                icon={
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
                gradient="from-purple-500 to-purple-600"
              />
            </div>
          </div>

          {/* Data Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <MiniDataTable
              title="Top Profitable Clients"
              headers={['Login', 'Name', 'Balance', 'Lifetime P&L']}
              rows={topProfitableClients}
              onViewAll={() => navigate('/clients')}
              loading={loading.clients}
              emptyMessage="No clients data available"
            />

            <MiniDataTable
              title="Largest Open Positions"
              headers={['Login', 'Symbol', 'Type', 'Volume', 'Profit']}
              rows={recentPositions}
              onViewAll={() => navigate('/positions')}
              loading={loading.positions}
              emptyMessage="No positions data available"
            />
          </div>

          {/* System Status */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">System Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                  connectionState === 'connected' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <div className={`w-3 h-3 rounded-full ${
                    connectionState === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                </div>
                <p className="text-xs font-medium text-gray-900">WebSocket</p>
                <p className="text-xs text-gray-500 capitalize">{connectionState}</p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-2">
                  <span className="text-lg font-bold text-blue-600">{clients.length}</span>
                </div>
                <p className="text-xs font-medium text-gray-900">Total Clients</p>
                <p className="text-xs text-gray-500">Active accounts</p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                  <span className="text-lg font-bold text-green-600">{positions.length}</span>
                </div>
                <p className="text-xs font-medium text-gray-900">Open Positions</p>
                <p className="text-xs text-gray-500">Active trades</p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-2">
                  <span className="text-lg font-bold text-orange-600">{orders.length}</span>
                </div>
                <p className="text-xs font-medium text-gray-900">Pending Orders</p>
                <p className="text-xs text-gray-500">Awaiting execution</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default DashboardPage