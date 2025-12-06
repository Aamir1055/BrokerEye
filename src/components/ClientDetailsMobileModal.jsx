import { useState, useEffect, useMemo } from 'react'
import { brokerAPI } from '../services/api'

const ClientDetailsMobileModal = ({ client, onClose, allPositionsCache }) => {
  const [activeTab, setActiveTab] = useState('positions')
  const [positions, setPositions] = useState([])
  const [netPositions, setNetPositions] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Summary stats
  const [stats, setStats] = useState({
    positionsCount: 0,
    totalPnL: 0,
    lifetimePnL: 0,
    bookPnL: 0,
    balance: 0,
    credit: 0,
    equity: 0,
    totalVolume: 0,
    totalDeals: 0,
    winRate: 0
  })

  useEffect(() => {
    fetchData()
  }, [client.login])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Use cached positions (same as desktop modal)
      const positionsData = allPositionsCache ? allPositionsCache.filter(pos => pos.login === client.login) : []
      setPositions(positionsData)

      // Fetch deals using correct API with timestamps (last 30 days)
      const to = Math.floor(Date.now() / 1000)
      const from = to - (30 * 24 * 60 * 60)
      const dealsRes = await brokerAPI.getClientDeals(client.login, from, to, 1000)
      const dealsData = dealsRes.data?.deals || dealsRes.deals || []
      setDeals(dealsData)

      // Calculate net positions
      const netPosMap = {}
      positionsData.forEach(pos => {
        const symbol = pos.symbol
        if (!netPosMap[symbol]) {
          netPosMap[symbol] = {
            symbol,
            volume: 0,
            profit: 0,
            positions: []
          }
        }
        const volumeWithSign = pos.action === 'Buy' ? pos.volume : -pos.volume
        netPosMap[symbol].volume += volumeWithSign
        netPosMap[symbol].profit += (pos.profit || 0)
        netPosMap[symbol].positions.push(pos)
      })
      setNetPositions(Object.values(netPosMap))

      // Calculate stats
      const totalPnL = positionsData.reduce((sum, p) => sum + (p.profit || 0), 0)
      const lifetimePnL = client.lifetimePnL || 0
      const bookPnL = lifetimePnL + totalPnL
      const totalVolume = dealsData.reduce((sum, d) => sum + (d.volume || 0), 0)
      
      // Calculate win rate
      const profitableDeals = dealsData.filter(d => (d.profit || 0) > 0).length
      const winRate = dealsData.length > 0 ? (profitableDeals / dealsData.length) * 100 : 0

      setStats({
        positionsCount: positionsData.length,
        totalPnL,
        lifetimePnL,
        bookPnL,
        balance: client.balance || 0,
        credit: client.credit || 0,
        equity: client.equity || 0,
        totalVolume,
        totalDeals: dealsData.length,
        winRate
      })

      setLoading(false)
    } catch (error) {
      console.error('Error fetching client details:', error)
      setLoading(false)
    }
  }

  const formatNum = (num, decimals = 2) => {
    if (num == null || isNaN(num)) return '0.00'
    return Number(num).toFixed(decimals)
  }

  // Filter data based on search
  const filteredPositions = useMemo(() => {
    if (!searchQuery.trim()) return positions
    const query = searchQuery.toLowerCase()
    return positions.filter(p => 
      (p.symbol || '').toLowerCase().includes(query) ||
      (p.position || '').toString().includes(query)
    )
  }, [positions, searchQuery])

  const filteredNetPositions = useMemo(() => {
    if (!searchQuery.trim()) return netPositions
    const query = searchQuery.toLowerCase()
    return netPositions.filter(p => 
      (p.symbol || '').toLowerCase().includes(query)
    )
  }, [netPositions, searchQuery])

  const filteredDeals = useMemo(() => {
    if (!searchQuery.trim()) return deals
    const query = searchQuery.toLowerCase()
    return deals.filter(d => 
      (d.symbol || '').toLowerCase().includes(query) ||
      (d.deal || '').toString().includes(query)
    )
  }, [deals, searchQuery])

  const renderPositions = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Position</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Symbol</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Volume</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Price</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredPositions.map((pos, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs text-blue-600">{pos.position || pos.ticket || '-'}</td>
              <td className="px-3 py-2 text-xs font-medium">{pos.symbol || '-'}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  pos.action === 'Buy' || pos.type === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {pos.action || pos.type || '-'}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{formatNum(pos.volume || 0)}</td>
              <td className="px-3 py-2 text-xs">{formatNum(pos.priceOpen || pos.price || 0, 5)}</td>
              <td className={`px-3 py-2 text-xs ${(pos.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(pos.profit || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderNetPositions = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Symbol</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Net Volume</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Profit</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredNetPositions.map((netPos, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs font-medium">{netPos.symbol}</td>
              <td className="px-3 py-2 text-xs">{formatNum(netPos.volume)}</td>
              <td className={`px-3 py-2 text-xs ${netPos.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(netPos.profit)}
              </td>
              <td className="px-3 py-2 text-xs">{netPos.positions.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderDeals = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Deal</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Symbol</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Volume</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredDeals.map((deal, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs">{deal.deal}</td>
              <td className="px-3 py-2 text-xs">{deal.symbol}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  deal.action === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {deal.action}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{formatNum(deal.volume)}</td>
              <td className={`px-3 py-2 text-xs ${(deal.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(deal.profit || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:hidden">
      <div className="bg-white w-full h-[95vh] rounded-t-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <h2 className="text-lg font-semibold">Clients Detail Page</h2>
          <div className="w-9" />
        </div>

        {/* Client Info Card */}
        <div className="px-4 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-lg font-semibold text-gray-600">
                {(client.name || client.fullName || 'U')[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                {client.name || client.fullName || 'Unknown'}
              </h3>
              <p className="text-sm text-gray-600">{client.login}</p>
              <p className="text-xs text-gray-500">{client.email || '-'}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('positions')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'positions'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Positions ({filteredPositions.length})
            </button>
            <button
              onClick={() => setActiveTab('netPositions')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'netPositions'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Net Positions ({filteredNetPositions.length})
            </button>
            <button
              onClick={() => setActiveTab('deals')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'deals'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Deals ({filteredDeals.length})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search email"
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {activeTab === 'positions' && `1 of ${filteredPositions.length} positions`}
            {activeTab === 'netPositions' && `${filteredNetPositions.length} net positions`}
            {activeTab === 'deals' && `${filteredDeals.length} deals`}
          </p>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="bg-white">
              {activeTab === 'positions' && renderPositions()}
              {activeTab === 'netPositions' && renderNetPositions()}
              {activeTab === 'deals' && renderDeals()}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="px-4 py-3 bg-white border-t border-gray-200">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Positions</p>
              <p className="text-sm font-bold text-gray-900 truncate">{stats.positionsCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Total P/L</p>
              <p className={`text-sm font-bold truncate ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(stats.totalPnL)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Lifetime</p>
              <p className={`text-sm font-bold truncate ${stats.lifetimePnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(stats.lifetimePnL)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Book PNL</p>
              <p className={`text-sm font-bold truncate ${stats.bookPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(stats.bookPnL)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Balance</p>
              <p className="text-sm font-bold text-gray-900 truncate">{formatNum(stats.balance)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Credit</p>
              <p className="text-sm font-bold text-gray-900 truncate">{formatNum(stats.credit)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Equity</p>
              <p className="text-sm font-bold text-gray-900 truncate">{formatNum(stats.equity)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Deals</p>
              <p className="text-sm font-bold text-gray-900 truncate">{stats.totalDeals}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] text-gray-600 uppercase font-semibold">Win Rate</p>
              <p className="text-sm font-bold text-green-600 truncate">{formatNum(stats.winRate)}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClientDetailsMobileModal
