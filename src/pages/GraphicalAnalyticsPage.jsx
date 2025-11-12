import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import ChartWidget from '../components/dashboard/ChartWidget'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'

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

  const equityPctOfBalance = stats.totalBalance ? (stats.totalEquity / stats.totalBalance) * 100 : 0
  const creditPctOfBalance = stats.totalBalance ? (stats.totalCredit / stats.totalBalance) * 100 : 0

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
                <p className="text-sm text-gray-500 mt-0.5">Insights overview for {user?.full_name || user?.username}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors border border-blue-200"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Balance / Equity / Credit */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <ChartWidget title="Balance vs Credit vs Equity" type="bar" data={balanceSet} height={220} color="blue" />
              <div className="mt-2 text-xs text-gray-600">
                Equity is <span className="font-semibold text-gray-900">{fmt(equityPctOfBalance)}%</span> of Balance; Credit is <span className="font-semibold text-gray-900">{fmt(creditPctOfBalance)}%</span> of Balance.
              </div>
            </div>
            <div>
              <ChartWidget title="PnL (Daily / Week / Month / Lifetime)" type="bar" data={pnlSet} height={220} color="emerald" />
              <div className="mt-2 text-xs text-gray-600">
                Total PnL today: <span className={`font-semibold ${stats.dailyPnL>=0? 'text-green-700':'text-red-700'}`}>{fmt(stats.dailyPnL)}</span> | Lifetime PnL: <span className={`font-semibold ${stats.lifetimePnL>=0? 'text-green-700':'text-red-700'}`}>{fmt(stats.lifetimePnL)}</span>
              </div>
            </div>
          </div>

          {/* Deposits / Withdrawals and Commissions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <ChartWidget title="Deposits vs Withdrawals (Today)" type="bar" data={dwSet} height={220} color="orange" />
              <div className="mt-2 text-xs text-gray-600">
                Net DW Today: <span className={`font-semibold ${stats.netDW>=0? 'text-green-700':'text-red-700'}`}>{fmt(stats.netDW)}</span>
              </div>
            </div>
            <div>
              <ChartWidget title="Commissions (Total vs Available)" type="bar" data={commissionSet} height={220} color="amber" loading={loadingCommissions} />
              <div className="mt-2 text-xs text-gray-600">
                {loadingCommissions ? 'Loading commissions…' : `Available: ${fmt(stats.commAvail)} of ${fmt(stats.commTotal)} (${fmt(stats.commAvailPct)}%)`}
              </div>
            </div>
          </div>

          {/* Top IBs */}
          <div className="mb-6">
            <ChartWidget title="Top IBs by Available Commission" type="bar" data={topIBAvailSet} height={260} color="violet" loading={loadingCommissions} />
            <div className="mt-2 text-xs text-gray-600">
              Snapshot of top referrers by available commission.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default GraphicalAnalyticsPage
