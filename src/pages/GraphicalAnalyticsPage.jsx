import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'

// Enhanced Bar Chart Component with gradients and animations
const BarChart = ({ data, height = 240, color = 'blue', showValues = true }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No data available
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)))
  const minVal = Math.min(...data.map(d => d.value), 0)
  const range = maxVal - minVal || 1
  const barWidth = Math.max(60, Math.min(100, (100 / data.length) - 8))

  const colorMap = {
    blue: { from: '#3b82f6', to: '#1e40af', text: 'text-blue-600' },
    green: { from: '#10b981', to: '#065f46', text: 'text-green-600' },
    emerald: { from: '#10b981', to: '#047857', text: 'text-emerald-600' },
    orange: { from: '#f97316', to: '#c2410c', text: 'text-orange-600' },
    amber: { from: '#f59e0b', to: '#b45309', text: 'text-amber-600' },
    violet: { from: '#8b5cf6', to: '#5b21b6', text: 'text-violet-600' },
    red: { from: '#ef4444', to: '#991b1b', text: 'text-red-600' },
    indigo: { from: '#6366f1', to: '#3730a3', text: 'text-indigo-600' }
  }

  const colors = colorMap[color] || colorMap.blue

  return (
    <svg width="100%" height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: colors.from, stopOpacity: 0.9 }} />
          <stop offset="100%" style={{ stopColor: colors.to, stopOpacity: 0.7 }} />
        </linearGradient>
      </defs>
      {data.map((d, i) => {
        const isNegative = d.value < 0
        const absHeight = (Math.abs(d.value) / range) * (height * 0.7)
        const zeroY = height * 0.8 - ((0 - minVal) / range) * (height * 0.7)
        const barY = isNegative ? zeroY : zeroY - absHeight
        const x = (i / data.length) * 100

        return (
          <g key={i}>
            <rect
              x={`${x + 2}%`}
              y={barY}
              width={`${barWidth}px`}
              height={Math.max(2, absHeight)}
              fill={`url(#grad-${color})`}
              rx="4"
              className="transition-all duration-300 hover:opacity-80"
            >
              <animate
                attributeName="height"
                from="0"
                to={Math.max(2, absHeight)}
                dur="0.6s"
                fill="freeze"
              />
            </rect>
            <text
              x={`${x + barWidth / 2 + 2}%`}
              y={height * 0.92}
              fontSize="11"
              textAnchor="middle"
              className="fill-gray-600 font-medium"
            >
              {d.label}
            </text>
            {showValues && (
              <text
                x={`${x + barWidth / 2 + 2}%`}
                y={barY - 6}
                fontSize="10"
                textAnchor="middle"
                className={`font-semibold ${colors.text}`}
              >
                {new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(d.value)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// Donut Chart Component for proportions
const DonutChart = ({ data, size = 180, centerLabel, centerValue }) => {
  if (!data || data.length === 0) return null

  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0)
  if (total === 0) return null

  const colorPalette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']
  let cumulativePercent = 0

  const segments = data.map((d, i) => {
    const percent = (Math.abs(d.value) / total) * 100
    const startAngle = (cumulativePercent / 100) * 360
    const endAngle = ((cumulativePercent + percent) / 100) * 360
    cumulativePercent += percent

    const radius = size / 2
    const innerRadius = radius * 0.6
    const x1 = radius + radius * Math.cos((startAngle - 90) * Math.PI / 180)
    const y1 = radius + radius * Math.sin((startAngle - 90) * Math.PI / 180)
    const x2 = radius + radius * Math.cos((endAngle - 90) * Math.PI / 180)
    const y2 = radius + radius * Math.sin((endAngle - 90) * Math.PI / 180)
    const largeArc = percent > 50 ? 1 : 0

    const pathData = [
      `M ${radius + innerRadius * Math.cos((startAngle - 90) * Math.PI / 180)} ${radius + innerRadius * Math.sin((startAngle - 90) * Math.PI / 180)}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${radius + innerRadius * Math.cos((endAngle - 90) * Math.PI / 180)} ${radius + innerRadius * Math.sin((endAngle - 90) * Math.PI / 180)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${radius + innerRadius * Math.cos((startAngle - 90) * Math.PI / 180)} ${radius + innerRadius * Math.sin((startAngle - 90) * Math.PI / 180)}`
    ].join(' ')

    return { pathData, color: colorPalette[i % colorPalette.length], label: d.label, value: d.value, percent }
  })

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size}>
        {segments.map((seg, i) => (
          <path key={i} d={seg.pathData} fill={seg.color} className="transition-all duration-300 hover:opacity-80">
            <animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze" />
          </path>
        ))}
        {centerLabel && (
          <>
            <text x={size / 2} y={size / 2 - 8} textAnchor="middle" className="text-xs fill-gray-500 font-medium">
              {centerLabel}
            </text>
            <text x={size / 2} y={size / 2 + 8} textAnchor="middle" className="text-lg fill-gray-900 font-bold">
              {centerValue}
            </text>
          </>
        )}
      </svg>
      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-700 font-medium">{seg.label}</span>
            <span className="text-gray-500">({seg.percent.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Insight Card Component
const InsightCard = ({ icon, title, value, subtitle, trend, trendValue, color = 'blue' }) => {
  const colorMap = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
    orange: 'from-orange-500 to-orange-600',
    violet: 'from-violet-500 to-violet-600',
    indigo: 'from-indigo-500 to-indigo-600'
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[color]} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
            trend === 'up' ? 'bg-green-50 text-green-600' : trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'
          }`}>
            {trend === 'up' && <span>↑</span>}
            {trend === 'down' && <span>↓</span>}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
    </div>
  )
}

const GraphicalAnalyticsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const { clients, positions } = useData()

  // Commission totals from API (same as Dashboard)
  const [commissionTotals, setCommissionTotals] = useState(null)
  const [topIB, setTopIB] = useState([])
  const [loadingCommissions, setLoadingCommissions] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [totalsRes, ibRes] = await Promise.all([
          brokerAPI.getIBCommissionTotals(),
          brokerAPI.getIBCommissions(1, 10, '', 'available_commission', 'desc')
        ])
        setCommissionTotals(totalsRes?.data || null)
        setTopIB(ibRes?.data?.records || [])
      } catch (e) {
        // non-fatal
      } finally {
        setLoadingCommissions(false)
      }
    }
    fetchAll()
  }, [])

  // Face-card-like totals reused for charts
  const stats = useMemo(() => {
    const list = clients || []
    const sum = (key) => list.reduce((acc, c) => {
      const v = c?.[key]
      return acc + (typeof v === 'number' ? v : 0)
    }, 0)

    const totalPnl = list.reduce((acc, c) => {
      const hasPnl = typeof c?.pnl === 'number'
      const computed = hasPnl ? c.pnl : ((c?.credit || 0) - (c?.equity || 0))
      return acc + (typeof computed === 'number' && !Number.isNaN(computed) ? computed : 0)
    }, 0)

    const dailyDeposit = sum('dailyDeposit')
    const dailyWithdrawal = sum('dailyWithdrawal')
    const netDW = dailyDeposit - dailyWithdrawal

    return {
      totalClients: list.length,
      totalBalance: sum('balance'),
      totalCredit: sum('credit'),
      totalEquity: sum('equity'),
      totalPnl,
      totalProfit: sum('profit'),
      dailyDeposit,
      dailyWithdrawal,
      netDW,
      dailyPnL: sum('dailyPnL'),
      thisWeekPnL: sum('thisWeekPnL'),
      thisMonthPnL: sum('thisMonthPnL'),
      lifetimePnL: sum('lifetimePnL'),
      commTotal: commissionTotals?.total_commission || 0,
      commAvail: commissionTotals?.total_available_commission || 0,
      commTotalPct: commissionTotals?.total_commission_percentage || 0,
      commAvailPct: commissionTotals?.total_available_commission_percentage || 0,
    }
  }, [clients, commissionTotals])

  // Datasets for charts
  const balanceSet = [
    { label: 'Balance', value: Math.max(0, stats.totalBalance || 0) },
    { label: 'Credit', value: Math.max(0, stats.totalCredit || 0) },
    { label: 'Equity', value: Math.max(0, stats.totalEquity || 0) }
  ]

  const dwSet = [
    { label: 'Deposit', value: Math.max(0, stats.dailyDeposit || 0) },
    { label: 'Withdrawal', value: Math.max(0, stats.dailyWithdrawal || 0) },
    { label: 'Net DW', value: stats.netDW || 0 }
  ]

  const pnlSet = [
    { label: 'Daily', value: stats.dailyPnL || 0 },
    { label: 'Week', value: stats.thisWeekPnL || 0 },
    { label: 'Month', value: stats.thisMonthPnL || 0 },
    { label: 'Lifetime', value: stats.lifetimePnL || 0 }
  ]

  const commissionSet = [
    { label: 'Total', value: stats.commTotal || 0 },
    { label: 'Available', value: stats.commAvail || 0 }
  ]

  const topIBAvailSet = (topIB || []).map((ib) => ({ label: ib.name || String(ib.id || ''), value: ib.available_commission || 0 })).slice(0, 6)

  // Helper format
  const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0)
  const fmtCompact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0)

  const equityPctOfBalance = stats.totalBalance ? (stats.totalEquity / stats.totalBalance) * 100 : 0
  const creditPctOfBalance = stats.totalBalance ? (stats.totalCredit / stats.totalBalance) * 100 : 0
  const profitMargin = stats.totalBalance ? (stats.totalProfit / stats.totalBalance) * 100 : 0

  // Portfolio composition for donut
  const portfolioComposition = [
    { label: 'Balance', value: stats.totalBalance },
    { label: 'Credit', value: stats.totalCredit },
    { label: 'Equity', value: stats.totalEquity }
  ].filter(d => d.value > 0)

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Graphical Analytics
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">Comprehensive performance insights for {user?.full_name || user?.username}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors border border-blue-200 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
          </div>

          {/* Key Metrics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
              title="Total Clients"
              value={stats.totalClients}
              subtitle={`Active accounts`}
              color="blue"
            />
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="Total Equity"
              value={`$${fmtCompact(stats.totalEquity)}`}
              subtitle={`${equityPctOfBalance.toFixed(1)}% of balance`}
              color="indigo"
            />
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              title="Total PnL"
              value={`$${fmtCompact(Math.abs(stats.totalPnl))}`}
              subtitle={stats.totalPnl >= 0 ? 'Profit' : 'Loss'}
              trend={stats.totalPnl >= 0 ? 'up' : 'down'}
              trendValue={`${((stats.totalPnl / (stats.totalBalance || 1)) * 100).toFixed(2)}%`}
              color={stats.totalPnl >= 0 ? 'green' : 'red'}
            />
            <InsightCard
              icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
              title="Open Positions"
              value={positions.length}
              subtitle={`Floating: $${fmtCompact(stats.totalProfit)}`}
              trend={stats.totalProfit >= 0 ? 'up' : 'down'}
              trendValue={`${profitMargin.toFixed(2)}%`}
              color={stats.totalProfit >= 0 ? 'green' : 'red'}
            />
          </div>

          {/* Portfolio Overview with Donut + Balance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Portfolio Composition
              </h3>
              <div className="flex items-center justify-center">
                <DonutChart 
                  data={portfolioComposition} 
                  size={200} 
                  centerLabel="Total" 
                  centerValue={`$${fmtCompact(stats.totalBalance + stats.totalCredit + stats.totalEquity)}`}
                />
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-blue-700">Insight:</span> Equity represents {equityPctOfBalance.toFixed(1)}% of your balance, indicating {equityPctOfBalance > 80 ? 'strong' : equityPctOfBalance > 50 ? 'moderate' : 'weak'} account health.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Balance Breakdown
              </h3>
              <BarChart data={balanceSet} height={240} color="blue" showValues={true} />
              <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-indigo-700">Insight:</span> Total balance is ${fmt(stats.totalBalance)} with ${fmt(stats.totalCredit)} in credit. Maintain credit below 30% of equity for optimal risk management.
                </p>
              </div>
            </div>
          </div>

          {/* PnL Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Profit & Loss Trends
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <BarChart data={pnlSet} height={260} color="emerald" showValues={true} />
              </div>
              <div className="flex flex-col justify-center gap-4">
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Daily PnL</span>
                    <span className={`text-lg font-bold ${stats.dailyPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ${fmt(Math.abs(stats.dailyPnL))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {stats.dailyPnL >= 0 ? '↑' : '↓'} {stats.dailyPnL >= 0 ? 'Profit' : 'Loss'} today
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Weekly PnL</span>
                    <span className={`text-lg font-bold ${stats.thisWeekPnL >= 0 ? 'text-cyan-700' : 'text-orange-700'}`}>
                      ${fmt(Math.abs(stats.thisWeekPnL))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {stats.thisWeekPnL >= 0 ? '↑' : '↓'} {((stats.thisWeekPnL / (stats.totalBalance || 1)) * 100).toFixed(2)}% of balance
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg border border-violet-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Lifetime PnL</span>
                    <span className={`text-lg font-bold ${stats.lifetimePnL >= 0 ? 'text-violet-700' : 'text-pink-700'}`}>
                      ${fmt(Math.abs(stats.lifetimePnL))}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {stats.lifetimePnL >= 0 ? '↑' : '↓'} Cumulative {stats.lifetimePnL >= 0 ? 'profit' : 'loss'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deposits vs Withdrawals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Daily Deposits & Withdrawals
              </h3>
              <BarChart data={dwSet} height={240} color="orange" showValues={true} />
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold text-orange-700">Net Flow:</span> {stats.netDW >= 0 ? 'Positive inflow of' : 'Negative outflow of'} ${fmt(Math.abs(stats.netDW))} today. {stats.netDW >= 0 ? 'Good liquidity.' : 'Monitor cash flow.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Commission Overview
              </h3>
              {loadingCommissions ? (
                <div className="flex items-center justify-center h-60 text-gray-400">Loading...</div>
              ) : (
                <>
                  <BarChart data={commissionSet} height={240} color="amber" showValues={true} />
                  <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold text-amber-700">Available:</span> ${fmt(stats.commAvail)} of ${fmt(stats.commTotal)} ({stats.commAvailPct.toFixed(1)}%) ready to distribute.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top IBs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Top IBs by Available Commission
            </h3>
            {loadingCommissions ? (
              <div className="flex items-center justify-center h-60 text-gray-400">Loading...</div>
            ) : topIBAvailSet.length > 0 ? (
              <>
                <BarChart data={topIBAvailSet} height={280} color="violet" showValues={true} />
                <div className="mt-4 p-3 bg-violet-50 rounded-lg border border-violet-100">
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold text-violet-700">Top Performer:</span> {topIBAvailSet[0]?.label || 'N/A'} leads with ${fmt(topIBAvailSet[0]?.value || 0)} available commission.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400">No IB data available</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default GraphicalAnalyticsPage
