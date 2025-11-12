import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'

// Vertical Bar Chart with solid colors and grid
const BarChart = ({ data, height = 260, color = 'blue', title = '', showGrid = true }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm font-medium">
        No data available
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const minVal = Math.min(...data.map(d => d.value), 0)
  const range = maxVal - minVal || 1
  const barWidth = Math.max(50, Math.min(80, (100 / data.length) - 10))
  
  const padding = { top: 40, right: 20, bottom: 60, left: 60 }
  const chartHeight = height - padding.top - padding.bottom

  const colorMap = {
    blue: '#2563eb',
    green: '#16a34a',
    emerald: '#059669',
    orange: '#ea580c',
    amber: '#d97706',
    violet: '#7c3aed',
    red: '#dc2626',
    indigo: '#4f46e5',
    cyan: '#0891b2',
    teal: '#0d9488'
  }

  const fillColor = colorMap[color] || colorMap.blue

  return (
    <svg width="100%" height={height} className="overflow-visible" style={{ fontFamily: 'system-ui' }}>
      {/* Grid lines */}
      {showGrid && [0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartHeight * (1 - pct)
        const value = (minVal + range * pct).toFixed(0)
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2="95%"
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              fontSize="11"
              textAnchor="end"
              className="fill-gray-600 font-medium"
            >
              {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)}
            </text>
          </g>
        )
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const isNegative = d.value < 0
        const absHeight = (Math.abs(d.value) / range) * chartHeight
        const zeroY = padding.top + chartHeight - ((0 - minVal) / range) * chartHeight
        const barY = isNegative ? zeroY : zeroY - absHeight
        const x = padding.left + (i / data.length) * (100 - padding.left - padding.right) + '%'

        return (
          <g key={i}>
            <rect
              x={x}
              y={barY}
              width={`${barWidth}px`}
              height={Math.max(2, absHeight)}
              fill={isNegative ? '#dc2626' : fillColor}
              rx="6"
              className="transition-all duration-200 hover:opacity-80 cursor-pointer"
            />
            <text
              x={`calc(${x} + ${barWidth / 2}px)`}
              y={padding.top + chartHeight + 20}
              fontSize="12"
              textAnchor="middle"
              className="fill-gray-700 font-semibold"
            >
              {d.label}
            </text>
            <text
              x={`calc(${x} + ${barWidth / 2}px)`}
              y={barY - 8}
              fontSize="11"
              textAnchor="middle"
              className="fill-gray-900 font-bold"
            >
              ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(d.value))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Area Chart for trend visualization
const AreaChart = ({ data, height = 260, color = 'emerald', title = '' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm font-medium">
        No data available
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => d.value))
  const minVal = Math.min(...data.map(d => d.value))
  const range = maxVal - minVal || 1
  
  const padding = { top: 40, right: 20, bottom: 60, left: 60 }
  const chartHeight = height - padding.top - padding.bottom
  const chartWidth = 100 - padding.left - padding.right

  const colorMap = {
    emerald: { line: '#059669', fill: '#d1fae5' },
    blue: { line: '#2563eb', fill: '#dbeafe' },
    orange: { line: '#ea580c', fill: '#fed7aa' },
    violet: { line: '#7c3aed', fill: '#e9d5ff' },
    red: { line: '#dc2626', fill: '#fecaca' }
  }

  const colors = colorMap[color] || colorMap.emerald

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartWidth
    const y = padding.top + chartHeight - ((d.value - minVal) / range) * chartHeight
    return { x, y, value: d.value, label: d.label }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`

  return (
    <svg width="100%" height={height} style={{ fontFamily: 'system-ui' }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = padding.top + chartHeight * (1 - pct)
        const value = minVal + range * pct
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2="95%" y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 4" />
            <text x={padding.left - 10} y={y + 4} fontSize="11" textAnchor="end" className="fill-gray-600 font-medium">
              {new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value)}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill={colors.fill} opacity="0.6" />
      
      {/* Line */}
      <path d={linePath} fill="none" stroke={colors.line} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="5" fill="white" stroke={colors.line} strokeWidth="2" className="cursor-pointer hover:r-6 transition-all" />
          <text x={p.x} y={padding.top + chartHeight + 20} fontSize="12" textAnchor="middle" className="fill-gray-700 font-semibold">
            {data[i].label}
          </text>
          <text x={p.x} y={p.y - 12} fontSize="11" textAnchor="middle" className="fill-gray-900 font-bold">
            ${new Intl.NumberFormat('en-US', { notation: 'compact' }).format(Math.abs(p.value))}
          </text>
        </g>
      ))}
    </svg>
  )
}

// Horizontal Bar Chart for comparisons
const HorizontalBarChart = ({ data, height = 300, color = 'blue' }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm font-medium">
        No data available
      </div>
    )
  }

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 1)
  const barHeight = 40
  const gap = 16
  const padding = { top: 20, right: 100, bottom: 20, left: 160 }

  const colorMap = {
    blue: '#2563eb',
    violet: '#7c3aed',
    orange: '#ea580c',
    amber: '#d97706'
  }

  const fillColor = colorMap[color] || colorMap.blue

  return (
    <svg width="100%" height={height} style={{ fontFamily: 'system-ui' }}>
      {data.map((d, i) => {
        const y = padding.top + i * (barHeight + gap)
        const barWidth = (Math.abs(d.value) / maxVal) * 60 // percentage of chart width
        const isNegative = d.value < 0

        return (
          <g key={i}>
            {/* Label */}
            <text x={padding.left - 10} y={y + barHeight / 2 + 4} fontSize="13" textAnchor="end" className="fill-gray-900 font-semibold">
              {d.label}
            </text>
            
            {/* Bar */}
            <rect
              x={`${padding.left}px`}
              y={y}
              width={`${barWidth}%`}
              height={barHeight}
              fill={isNegative ? '#dc2626' : fillColor}
              rx="6"
              className="transition-all duration-200 hover:opacity-80 cursor-pointer"
            />
            
            {/* Value */}
            <text
              x={`calc(${padding.left}px + ${barWidth}% + 10px)`}
              y={y + barHeight / 2 + 5}
              fontSize="13"
              className="fill-gray-900 font-bold"
            >
              ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.abs(d.value))}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Donut Chart Component with solid colors
const DonutChart = ({ data, size = 220, innerRadius = 0.65 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm font-medium">
        No data available
      </div>
    )
  }

  const total = data.reduce((sum, d) => sum + Math.abs(d.value), 0)
  let cumulativeAngle = 0

  const colors = [
    '#2563eb', // blue
    '#059669', // emerald
    '#d97706', // amber
    '#7c3aed', // violet
    '#dc2626', // red
    '#0891b2', // cyan
    '#db2777', // pink
    '#65a30d'  // lime
  ]

  const createArc = (startAngle, endAngle, innerR, outerR) => {
    const start = polarToCartesian(0, 0, outerR, endAngle)
    const end = polarToCartesian(0, 0, outerR, startAngle)
    const innerStart = polarToCartesian(0, 0, innerR, endAngle)
    const innerEnd = polarToCartesian(0, 0, innerR, startAngle)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return [
      'M', start.x, start.y,
      'A', outerR, outerR, 0, largeArc, 0, end.x, end.y,
      'L', innerEnd.x, innerEnd.y,
      'A', innerR, innerR, 0, largeArc, 1, innerStart.x, innerStart.y,
      'Z'
    ].join(' ')
  }

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    }
  }

  const outerRadius = size / 2 - 10
  const innerR = outerRadius * innerRadius

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} style={{ fontFamily: 'system-ui' }}>
        {data.map((d, i) => {
          const angle = (Math.abs(d.value) / total) * 360
          const startAngle = cumulativeAngle
          const endAngle = cumulativeAngle + angle
          cumulativeAngle = endAngle

          const midAngle = (startAngle + endAngle) / 2
          const labelRadius = (outerRadius + innerR) / 2
          const labelPos = polarToCartesian(0, 0, labelRadius, midAngle)

          return (
            <g key={i}>
              <path
                d={createArc(startAngle, endAngle, innerR, outerRadius)}
                fill={colors[i % colors.length]}
                stroke="white"
                strokeWidth="2"
                className="transition-all duration-200 hover:opacity-75 cursor-pointer"
              />
              {angle > 12 && (
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fontSize="13"
                  fontWeight="700"
                  textAnchor="middle"
                  className="fill-white pointer-events-none"
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {((Math.abs(d.value) / total) * 100).toFixed(0)}%
                </text>
              )}
            </g>
          )
        })}
        <text
          x="0"
          y="-5"
          fontSize="24"
          fontWeight="800"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-gray-800"
        >
          {data.length}
        </text>
        <text
          x="0"
          y="18"
          fontSize="12"
          textAnchor="middle"
          className="fill-gray-600 font-semibold"
        >
          Categories
        </text>
      </svg>
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 w-full max-w-sm">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded flex-shrink-0 shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}></div>
            <span className="text-sm text-gray-800 font-semibold truncate">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Insight Card Component with solid colors
const InsightCard = ({ icon, title, value, subtitle, trend, trendValue, color = 'blue' }) => {
  const colorMap = {
    blue: { bg: 'bg-blue-500', border: 'border-blue-100' },
    green: { bg: 'bg-green-500', border: 'border-green-100' },
    red: { bg: 'bg-red-500', border: 'border-red-100' },
    orange: { bg: 'bg-orange-500', border: 'border-orange-100' },
    violet: { bg: 'bg-violet-500', border: 'border-violet-100' },
    indigo: { bg: 'bg-indigo-500', border: 'border-indigo-100' },
    emerald: { bg: 'bg-emerald-500', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-500', border: 'border-amber-100' }
  }

  const colors = colorMap[color] || colorMap.blue

  return (
    <div className={`bg-white rounded-xl shadow-md border-2 ${colors.border} p-5 hover:shadow-lg transition-all duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
            trend === 'up' ? 'bg-green-100 text-green-700' : trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
          }`}>
            {trend === 'up' && <span>↑</span>}
            {trend === 'down' && <span>↓</span>}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-extrabold text-gray-900 mb-1">{value}</p>
      {subtitle && <p className="text-sm text-gray-700 font-medium">{subtitle}</p>}
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
    <div className="min-h-screen flex bg-gray-50">
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
                <h1 className="text-3xl font-extrabold text-indigo-700">
                  Graphical Analytics
                </h1>
                <p className="text-sm text-gray-700 mt-1 font-medium">Comprehensive performance insights for {user?.full_name || user?.username}</p>
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
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                Portfolio Composition
              </h3>
              <div className="flex items-center justify-center">
                <DonutChart data={portfolioComposition} size={220} />
              </div>
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-blue-800">Insight:</span> Equity represents {equityPctOfBalance.toFixed(1)}% of your balance, indicating {equityPctOfBalance > 80 ? 'strong' : equityPctOfBalance > 50 ? 'moderate' : 'weak'} account health.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Balance Breakdown
              </h3>
              <BarChart data={balanceSet} height={260} color="blue" />
              <div className="mt-4 p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-indigo-800">Insight:</span> Total balance is ${fmt(stats.totalBalance)} with ${fmt(stats.totalCredit)} in credit. Maintain credit below 30% of equity for optimal risk management.
                </p>
              </div>
            </div>
          </div>

          {/* PnL Trends */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              Profit & Loss Trends
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <AreaChart data={pnlSet} height={260} color="emerald" />
              </div>
              <div className="flex flex-col justify-center gap-4">
                <div className="p-5 bg-emerald-50 rounded-xl border-2 border-emerald-300 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Daily PnL</span>
                    <span className={`text-xl font-extrabold ${stats.dailyPnL >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ${fmt(Math.abs(stats.dailyPnL))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    {stats.dailyPnL >= 0 ? '↑' : '↓'} {stats.dailyPnL >= 0 ? 'Profit' : 'Loss'} today
                  </p>
                </div>
                <div className="p-5 bg-cyan-50 rounded-xl border-2 border-cyan-300 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Weekly PnL</span>
                    <span className={`text-xl font-extrabold ${stats.thisWeekPnL >= 0 ? 'text-cyan-700' : 'text-orange-700'}`}>
                      ${fmt(Math.abs(stats.thisWeekPnL))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    {stats.thisWeekPnL >= 0 ? '↑' : '↓'} {((stats.thisWeekPnL / (stats.totalBalance || 1)) * 100).toFixed(2)}% of balance
                  </p>
                </div>
                <div className="p-5 bg-violet-50 rounded-xl border-2 border-violet-300 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Lifetime PnL</span>
                    <span className={`text-xl font-extrabold ${stats.lifetimePnL >= 0 ? 'text-violet-700' : 'text-pink-700'}`}>
                      ${fmt(Math.abs(stats.lifetimePnL))}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium">
                    {stats.lifetimePnL >= 0 ? '↑' : '↓'} Cumulative {stats.lifetimePnL >= 0 ? 'profit' : 'loss'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deposits vs Withdrawals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Daily Deposits & Withdrawals
              </h3>
              <BarChart data={dwSet} height={260} color="orange" />
              <div className="mt-4 p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
                <p className="text-sm text-gray-700">
                  <span className="font-bold text-orange-800">Net Flow:</span> {stats.netDW >= 0 ? 'Positive inflow of' : 'Negative outflow of'} ${fmt(Math.abs(stats.netDW))} today. {stats.netDW >= 0 ? 'Good liquidity.' : 'Monitor cash flow.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Commission Overview
              </h3>
              {loadingCommissions ? (
                <div className="flex items-center justify-center h-60 text-gray-500 font-medium">Loading...</div>
              ) : (
                <>
                  <BarChart data={commissionSet} height={260} color="amber" />
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg border-2 border-amber-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-bold text-amber-800">Available:</span> ${fmt(stats.commAvail)} of ${fmt(stats.commTotal)} ({stats.commAvailPct.toFixed(1)}%) ready to distribute.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Top IBs */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Top IBs by Available Commission
            </h3>
            {loadingCommissions ? (
              <div className="flex items-center justify-center h-60 text-gray-500 font-medium">Loading...</div>
            ) : topIBAvailSet.length > 0 ? (
              <>
                <HorizontalBarChart data={topIBAvailSet} height={Math.min(360, topIBAvailSet.length * 56 + 40)} color="violet" />
                <div className="mt-4 p-4 bg-violet-50 rounded-lg border-2 border-violet-200">
                  <p className="text-sm text-gray-700">
                    <span className="font-bold text-violet-800">Top Performer:</span> {topIBAvailSet[0]?.label || 'N/A'} leads with ${fmt(topIBAvailSet[0]?.value || 0)} available commission.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-500 font-medium">No IB data available</div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default GraphicalAnalyticsPage
