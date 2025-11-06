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

  // Default card order (IDs 1-17)
  const defaultCardOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
  
  // Load card order from localStorage or use default
  const [cardOrder, setCardOrder] = useState(() => {
    const saved = localStorage.getItem('dashboardCardOrder')
    return saved ? JSON.parse(saved) : defaultCardOrder
  })

  // Drag and drop state
  const [draggedCard, setDraggedCard] = useState(null)

  // Drag and drop handlers
  const handleDragStart = (e, cardId) => {
    setDraggedCard(cardId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target)
    e.target.style.opacity = '0.5'
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedCard(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetCardId) => {
    e.preventDefault()
    
    if (draggedCard === targetCardId) return

    const newOrder = [...cardOrder]
    const draggedIndex = newOrder.indexOf(draggedCard)
    const targetIndex = newOrder.indexOf(targetCardId)

    // Swap positions
    newOrder[draggedIndex] = targetCardId
    newOrder[targetIndex] = draggedCard

    setCardOrder(newOrder)
    localStorage.setItem('dashboardCardOrder', JSON.stringify(newOrder))
  }

  // Reset card order to default
  const resetCardOrder = () => {
    setCardOrder(defaultCardOrder)
    localStorage.setItem('dashboardCardOrder', JSON.stringify(defaultCardOrder))
  }

  // Format Indian number (with commas)
  const formatIndianNumber = (value) => {
    if (value === null || value === undefined) return '0.00'
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Get card configuration by ID
  const getCardConfig = (cardId, stats) => {
    const configs = {
      1: {
        id: 1,
        title: 'Total Client',
        value: clientStats.totalClients,
        borderColor: 'border-blue-200',
        textColor: 'text-blue-600',
        valueColor: 'text-gray-900'
      },
      2: {
        id: 2,
        title: 'Total Deposit',
        value: formatIndianNumber(stats.totalDeposit),
        borderColor: 'border-green-200',
        textColor: 'text-green-600',
        valueColor: 'text-green-700'
      },
      3: {
        id: 3,
        title: 'Total Withdrawal',
        value: formatIndianNumber(stats.totalWithdrawal),
        borderColor: 'border-red-200',
        textColor: 'text-red-600',
        valueColor: 'text-red-700'
      },
      4: {
        id: 4,
        title: 'Net Deposit',
        value: stats.netDeposit,
        borderColor: stats.netDeposit >= 0 ? 'border-emerald-200' : 'border-rose-200',
        textColor: stats.netDeposit >= 0 ? 'text-emerald-600' : 'text-rose-600',
        valueColor: stats.netDeposit >= 0 ? 'text-emerald-700' : 'text-rose-700',
        showArrow: true,
        isPositive: stats.netDeposit >= 0,
        formattedValue: formatIndianNumber(Math.abs(stats.netDeposit))
      },
      5: {
        id: 5,
        title: 'Total Balance',
        value: formatIndianNumber(clientStats.totalBalance),
        borderColor: 'border-indigo-200',
        textColor: 'text-indigo-600',
        valueColor: 'text-gray-900'
      },
      6: {
        id: 6,
        title: 'Total Equity',
        value: formatIndianNumber(clientStats.totalEquity),
        borderColor: 'border-sky-200',
        textColor: 'text-sky-600',
        valueColor: 'text-gray-900'
      },
      7: {
        id: 7,
        title: 'Total Correction',
        value: formatIndianNumber(stats.totalCorrection),
        borderColor: 'border-purple-200',
        textColor: 'text-purple-600',
        valueColor: 'text-gray-900'
      },
      8: {
        id: 8,
        title: 'Total Credit IN',
        value: formatIndianNumber(stats.creditIn),
        borderColor: 'border-emerald-200',
        textColor: 'text-emerald-600',
        valueColor: 'text-emerald-700'
      },
      9: {
        id: 9,
        title: 'Total Credit Out',
        value: formatIndianNumber(stats.creditOut),
        borderColor: 'border-orange-200',
        textColor: 'text-orange-600',
        valueColor: 'text-orange-700'
      },
      10: {
        id: 10,
        title: 'Net Credit',
        value: formatIndianNumber(stats.netClient),
        borderColor: 'border-cyan-200',
        textColor: 'text-cyan-600',
        valueColor: 'text-gray-900'
      },
      11: {
        id: 11,
        title: 'Floating P&L',
        value: stats.floatingPnL,
        borderColor: stats.floatingPnL >= 0 ? 'border-green-200' : 'border-red-200',
        textColor: stats.floatingPnL >= 0 ? 'text-green-600' : 'text-red-600',
        valueColor: stats.floatingPnL >= 0 ? 'text-green-600' : 'text-red-600',
        showIcon: true,
        isPositive: stats.floatingPnL >= 0,
        formattedValue: formatIndianNumber(Math.abs(stats.floatingPnL))
      },
      12: {
        id: 12,
        title: 'Lifetime P&L',
        value: clientStats.lifetimePnL,
        borderColor: clientStats.lifetimePnL >= 0 ? 'border-violet-200' : 'border-pink-200',
        textColor: clientStats.lifetimePnL >= 0 ? 'text-violet-600' : 'text-pink-600',
        valueColor: clientStats.lifetimePnL >= 0 ? 'text-violet-700' : 'text-pink-700',
        showArrow: true,
        isPositive: clientStats.lifetimePnL >= 0,
        formattedValue: formatIndianNumber(Math.abs(clientStats.lifetimePnL))
      },
      13: {
        id: 13,
        title: 'Daily Deposit',
        value: formatIndianNumber(clientStats.dailyDeposit),
        borderColor: 'border-green-200',
        textColor: 'text-green-600',
        valueColor: 'text-green-700'
      },
      14: {
        id: 14,
        title: 'Daily Withdrawal',
        value: formatIndianNumber(clientStats.dailyWithdrawal),
        borderColor: 'border-red-200',
        textColor: 'text-red-600',
        valueColor: 'text-red-700'
      },
      15: {
        id: 15,
        title: 'Daily P&L',
        value: clientStats.dailyPnL,
        borderColor: clientStats.dailyPnL >= 0 ? 'border-emerald-200' : 'border-rose-200',
        textColor: clientStats.dailyPnL >= 0 ? 'text-emerald-600' : 'text-rose-600',
        valueColor: clientStats.dailyPnL >= 0 ? 'text-emerald-700' : 'text-rose-700',
        showArrow: true,
        isPositive: clientStats.dailyPnL >= 0,
        formattedValue: formatIndianNumber(Math.abs(clientStats.dailyPnL))
      },
      16: {
        id: 16,
        title: 'This Week P&L',
        value: clientStats.thisWeekPnL,
        borderColor: clientStats.thisWeekPnL >= 0 ? 'border-cyan-200' : 'border-amber-200',
        textColor: clientStats.thisWeekPnL >= 0 ? 'text-cyan-600' : 'text-amber-600',
        valueColor: clientStats.thisWeekPnL >= 0 ? 'text-cyan-700' : 'text-amber-700',
        showArrow: true,
        isPositive: clientStats.thisWeekPnL >= 0,
        formattedValue: formatIndianNumber(Math.abs(clientStats.thisWeekPnL))
      },
      17: {
        id: 17,
        title: 'This Month P&L',
        value: clientStats.thisMonthPnL,
        borderColor: clientStats.thisMonthPnL >= 0 ? 'border-teal-200' : 'border-orange-200',
        textColor: clientStats.thisMonthPnL >= 0 ? 'text-teal-600' : 'text-orange-600',
        valueColor: clientStats.thisMonthPnL >= 0 ? 'text-teal-700' : 'text-orange-700',
        showArrow: true,
        isPositive: clientStats.thisMonthPnL >= 0,
        formattedValue: formatIndianNumber(Math.abs(clientStats.thisMonthPnL))
      }
    }
    return configs[cardId]
  }

  // Calculate additional metrics from clients array
  const dashboardStats = useMemo(() => {
    // For now, use placeholder values since these fields don't exist in API yet
    const totalDeposit = 0
    const totalWithdrawal = 0
    const totalCorrection = 0
    
    // Calculate Credit IN/OUT from actual credit values
    let creditIn = 0
    let creditOut = 0

    clients.forEach(client => {
      // Skip invalid/null clients
      if (!client) return
      
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

          {/* Face Cards Header with Reset Button */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <p className="text-xs text-gray-600">Drag cards to reorder</p>
            </div>
            <button
              onClick={resetCardOrder}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-1.5 border border-blue-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Order
            </button>
          </div>

          {/* Face Cards - 17 Metrics (Draggable) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {cardOrder.map((cardId) => {
              const card = getCardConfig(cardId, dashboardStats)
              
              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, card.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, card.id)}
                  className={`bg-white rounded shadow-sm border ${card.borderColor} p-2 cursor-move transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95`}
                >
                  {card.showIcon ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-[10px] font-semibold ${card.textColor} uppercase`}>
                          {card.title}
                        </p>
                        <div className={`w-6 h-6 ${card.isPositive ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'} rounded-lg flex items-center justify-center`}>
                          <svg className={`w-3 h-3 ${card.valueColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            {card.isPositive ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                            )}
                          </svg>
                        </div>
                      </div>
                      <p className={`text-sm font-bold ${card.valueColor}`}>
                        {card.isPositive ? '▲ ' : '▼ '}
                        {card.isPositive ? '' : '-'}
                        {card.formattedValue}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={`text-[10px] font-semibold ${card.textColor} uppercase tracking-wider mb-1`}>
                        {card.title}
                      </p>
                      <p className={`text-sm font-bold ${card.valueColor}`}>
                        {card.showArrow ? (
                          <>
                            {card.isPositive ? '▲ ' : '▼ '}
                            {card.isPositive ? '' : '-'}
                            {card.formattedValue}
                          </>
                        ) : (
                          card.value
                        )}
                      </p>
                    </>
                  )}
                </div>
              )
            })}
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