import { useState, useEffect, useMemo, useRef } from 'react'
import { brokerAPI } from '../services/api'

const formatDate = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const formatDateToDisplay = (dateStr) => {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  const shortYear = year.slice(-2) // Get last 2 digits of year
  return `${day}/${month}/${shortYear}`
}

const formatDateToValue = (displayStr) => {
  if (!displayStr) return ''
  const [day, month, year] = displayStr.split('/')
  // Handle 2-digit year by prepending '20'
  const fullYear = year.length === 2 ? '20' + year : year
  return `${fullYear}-${month}-${day}`
}

const ClientDetailsMobileModal = ({ client, onClose, allPositionsCache }) => {
  const [activeTab, setActiveTab] = useState('positions')
  const [positions, setPositions] = useState([])
  const [netPositions, setNetPositions] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [positionsSearch, setPositionsSearch] = useState('')
  const [netPositionsSearch, setNetPositionsSearch] = useState('')
  const [dealsSearch, setDealsSearch] = useState('')
  
  // Date filter states for deals
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [dealsLoading, setDealsLoading] = useState(false)
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false)
  const [quickFilter, setQuickFilter] = useState('Today')
  const [totalDealsCount, setTotalDealsCount] = useState(0)
  const [currentDateFilter, setCurrentDateFilter] = useState({ from: 0, to: 0 })
  
  // Refs for date inputs
  const fromDateInputRef = useRef(null)
  const toDateInputRef = useRef(null)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(12)

  // Sorting states
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })

  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [positionColumns, setPositionColumns] = useState({
    position: true,
    symbol: true,
    action: true,
    volume: true,
    priceOpen: true,
    profit: true
  })
  const [netPositionColumns, setNetPositionColumns] = useState({
    symbol: true,
    netType: true,
    volume: true,
    avgPrice: true,
    profit: true,
    positions: true
  })
  const [dealColumns, setDealColumns] = useState({
    deal: true,
    time: true,
    symbol: true,
    action: true,
    volume: true,
    profit: true
  })

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

  const netStats = useMemo(() => {
    const symbols = netPositions.length
    const totalNetVolume = netPositions.reduce((s, p) => s + (p.volume || 0), 0)
    let buyFloating = 0
    let sellFloating = 0
    positions.forEach(p => {
      const action = (p.action || p.type || '').toString().toLowerCase()
      if (action === 'buy' || p.action === 0 || p.type === 0) buyFloating += (p.profit || 0)
      else sellFloating += (p.profit || 0)
    })
    return { symbols, totalNetVolume, buyFloating, sellFloating }
  }, [netPositions, positions])

  useEffect(() => {
    fetchPositionsAndInitDeals()
  }, [client.login])

  // Reset pagination when tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Fetch deals when page changes in deals tab
  useEffect(() => {
    if (activeTab === 'deals' && hasAppliedFilter && currentDateFilter.from !== 0) {
      fetchDealsWithDateFilter(currentDateFilter.from, currentDateFilter.to, currentPage)
    }
  }, [currentPage, activeTab])

  // Handle column sorting
  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Sort function
  const sortData = (data, key, direction) => {
    if (!key) return data
    
    return [...data].sort((a, b) => {
      let aVal = a[key]
      let bVal = b[key]
      
      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      // Handle string values
      aVal = String(aVal || '').toLowerCase()
      bVal = String(bVal || '').toLowerCase()
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const fetchPositionsAndInitDeals = async () => {
    try {
      setLoading(true)
      
      // Use cached positions
      const positionsData = allPositionsCache ? allPositionsCache.filter(pos => pos.login === client.login) : []
      setPositions(positionsData)

      // Calculate net positions per symbol (desktop parity)
      const netPosMap = new Map()
      positionsData.forEach(pos => {
        const symbol = pos.symbol
        if (!symbol) return
        if (!netPosMap.has(symbol)) {
          netPosMap.set(symbol, {
            symbol,
            buyPositions: [],
            sellPositions: []
          })
        }
        const bucket = netPosMap.get(symbol)
        const action = (pos.action || pos.type || '').toString().toLowerCase()
        if (action === 'buy' || pos.action === 0 || pos.type === 0) bucket.buyPositions.push(pos)
        else bucket.sellPositions.push(pos)
      })

      const computedNet = []
      netPosMap.forEach(group => {
        const buyVol = group.buyPositions.reduce((s, p) => s + (p.volume || 0), 0)
        const sellVol = group.sellPositions.reduce((s, p) => s + (p.volume || 0), 0)

        if (buyVol > 0) {
          let twB = 0, tpB = 0
          group.buyPositions.forEach(p => {
            const v = p.volume || 0
            const pr = p.priceOpen || p.price || 0
            twB += pr * v
            tpB += p.profit || 0
          })
          const avgB = buyVol > 0 ? twB / buyVol : 0
          computedNet.push({
            symbol: group.symbol,
            netType: 'Buy',
            volume: buyVol,
            avgPrice: avgB,
            profit: tpB,
            positions: group.buyPositions.length
          })
        }

        if (sellVol > 0) {
          let twS = 0, tpS = 0
          group.sellPositions.forEach(p => {
            const v = p.volume || 0
            const pr = p.priceOpen || p.price || 0
            twS += pr * v
            tpS += p.profit || 0
          })
          const avgS = sellVol > 0 ? twS / sellVol : 0
          computedNet.push({
            symbol: group.symbol,
            netType: 'Sell',
            volume: sellVol,
            avgPrice: avgS,
            profit: tpS,
            positions: group.sellPositions.length
          })
        }
      })
      setNetPositions(computedNet)

      // Set default date range to Today
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      setFromDate(formatDateToDisplay(todayStr))
      setToDate(formatDateToDisplay(todayStr))
      
      // Fetch deals for today by default
      const startOfDay = new Date(today)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(today)
      endOfDay.setHours(23, 59, 59, 999)
      
      await fetchDealsWithDateFilter(Math.floor(startOfDay.getTime() / 1000), Math.floor(endOfDay.getTime() / 1000), 1)
      
      setLoading(false)
    } catch (error) {
      console.error('Error fetching client details:', error)
      setLoading(false)
    }
  }

  const fetchDealsWithDateFilter = async (fromTimestamp, toTimestamp, page = 1) => {
    try {
      setDealsLoading(true)
      
      // Calculate offset based on page
      const offset = (page - 1) * itemsPerPage
      
      const dealsRes = await brokerAPI.getClientDeals(client.login, fromTimestamp, toTimestamp, itemsPerPage, offset)
      const dealsData = dealsRes.data?.deals || dealsRes.deals || []
      const total = dealsRes.data?.total || dealsRes.total || dealsData.length
      
      setDeals(dealsData)
      setTotalDealsCount(total)
      setCurrentDateFilter({ from: fromTimestamp, to: toTimestamp })
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

    // Update date inputs (format as dd/mm/yyyy for display)
    const fromDateStr = fromDateObj.toISOString().split('T')[0]
    const toDateStr = toDateObj.toISOString().split('T')[0]
    setFromDate(formatDateToDisplay(fromDateStr))
    setToDate(formatDateToDisplay(toDateStr))

    // Fetch deals
    fromDateObj.setHours(0, 0, 0, 0)
    toDateObj.setHours(23, 59, 59, 999)
    await fetchDealsWithDateFilter(Math.floor(fromDateObj.getTime() / 1000), Math.floor(toDateObj.getTime() / 1000))
  }

  const handleApplyDateFilter = async () => {
    if (!fromDate && !toDate) return

    setCurrentPage(1) // Reset to page 1

    const fromDateObj = fromDate ? new Date(formatDateToValue(fromDate)) : null
    const toDateObj = toDate ? new Date(formatDateToValue(toDate)) : null

    if (fromDateObj) {
      fromDateObj.setHours(0, 0, 0, 0)
    }
    if (toDateObj) {
      toDateObj.setHours(23, 59, 59, 999)
    }

    const fromTimestamp = fromDateObj ? Math.floor(fromDateObj.getTime() / 1000) : 0
    const toTimestamp = toDateObj ? Math.floor(toDateObj.getTime() / 1000) : Math.floor(Date.now() / 1000)

    await fetchDealsWithDateFilter(fromTimestamp, toTimestamp, 1)
  }

  const handleClearDateFilter = () => {
    setFromDate('')
    setToDate('')
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
    let filtered = positions
    if (positionsSearch.trim()) {
      const query = positionsSearch.toLowerCase()
      filtered = positions.filter(p => 
        (p.symbol || '').toLowerCase().includes(query) ||
        (p.position || '').toString().includes(query) ||
        (p.action || '').toLowerCase().includes(query) ||
        (p.type || '').toLowerCase().includes(query)
      )
    }
    return sortData(filtered, sortConfig.key, sortConfig.direction)
  }, [positions, positionsSearch, sortConfig])

  const filteredNetPositions = useMemo(() => {
    let filtered = netPositions
    if (netPositionsSearch.trim()) {
      const query = netPositionsSearch.toLowerCase()
      filtered = netPositions.filter(p => 
        (p.symbol || '').toLowerCase().includes(query)
      )
    }
    return sortData(filtered, sortConfig.key, sortConfig.direction)
  }, [netPositions, netPositionsSearch, sortConfig])

  const filteredDeals = useMemo(() => {
    // For deals, apply client-side filtering only (data is paginated from server)
    let filtered = deals
    if (dealsSearch.trim()) {
      const query = dealsSearch.toLowerCase()
      filtered = deals.filter(d => 
        (d.symbol || '').toLowerCase().includes(query) ||
        (d.deal || '').toString().includes(query) ||
        (d.action || '').toLowerCase().includes(query) ||
        (d.type || '').toLowerCase().includes(query)
      )
    }
    return sortData(filtered, sortConfig.key, sortConfig.direction)
  }, [deals, dealsSearch, sortConfig])

  // Paginate data (positions and netPositions only - deals are paginated from server)
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

  // For deals, use filteredDeals directly (already paginated from server)
  const paginatedDeals = useMemo(() => {
    return filteredDeals
  }, [filteredDeals])

  const renderPositions = () => (
    <>
      <table className="w-full">
        <thead className="bg-blue-500 sticky top-0 z-20">
          <tr>
            {positionColumns.position && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('position')}>
                <div className="flex items-center gap-1">
                  Position
                  {sortConfig.key === 'position' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {positionColumns.symbol && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">
                  Symbol
                  {sortConfig.key === 'symbol' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {positionColumns.action && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('action')}>
                <div className="flex items-center gap-1">
                  Type
                  {sortConfig.key === 'action' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {positionColumns.volume && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('volume')}>
                <div className="flex items-center gap-1">
                  Volume
                  {sortConfig.key === 'volume' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {positionColumns.priceOpen && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('priceOpen')}>
                <div className="flex items-center gap-1">
                  Price
                  {sortConfig.key === 'priceOpen' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {positionColumns.profit && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('profit')}>
                <div className="flex items-center gap-1">
                  Profit
                  {sortConfig.key === 'profit' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedPositions.map((pos, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {positionColumns.position && <td className="px-3 py-2 text-xs text-gray-900">{pos.position || pos.ticket || '-'}</td>}
              {positionColumns.symbol && <td className="px-3 py-2 text-xs font-medium text-gray-900">{pos.symbol || '-'}</td>}
              {positionColumns.action && (
                <td className="px-3 py-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    (pos.action || pos.type || '').toLowerCase() === 'buy' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {pos.action || pos.type || '-'}
                  </span>
                </td>
              )}
              {positionColumns.volume && <td className="px-3 py-2 text-xs text-gray-900">{formatNum(pos.volume || 0)}</td>}
              {positionColumns.priceOpen && <td className="px-3 py-2 text-xs text-gray-900">{formatNum(pos.priceOpen || pos.price || 0, 5)}</td>}
              {positionColumns.profit && (
                <td className={`px-3 py-2 text-xs ${(pos.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNum(pos.profit || 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )

  const renderNetPositions = () => (
    <>
      <table className="w-full">
        <thead className="bg-blue-500 sticky top-0 z-20">
          <tr>
            {netPositionColumns.symbol && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">
                  Symbol
                  {sortConfig.key === 'symbol' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {netPositionColumns.netType && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('netType')}>
                <div className="flex items-center gap-1">
                  Net Type
                  {sortConfig.key === 'netType' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {netPositionColumns.volume && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('volume')}>
                <div className="flex items-center gap-1">
                  Net Volume
                  {sortConfig.key === 'volume' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {netPositionColumns.avgPrice && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('avgPrice')}>
                <div className="flex items-center gap-1">
                  Avg Open Price
                  {sortConfig.key === 'avgPrice' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {netPositionColumns.profit && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('profit')}>
                <div className="flex items-center gap-1">
                  Profit
                  {sortConfig.key === 'profit' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {netPositionColumns.positions && <th className="px-3 py-2 text-left text-xs font-medium text-white">Positions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedNetPositions.map((netPos, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {netPositionColumns.symbol && <td className="px-3 py-2 text-xs font-medium text-gray-900">{netPos.symbol}</td>}
              {netPositionColumns.netType && (
                <td className={`px-3 py-2 text-xs ${netPos.netType === 'Buy' ? 'text-red-600' : 'text-green-600'}`}>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${netPos.netType === 'Buy' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {netPos.netType}
                  </span>
                </td>
              )}
              {netPositionColumns.volume && <td className="px-3 py-2 text-xs text-gray-900">{formatNum(netPos.volume)}</td>}
              {netPositionColumns.avgPrice && <td className="px-3 py-2 text-xs text-gray-900">{formatNum(netPos.avgPrice, 5)}</td>}
              {netPositionColumns.profit && (
                <td className={`px-3 py-2 text-xs ${netPos.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNum(netPos.profit)}
                </td>
              )}
              {netPositionColumns.positions && <td className="px-3 py-2 text-xs text-gray-900">{netPos.positions}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )

  const renderDeals = () => (
    <>
      <table className="w-full">
        <thead className="bg-blue-500 sticky top-0 z-20">
          <tr>
            {dealColumns.deal && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('deal')}>
                <div className="flex items-center gap-1">
                  Deal
                  {sortConfig.key === 'deal' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {dealColumns.time && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('time')}>
                <div className="flex items-center gap-1">
                  Time
                  {sortConfig.key === 'time' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {dealColumns.symbol && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('symbol')}>
                <div className="flex items-center gap-1">
                  Symbol
                  {sortConfig.key === 'symbol' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {dealColumns.action && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('action')}>
                <div className="flex items-center gap-1">
                  Type
                  {sortConfig.key === 'action' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {dealColumns.volume && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('volume')}>
                <div className="flex items-center gap-1">
                  Volume
                  {sortConfig.key === 'volume' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
            {dealColumns.profit && (
              <th className="px-3 py-2 text-left text-xs font-medium text-white cursor-pointer select-none" onClick={() => handleSort('profit')}>
                <div className="flex items-center gap-1">
                  Profit
                  {sortConfig.key === 'profit' && (
                    <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {paginatedDeals.map((deal, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {dealColumns.deal && <td className="px-3 py-2 text-xs text-gray-900">{deal.deal}</td>}
              {dealColumns.time && <td className="px-3 py-2 text-xs text-gray-900">{formatDate(deal.time)}</td>}
              {dealColumns.symbol && <td className="px-3 py-2 text-xs text-gray-900">{deal.symbol}</td>}
              {dealColumns.action && (
                <td className="px-3 py-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    deal.action === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {deal.action}
                  </span>
                </td>
              )}
              {dealColumns.volume && <td className="px-3 py-2 text-xs text-gray-900">{formatNum(deal.volume)}</td>}
              {dealColumns.profit && (
                <td className={`px-3 py-2 text-xs ${(deal.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNum(deal.profit || 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .mobile-date-picker::-webkit-calendar-picker-indicator {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            opacity: 0;
            cursor: pointer;
          }
          
          input[type="date"].mobile-date-picker {
            font-size: 10px !important;
          }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:hidden">

        <div className="bg-white w-full h-[90vh] rounded-t-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white z-10 flex-shrink-0">
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex-1" />
          <div className="w-9" />
        </div>

        {/* Client Info Card */}
        <div className="px-4 py-4 bg-white border-b border-gray-200 flex-shrink-0">
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
              Deals ({hasAppliedFilter ? totalDealsCount : 0})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0 h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center px-2 gap-1">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <circle cx="6" cy="6" r="4" stroke="#9CA3AF" strokeWidth="1.5"/>
                <path d="M9 9L12 12" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={activeTab === 'positions' ? positionsSearch : activeTab === 'netPositions' ? netPositionsSearch : dealsSearch}
                onChange={(e) => {
                  const value = e.target.value
                  if (activeTab === 'positions') setPositionsSearch(value)
                  else if (activeTab === 'netPositions') setNetPositionsSearch(value)
                  else setDealsSearch(value)
                  setCurrentPage(1)
                }}
                placeholder="Search"
                className="flex-1 min-w-0 text-[11px] text-[#000000] placeholder-[#9CA3AF] outline-none bg-transparent font-outfit"
              />
            </div>
            {/* Column Selector Button */}
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50"
              title="Select Columns"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="8.5" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="14" y="5" width="3" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
              </svg>
            </button>
            {/* Pagination Buttons */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <span className="text-[10px] font-semibold text-[#000000] font-outfit">
              {activeTab === 'positions' && `${currentPage} / ${Math.ceil(filteredPositions.length / itemsPerPage)}`}
              {activeTab === 'netPositions' && `${currentPage} / ${Math.ceil(filteredNetPositions.length / itemsPerPage)}`}
              {activeTab === 'deals' && `${currentPage} / ${Math.ceil(totalDealsCount / itemsPerPage)}`}
            </span>
            <button
              onClick={() => setCurrentPage(prev => {
                const maxPage = activeTab === 'positions' 
                  ? Math.ceil(filteredPositions.length / itemsPerPage)
                  : activeTab === 'netPositions'
                  ? Math.ceil(filteredNetPositions.length / itemsPerPage)
                  : Math.ceil(totalDealsCount / itemsPerPage)
                return prev < maxPage ? prev + 1 : prev
              })}
              disabled={
                (activeTab === 'positions' && currentPage >= Math.ceil(filteredPositions.length / itemsPerPage)) ||
                (activeTab === 'netPositions' && currentPage >= Math.ceil(filteredNetPositions.length / itemsPerPage)) ||
                (activeTab === 'deals' && currentPage >= Math.ceil(totalDealsCount / itemsPerPage))
              }
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Date Filter for Deals Tab - Single Row Compact Design */}
        {activeTab === 'deals' && (
          <div className="px-2 py-1.5 bg-blue-50 border-b border-blue-100 flex-shrink-0">
            <div className="flex items-center gap-1.5" style={{ justifyContent: 'space-between' }}>
              {/* Date Inputs */}
              <div 
                style={{ width: '95px', flex: '0 0 95px', position: 'relative' }}
                onClick={() => fromDateInputRef.current?.showPicker?.()}
              >
                <input
                  ref={fromDateInputRef}
                  type="date"
                  value={fromDate ? formatDateToValue(fromDate) : ''}
                  onChange={(e) => {
                    const dateValue = e.target.value
                    if (dateValue) {
                      const [year, month, day] = dateValue.split('-')
                      setFromDate(`${day}/${month}/${year.slice(-2)}`)
                    } else {
                      setFromDate('')
                    }
                  }}
                  className="mobile-date-picker absolute inset-0 opacity-0 cursor-pointer"
                  style={{ width: '100%', height: '100%', zIndex: 10 }}
                />
                <div className="w-full border border-gray-300 rounded text-gray-900 bg-white px-1 py-0.5 flex items-center justify-between cursor-pointer" style={{ fontSize: '10px', height: '24px' }}>
                  <span>{fromDate || 'dd/mm/yy'}</span>
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <span className="text-[12px] text-gray-500 font-medium" style={{ flex: '0 0 auto' }}>to</span>
              <div 
                style={{ width: '95px', flex: '0 0 95px', position: 'relative' }}
                onClick={() => toDateInputRef.current?.showPicker?.()}
              >
                <input
                  ref={toDateInputRef}
                  type="date"
                  value={toDate ? formatDateToValue(toDate) : ''}
                  onChange={(e) => {
                    const dateValue = e.target.value
                    if (dateValue) {
                      const [year, month, day] = dateValue.split('-')
                      setToDate(`${day}/${month}/${year.slice(-2)}`)
                    } else {
                      setToDate('')
                    }
                  }}
                  className="mobile-date-picker absolute inset-0 opacity-0 cursor-pointer"
                  style={{ width: '100%', height: '100%', zIndex: 10 }}
                />
                <div className="w-full border border-gray-300 rounded text-gray-900 bg-white px-1 py-0.5 flex items-center justify-between cursor-pointer" style={{ fontSize: '10px', height: '24px' }}>
                  <span>{toDate || 'dd/mm/yy'}</span>
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              {/* Quick Filter Dropdown */}
              <select
                value={quickFilter}
                onChange={(e) => handleQuickFilter(e.target.value)}
                className="px-1.5 py-0.5 border border-blue-300 rounded text-[9px] font-medium text-blue-700 bg-white"
                style={{ height: '24px', fontSize: '9px', width: '60px', flex: '0 0 60px' }}
              >
                <option value="Today">Today</option>
                <option value="Last Week">Week</option>
                <option value="Last Month">Month</option>
                <option value="Last 3 Months">3M</option>
                <option value="Last 6 Months">6M</option>
              </select>

              {/* Action Buttons */}
              <button
                onClick={handleApplyDateFilter}
                className="px-3 py-0.5 bg-blue-600 text-white text-[9px] font-medium rounded hover:bg-blue-700"
                style={{ height: '24px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
              >
                Apply
              </button>
              <button
                onClick={handleClearDateFilter}
                className="px-3 py-0.5 bg-white border border-gray-300 text-gray-700 text-[9px] font-medium rounded hover:bg-gray-50"
                style={{ height: '24px', flex: '0 0 auto', whiteSpace: 'nowrap' }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table Content - Scrollable Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : activeTab === 'deals' && dealsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="bg-white relative min-w-full">
              {activeTab === 'positions' && renderPositions()}
              {activeTab === 'netPositions' && renderNetPositions()}
              {activeTab === 'deals' && renderDeals()}
            </div>
          )}
        </div>

        {/* Summary Cards (same for Positions and Net Positions) */}
        <div className="px-4 py-3 bg-white border-t border-gray-200 flex-shrink-0">
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

        {/* Column Selector Dropdown */}
        {showColumnSelector && (
          <>
            <div className="fixed inset-0 bg-transparent z-40" onClick={() => setShowColumnSelector(false)} />
            <div className="absolute top-[118px] right-[58px] bg-white rounded-lg shadow-xl border border-blue-500 z-50 w-56">
              {/* Header */}
              <div className="px-4 py-2.5 bg-blue-500 rounded-t-lg flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Show/Hide Columns</h3>
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="text-white hover:text-blue-100 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Column List */}
              <div className="p-2 max-h-80 overflow-y-auto bg-white rounded-b-lg">
                {activeTab === 'positions' && (
                  <div className="space-y-0.5">
                    {Object.entries({
                      position: 'Position',
                      symbol: 'Symbol',
                      action: 'Type',
                      volume: 'Volume',
                      priceOpen: 'Price',
                      profit: 'Profit'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 rounded-md transition-colors">
                        <span className="text-sm text-gray-700 font-medium">{label}</span>
                        <button
                          onClick={() => setPositionColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            positionColumns[key] ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                              positionColumns[key] ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'netPositions' && (
                  <div className="space-y-0.5">
                    {Object.entries({
                      symbol: 'Symbol',
                      netType: 'Net Type',
                      volume: 'Net Volume',
                      avgPrice: 'Avg Open Price',
                      profit: 'Profit',
                      positions: 'Positions'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 rounded-md transition-colors">
                        <span className="text-sm text-gray-700 font-medium">{label}</span>
                        <button
                          onClick={() => setNetPositionColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            netPositionColumns[key] ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                              netPositionColumns[key] ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'deals' && (
                  <div className="space-y-0.5">
                    {Object.entries({
                      deal: 'Deal',
                      symbol: 'Symbol',
                      action: 'Type',
                      volume: 'Volume',
                      profit: 'Profit'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 rounded-md transition-colors">
                        <span className="text-sm text-gray-700 font-medium">{label}</span>
                        <button
                          onClick={() => setDealColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            dealColumns[key] ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
                              dealColumns[key] ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  )
}

export default ClientDetailsMobileModal
