import { useState, useEffect, useMemo } from 'react'
import { brokerAPI } from '../services/api'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const ClientDetailsMobileModal = ({ client, onClose, allPositionsCache }) => {
  const [activeTab, setActiveTab] = useState('positions')
  const [positions, setPositions] = useState([])
  const [netPositions, setNetPositions] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Date filter states for deals
  const [fromDate, setFromDate] = useState(null)
  const [toDate, setToDate] = useState(null)
  const [dealsLoading, setDealsLoading] = useState(false)
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false)
  const [quickFilter, setQuickFilter] = useState('Today')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50)

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
    fetchPositionsAndInitDeals()
  }, [client.login])

  // Reset pagination when tab changes or search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  const fetchPositionsAndInitDeals = async () => {
    try {
      setLoading(true)
      
      // Use cached positions
      const positionsData = allPositionsCache ? allPositionsCache.filter(pos => pos.login === client.login) : []
      setPositions(positionsData)

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

      // Set default date range to Today
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      setFromDate(todayStr)
      setToDate(todayStr)
      
      // Fetch deals for today by default
      const startOfDay = new Date(today)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(today)
      endOfDay.setHours(23, 59, 59, 999)
      
      await fetchDealsWithDateFilter(Math.floor(startOfDay.getTime() / 1000), Math.floor(endOfDay.getTime() / 1000))
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching client details:', error)
      setLoading(false)
    }
  }

  const fetchDealsWithDateFilter = async (fromTimestamp, toTimestamp) => {
    try {
      setDealsLoading(true)
      
      const dealsRes = await brokerAPI.getClientDeals(client.login, fromTimestamp, toTimestamp, 1000)
      const dealsData = dealsRes.data?.deals || dealsRes.deals || []
      setDeals(dealsData)
      setHasAppliedFilter(true)

      // Calculate stats with positions and deals data
      const totalPnL = positions.reduce((sum, p) => sum + (p.profit || 0), 0)
      const lifetimePnL = client.lifetimePnL || 0
      const bookPnL = lifetimePnL + totalPnL
      const totalVolume = dealsData.reduce((sum, d) => sum + (d.volume || 0), 0)
      
      const profitableDeals = dealsData.filter(d => (d.profit || 0) > 0).length
      const winRate = dealsData.length > 0 ? (profitableDeals / dealsData.length) * 100 : 0

      setStats({
        positionsCount: positions.length,
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

      setDealsLoading(false)
    } catch (error) {
      console.error('Error fetching deals:', error)
      setDeals([])
      setDealsLoading(false)
    }
  }

  const handleQuickFilter = async (filterType) => {
    setQuickFilter(filterType)
    setCurrentPage(1) // Reset to page 1
    const today = new Date()
    let fromDateObj, toDateObj

    switch(filterType) {
      case 'Today':
        fromDateObj = new Date(today)
        toDateObj = new Date(today)
        break
      case 'Last Week':
        fromDateObj = new Date(today)
        fromDateObj.setDate(today.getDate() - 7)
        toDateObj = new Date(today)
        break
      case 'Last Month':
        fromDateObj = new Date(today)
        fromDateObj.setMonth(today.getMonth() - 1)
        toDateObj = new Date(today)
        break
      case 'Last 3 Months':
        fromDateObj = new Date(today)
        fromDateObj.setMonth(today.getMonth() - 3)
        toDateObj = new Date(today)
        break
      case 'Last 6 Months':
        fromDateObj = new Date(today)
        fromDateObj.setMonth(today.getMonth() - 6)
        toDateObj = new Date(today)
        break
      case 'All History':
        fromDateObj = new Date('2020-01-01')
        toDateObj = new Date(today)
        break
      default:
        return
    }

    // Update date inputs
    setFromDate(fromDateObj)
    setToDate(toDateObj)

    // Fetch deals
    fromDateObj.setHours(0, 0, 0, 0)
    toDateObj.setHours(23, 59, 59, 999)
    await fetchDealsWithDateFilter(Math.floor(fromDateObj.getTime() / 1000), Math.floor(toDateObj.getTime() / 1000))
  }

  const handleApplyDateFilter = async () => {
    if (!fromDate && !toDate) return

    setCurrentPage(1) // Reset to page 1

    const fromDateObj = fromDate ? new Date(fromDate) : null
    const toDateObj = toDate ? new Date(toDate) : null

    if (fromDateObj) {
      fromDateObj.setHours(0, 0, 0, 0)
    }
    if (toDateObj) {
      toDateObj.setHours(23, 59, 59, 999)
    }

    const fromTimestamp = fromDateObj ? Math.floor(fromDateObj.getTime() / 1000) : 0
    const toTimestamp = toDateObj ? Math.floor(toDateObj.getTime() / 1000) : Math.floor(Date.now() / 1000)

    await fetchDealsWithDateFilter(fromTimestamp, toTimestamp)
  }

  const handleClearDateFilter = () => {
    setFromDate(null)
    setToDate(null)
    setDeals([])
    setHasAppliedFilter(false)
    setQuickFilter('Today')
    handleQuickFilter('Today')
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

  // Paginate data
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredPositions.slice(start, end)
  }, [filteredPositions, currentPage, itemsPerPage])

  const paginatedNetPositions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredNetPositions.slice(start, end)
  }, [filteredNetPositions, currentPage, itemsPerPage])

  const paginatedDeals = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return filteredDeals.slice(start, end)
  }, [filteredDeals, currentPage, itemsPerPage])

  const renderPositions = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead style={{ backgroundColor: '#4682b4' }}>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Position</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Symbol</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Volume</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Price</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedPositions.map((pos, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs text-blue-600">{pos.position || pos.ticket || '-'}</td>
              <td className="px-3 py-2 text-xs font-medium text-gray-900">{pos.symbol || '-'}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  pos.action === 'Buy' || pos.type === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {pos.action || pos.type || '-'}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-900">{formatNum(pos.volume || 0)}</td>
              <td className="px-3 py-2 text-xs text-gray-900">{formatNum(pos.priceOpen || pos.price || 0, 5)}</td>
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
        <thead style={{ backgroundColor: '#4682b4' }}>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Symbol</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Net Volume</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Profit</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedNetPositions.map((netPos, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs font-medium text-gray-900">{netPos.symbol}</td>
              <td className="px-3 py-2 text-xs text-gray-900">{formatNum(netPos.volume)}</td>
              <td className={`px-3 py-2 text-xs ${netPos.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(netPos.profit)}
              </td>
              <td className="px-3 py-2 text-xs text-gray-900">{netPos.positions.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  const renderDeals = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead style={{ backgroundColor: '#4682b4' }}>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Deal</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Symbol</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Type</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Volume</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-white">Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedDeals.map((deal, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-xs text-gray-900">{deal.deal}</td>
              <td className="px-3 py-2 text-xs text-gray-900">{deal.symbol}</td>
              <td className="px-3 py-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  deal.action === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {deal.action}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-gray-900">{formatNum(deal.volume)}</td>
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
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search email"
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {/* Pagination Buttons */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-md border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M15 18l-6-6 6-6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="w-8 h-8 rounded-md border border-gray-300 bg-white flex items-center justify-center hover:bg-gray-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {activeTab === 'positions' && `${currentPage} / ${Math.ceil(filteredPositions.length / itemsPerPage)} - ${filteredPositions.length} positions`}
            {activeTab === 'netPositions' && `${currentPage} / ${Math.ceil(filteredNetPositions.length / itemsPerPage)} - ${filteredNetPositions.length} net positions`}
            {activeTab === 'deals' && `${currentPage} / ${Math.ceil(filteredDeals.length / itemsPerPage)} - ${filteredDeals.length} deals`}
          </p>
        </div>

        {/* Date Filter for Deals Tab */}
        {activeTab === 'deals' && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">Date:</span>
                <DatePicker
                  selected={fromDate}
                  onChange={(date) => setFromDate(date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="From"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
                  calendarClassName="compact-calendar"
                  maxDate={toDate || new Date()}
                />
                <span className="text-xs text-gray-500">to</span>
                <DatePicker
                  selected={toDate}
                  onChange={(date) => setToDate(date)}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="To"
                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-full"
                  calendarClassName="compact-calendar"
                  minDate={fromDate}
                  maxDate={new Date()}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleApplyDateFilter}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={handleClearDateFilter}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
                <select
                  value={quickFilter}
                  onChange={(e) => handleQuickFilter(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded text-xs text-gray-900 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Today">Today</option>
                  <option value="Last Week">Last Week</option>
                  <option value="Last Month">Last Month</option>
                  <option value="Last 3 Months">Last 3 Months</option>
                  <option value="Last 6 Months">Last 6 Months</option>
                  <option value="All History">All History</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : activeTab === 'deals' && dealsLoading ? (
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
