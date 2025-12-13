import { useState, useEffect, useRef, useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'
import { formatTime } from '../utils/dateFormatter'

// Max number of deals to request in one fetch. Increase if needed.
const CLIENT_DEALS_FETCH_LIMIT = 1000

const ClientPositionsModal = ({ client, onClose, onClientUpdate, allPositionsCache, onCacheUpdate }) => {
  const [activeTab, setActiveTab] = useState('positions')
  const [positions, setPositions] = useState([])
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [dealsLoading, setDealsLoading] = useState(false)
  const [error, setError] = useState('')
  const [netPositions, setNetPositions] = useState([])
  
  // Broker Rules states
  const [availableRules, setAvailableRules] = useState([])
  const [clientRules, setClientRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [selectedTimeParam, setSelectedTimeParam] = useState({})
  
  // Client data state (for updated balance/credit/equity)
  const [clientData, setClientData] = useState(client)
  // Pull live clients list so the modal reflects current Balance/Equity/Credit/PnL
  const { clients: liveClients } = useData()
  
  // Funds management state
  const [operationType, setOperationType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [operationLoading, setOperationLoading] = useState(false)
  const [operationSuccess, setOperationSuccess] = useState('')
  const [operationError, setOperationError] = useState('')
  
  // Date filter state
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filteredDeals, setFilteredDeals] = useState([])
  const [allDeals, setAllDeals] = useState([])
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState('')
  const [dealsServerLimitReached, setDealsServerLimitReached] = useState(false)
  
  // Search and filter states for positions
  const [searchQuery, setSearchQuery] = useState('')
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterDropdown, setShowFilterDropdown] = useState(null)
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
  const filterRefs = useRef({})
  const searchRef = useRef(null)
  
  // Search and filter states for deals
  const [dealsSearchQuery, setDealsSearchQuery] = useState('')
  const [dealsColumnFilters, setDealsColumnFilters] = useState({})
  const [showDealsFilterDropdown, setShowDealsFilterDropdown] = useState(null)
  const [showDealsSearchSuggestions, setShowDealsSearchSuggestions] = useState(false)
  const dealsFilterRefs = useRef({})
  const dealsSearchRef = useRef(null)
  
  // Pagination states for deals
  const [dealsCurrentPage, setDealsCurrentPage] = useState(1)
  const [dealsItemsPerPage, setDealsItemsPerPage] = useState(50)
  
  // Pagination states for positions
  const [positionsCurrentPage, setPositionsCurrentPage] = useState(1)
  const [positionsItemsPerPage, setPositionsItemsPerPage] = useState(50)
  
  // Column visibility for positions
  const [showPositionsColumnSelector, setShowPositionsColumnSelector] = useState(false)
  const positionsColumnSelectorRef = useRef(null)
  const [positionsVisibleColumns, setPositionsVisibleColumns] = useState({
    position: true,
    time: true,
    symbol: true,
    action: true,
    volume: true,
    priceOpen: true,
    priceCurrent: true,
    sl: false,
    tp: false,
    profit: true,
    storage: false,
    commission: false,
    comment: false
  })
  
  // Column resizing states for positions
  const [positionsColumnWidths, setPositionsColumnWidths] = useState({})
  const [resizingPositionsColumn, setResizingPositionsColumn] = useState(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  
  // Column resizing states for deals
  const [dealsColumnWidths, setDealsColumnWidths] = useState({})
  const [resizingDealsColumn, setResizingDealsColumn] = useState(null)

  // Sorting states for positions
  const [positionsSortColumn, setPositionsSortColumn] = useState(null)
  const [positionsSortDirection, setPositionsSortDirection] = useState('asc')

  // Sorting states for deals
  const [dealsSortColumn, setDealsSortColumn] = useState(null)
  const [dealsSortDirection, setDealsSortDirection] = useState('asc')

  // Deal stats (aggregated) for face cards
  const [dealStats, setDealStats] = useState(null)
  const [dealStatsLoading, setDealStatsLoading] = useState(false)
  const [dealStatsError, setDealStatsError] = useState('')
  const [showDealStatsFilter, setShowDealStatsFilter] = useState(false)
  const dealStatsFilterRef = useRef(null)
  // Default visibility for aggregated deal stats face cards
  const defaultDealStatVisibility = {
    totalDeals: true,
    totalVolume: true,
    totalPnL: true,
    totalCommission: true,
    totalStorage: true,
    winRate: true
  }
  const [dealStatVisibility, setDealStatVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('positions_dealStats_visibility')
      return saved ? { ...defaultDealStatVisibility, ...JSON.parse(saved) } : defaultDealStatVisibility
    } catch {
      return defaultDealStatVisibility
    }
  })

  // Visibility for fixed position & money cards
  const defaultFixedCardVisibility = {
    pf_totalPositions: true,
    pf_totalVolume: false,
    pf_totalPL: true,
    pf_lifetimePnL: true,
    pf_bookPnL: true,
    pf_balance: true,
    pf_credit: true,
    pf_equity: true
  }
  const [fixedCardVisibility, setFixedCardVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('positions_fixedCard_visibility')
      return saved ? { ...defaultFixedCardVisibility, ...JSON.parse(saved) } : defaultFixedCardVisibility
    } catch {
      return defaultFixedCardVisibility
    }
  })

  // Build dynamic page-size options for Deals based on total rows
  const getDealsPageSizeOptions = (total) => {
    const base = [50, 100, 200]
    let options = base.filter(n => n <= total)
    if (total > 0 && options.length === 0) {
      // If all base options exceed total, include total as the only numeric option
      options = [total]
    }
    return options
  }

  // Build dynamic page-size options for Positions based on total rows
  const getPositionsPageSizeOptions = (total) => {
    const base = [50, 100, 200]
    let options = base.filter(n => n <= total)
    if (total > 0 && options.length === 0) {
      // If all base options exceed total, include total as the only numeric option
      options = [total]
    }
    return options
  }
  
  const positionsColumns = [
    { key: 'position', label: 'Position' },
    { key: 'time', label: 'Time' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'action', label: 'Action' },
    { key: 'volume', label: 'Volume' },
    { key: 'priceOpen', label: 'Price Open' },
    { key: 'priceCurrent', label: 'Price Current' },
    { key: 'sl', label: 'S/L' },
    { key: 'tp', label: 'T/P' },
    { key: 'profit', label: 'Profit' },
    { key: 'storage', label: 'Storage' },
    { key: 'commission', label: 'Commission' },
    { key: 'comment', label: 'Comment' }
  ]
  
  // Prevent duplicate calls in React StrictMode
  const hasLoadedData = useRef(false)

  useEffect(() => {
    if (!hasLoadedData.current) {
      hasLoadedData.current = true
      fetchPositions()
      // Don't fetch deals on mount - only fetch when user applies date filter
      fetchAvailableRules()
      fetchClientRules()
    }
  }, [])

  // Keep clientData in sync with the latest data from context (live WS updates)
  useEffect(() => {
    if (!liveClients || !client?.login) return
    const updated = liveClients.find(c => c && c.login === client.login)
    if (updated) setClientData(updated)
  }, [liveClients, client?.login])

  // Toggle column visibility
  const togglePositionsColumn = (columnKey) => {
    setPositionsVisibleColumns(prev => {
      const newState = {
        ...prev,
        [columnKey]: !prev[columnKey]
      }
      return newState
    })
  }
  
  // Close filter dropdown and search suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && filterRefs.current[showFilterDropdown]) {
        if (!filterRefs.current[showFilterDropdown].contains(event.target)) {
          setShowFilterDropdown(null)
        }
      }
      if (showDealsFilterDropdown && dealsFilterRefs.current[showDealsFilterDropdown]) {
        if (!dealsFilterRefs.current[showDealsFilterDropdown].contains(event.target)) {
          setShowDealsFilterDropdown(null)
        }
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchSuggestions(false)
      }
      if (dealsSearchRef.current && !dealsSearchRef.current.contains(event.target)) {
        setShowDealsSearchSuggestions(false)
      }
      if (positionsColumnSelectorRef.current && !positionsColumnSelectorRef.current.contains(event.target)) {
        setShowPositionsColumnSelector(false)
      }
      if (dealStatsFilterRef.current && !dealStatsFilterRef.current.contains(event.target)) {
        setShowDealStatsFilter(false)
      }
    }
    
    if (showFilterDropdown || showDealsFilterDropdown || showSearchSuggestions || showDealsSearchSuggestions || showPositionsColumnSelector || showDealStatsFilter) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterDropdown, showDealsFilterDropdown, showSearchSuggestions, showDealsSearchSuggestions, showPositionsColumnSelector, showDealStatsFilter])

  // Persist visibilities
  useEffect(() => {
    try { localStorage.setItem('positions_fixedCard_visibility', JSON.stringify(fixedCardVisibility)) } catch {}
  }, [fixedCardVisibility])

  // Update positions when allPositionsCache changes (WebSocket updates)
  useEffect(() => {
    if (allPositionsCache && allPositionsCache.length >= 0) {
      const clientPositions = allPositionsCache.filter(pos => pos.login === client.login)
      setPositions(clientPositions)
      
      // Calculate net positions grouped by symbol
      calculateNetPositions(clientPositions)
    }
  }, [allPositionsCache, client.login])

  // Fetch aggregated deal stats for the client (GET endpoint per requirement)
  useEffect(() => {
    let cancelled = false
    const loadStats = async () => {
      try {
        setDealStatsLoading(true)
        setDealStatsError('')
        const res = await brokerAPI.getClientDealStatsGET(client.login)
        const data = res?.data || res
        if (!cancelled) setDealStats(data || null)
      } catch (err) {
        if (!cancelled) {
          setDealStats(null)
          setDealStatsError('Failed to load deal stats')
        }
      } finally {
        if (!cancelled) setDealStatsLoading(false)
      }
    }
    if (client?.login) loadStats()
    return () => { cancelled = true }
  }, [client?.login])

  // Persist deal stat visibility
  useEffect(() => {
    try { localStorage.setItem('positions_dealStats_visibility', JSON.stringify(dealStatVisibility)) } catch {}
  }, [dealStatVisibility])

  const toggleDealStatKey = (key) => {
    setDealStatVisibility(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toTitle = (key) => String(key)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())

  const formatStatValue = (key, value) => {
    const n = Number(value || 0)
    if (['totalPnL','totalCommission','totalStorage'].includes(key)) return formatCurrency(n)
    if (key === 'winRate') return `${n.toFixed(2)}%`
    if (key.toLowerCase().includes('volume')) return n.toFixed(2)
    if (Number.isInteger(value)) return `${n}`
    return n.toFixed(2)
  }
  
  // Styling for deal stats cards based on metric and value
  const getDealStatStyle = (key, value) => {
    const n = Number(value || 0)
    switch (key) {
      case 'totalPnL': {
        const pos = n >= 0
        return {
          container: pos ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200',
          label: pos ? 'text-emerald-600' : 'text-red-600',
          value: getProfitColor(n)
        }
      }
      case 'totalCommission':
        return {
          container: 'bg-amber-50 border-amber-200',
          label: 'text-amber-600',
          value: 'text-amber-900'
        }
      case 'totalStorage': {
        const pos = n >= 0
        return {
          container: pos ? 'bg-teal-50 border-teal-200' : 'bg-orange-50 border-orange-200',
          label: pos ? 'text-teal-600' : 'text-orange-600',
          value: pos ? 'text-teal-900' : 'text-orange-900'
        }
      }
      case 'winRate': {
        const good = n >= 50
        return {
          container: good ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200',
          label: good ? 'text-emerald-600' : 'text-orange-600',
          value: good ? 'text-emerald-900' : 'text-orange-900'
        }
      }
      case 'totalDeals':
        return {
          container: 'bg-blue-50 border-blue-200',
          label: 'text-blue-600',
          value: 'text-blue-900'
        }
      case 'totalVolume':
        return {
          container: 'bg-indigo-50 border-indigo-200',
          label: 'text-indigo-600',
          value: 'text-indigo-900'
        }
      default:
        return {
          container: 'bg-slate-50 border-slate-200',
          label: 'text-slate-600',
          value: 'text-slate-900'
        }
    }
  }
  
  // Calculate NET positions by grouping by symbol
  const calculateNetPositions = (clientPositions) => {
    const grouped = {}
    
    clientPositions.forEach(pos => {
      const symbol = pos.symbol
      if (!grouped[symbol]) {
        grouped[symbol] = {
          symbol,
          buyVolume: 0,
          sellVolume: 0,
          buyPrices: [],
          sellPrices: [],
          totalProfit: 0,
          positions: []
        }
      }
      
      // Normalize action using helper to handle numeric and string variants
      const actionLabel = getActionLabel(pos.action)
      if (actionLabel === 'Buy') {
        grouped[symbol].buyVolume += pos.volume
        grouped[symbol].buyPrices.push({ price: pos.priceOpen, volume: pos.volume })
      } else if (actionLabel === 'Sell') {
        grouped[symbol].sellVolume += pos.volume
        grouped[symbol].sellPrices.push({ price: pos.priceOpen, volume: pos.volume })
      }
      
      grouped[symbol].totalProfit += pos.profit
      grouped[symbol].positions.push(pos)
    })
    
    // Calculate net positions - create separate entries for buy and sell
    const netPos = []
    Object.values(grouped).forEach(group => {
      // Add buy entry if there are buys
      if (group.buyVolume > 0) {
        const totalWeightedPrice = group.buyPrices.reduce((sum, item) => sum + (item.price * item.volume), 0)
        const avgBuyPrice = totalWeightedPrice / group.buyVolume
        const buyProfit = group.positions
          .filter(p => getActionLabel(p.action) === 'Buy')
          .reduce((sum, p) => sum + Number(p.profit || 0), 0)
        
        netPos.push({
          symbol: group.symbol,
          netVolume: group.buyVolume,
          netType: 'Buy',
          avgOpenPrice: avgBuyPrice,
          totalProfit: buyProfit,
          positionCount: group.positions.filter(p => getActionLabel(p.action) === 'Buy').length
        })
      }
      
      // Add sell entry if there are sells
      if (group.sellVolume > 0) {
        const totalWeightedPrice = group.sellPrices.reduce((sum, item) => sum + (item.price * item.volume), 0)
        const avgSellPrice = totalWeightedPrice / group.sellVolume
        const sellProfit = group.positions
          .filter(p => getActionLabel(p.action) === 'Sell')
          .reduce((sum, p) => sum + Number(p.profit || 0), 0)
        
        netPos.push({
          symbol: group.symbol,
          netVolume: group.sellVolume,
          netType: 'Sell',
          avgOpenPrice: avgSellPrice,
          totalProfit: sellProfit,
          positionCount: group.positions.filter(p => getActionLabel(p.action) === 'Sell').length
        })
      }
    })
    
    // Sort by volume descending
    netPos.sort((a, b) => b.netVolume - a.netVolume)
    
    setNetPositions(netPos)
  }

  // Auto-apply "Today" preset when Deals tab is first activated
  const hasAutoLoadedDeals = useRef(false)
  useEffect(() => {
    if (activeTab === 'deals' && !hasAutoLoadedDeals.current) {
      hasAutoLoadedDeals.current = true
      handleDatePreset('today')
    }
  }, [activeTab])

  const fetchPositions = async () => {
    try {
      setLoading(true)
      
      // Always use cached positions (fetched on page load)
      if (allPositionsCache && allPositionsCache.length >= 0) {
        // Filter from cached positions
        const clientPositions = allPositionsCache.filter(pos => pos.login === client.login)
        setPositions(clientPositions)
      } else {
        setPositions([])
      }
    } catch (error) {
      setError('Failed to load positions')
    } finally {
      setLoading(false)
    }
  }

  const fetchDeals = async (fromTimestamp, toTimestamp) => {
    try {
      setDealsLoading(true)
      setError('')
      
      // Fetch deals from API with specific date range
      const response = await brokerAPI.getClientDeals(client.login, fromTimestamp, toTimestamp, CLIENT_DEALS_FETCH_LIMIT)
      const clientDeals = response.data?.deals || []
      setDeals(clientDeals)
      setAllDeals(clientDeals)
      setFilteredDeals(clientDeals)
      setHasAppliedFilter(true)
      setDealsServerLimitReached(clientDeals.length >= CLIENT_DEALS_FETCH_LIMIT)
    } catch (error) {
      setError('Failed to load deals')
      setDeals([])
      setAllDeals([])
      setFilteredDeals([])
      setDealsServerLimitReached(false)
    } finally {
      setDealsLoading(false)
    }
  }

  const fetchUpdatedClientData = async () => {
    try {
      // Silently fetch updated client data
      const response = await brokerAPI.getClients()
      const allClients = response.data?.clients || []
      const updatedClient = allClients.find(c => c.login === client.login)
      if (updatedClient) {
        setClientData(updatedClient)
      }
    } catch (error) {
      // Silent error handling
    }
  }

  const fetchAvailableRules = async () => {
    try {
      console.log('[ClientPositionsModal] 🔍 Fetching available rules...')
      setRulesLoading(true)
      const response = await brokerAPI.getAvailableRules()
      console.log('[ClientPositionsModal] ✅ Rules response:', response)
      if (response.status === 'success') {
        setAvailableRules(response.data.rules || [])
        console.log('[ClientPositionsModal] 📋 Available rules set:', response.data.rules?.length || 0)
      }
    } catch (error) {
      console.error('[ClientPositionsModal] ❌ Failed to fetch available rules:', error)
    } finally {
      setRulesLoading(false)
    }
  }

  const fetchClientRules = async () => {
    try {
      console.log('[ClientPositionsModal] 🔍 Fetching client rules for login:', client.login)
      const response = await brokerAPI.getClientRules(client.login)
      console.log('[ClientPositionsModal] ✅ Client rules response:', response)
      if (response.status === 'success') {
        const rules = response.data.rules || []
        console.log('[ClientPositionsModal] 📋 Setting client rules to:', rules.map(r => ({ code: r.rule_code, name: r.rule_name })))
        setClientRules(rules)
        console.log('[ClientPositionsModal] 📋 Client rules state updated. Count:', rules.length)
      }
    } catch (error) {
      console.error('[ClientPositionsModal] ❌ Failed to fetch client rules:', error)
      setClientRules([])
    }
  }

  const handleApplyRule = async (rule) => {
    try {
      console.log('[ClientPositionsModal] ➕ Applying/Activating rule:', rule.rule_code, 'for login:', client.login)
      setRulesLoading(true)
      
      // Find the matching available rule to check if time parameter is required
      const availableRule = availableRules.find(ar => ar.rule_code === rule.rule_code)
      const requiresTimeParam = availableRule?.requires_time_parameter
      
      // Get time parameter from dropdown selection or use existing one
      let timeParameter = selectedTimeParam[rule.rule_code] || rule.time_parameter || null
      
      // Validate time parameter if required
      if (requiresTimeParam && !timeParameter) {
        alert('Please select a time parameter')
        setRulesLoading(false)
        return
      }

      console.log('[ClientPositionsModal] 📤 Sending apply request with time:', timeParameter)
      const response = await brokerAPI.applyClientRule(client.login, rule.rule_code, timeParameter)
      console.log('[ClientPositionsModal] ✅ Apply rule response:', response)
      
      if (response.status === 'success') {
        console.log('[ClientPositionsModal] 📋 Rule applied/activated successfully')
        // Clear selected time parameter after successful application
        setSelectedTimeParam(prev => {
          const updated = { ...prev }
          delete updated[rule.rule_code]
          return updated
        })
        // Refresh client rules from API to get updated is_active status
        await fetchClientRules()
        console.log('[ClientPositionsModal] ✅ Rule application completed')
      } else {
        console.error('[ClientPositionsModal] ❌ Apply rule failed:', response.message)
        alert(response.message || 'Failed to apply rule')
      }
    } catch (error) {
      console.error('[ClientPositionsModal] ❌ Error applying rule:', error)
      alert('Failed to apply rule: ' + (error.response?.data?.message || error.message))
    } finally {
      setRulesLoading(false)
    }
  }

  const handleRemoveRule = async (ruleCode) => {
    try {
      console.log('[ClientPositionsModal] 🗑️ Deactivating rule:', ruleCode, 'for login:', client.login)
      setRulesLoading(true)
      const response = await brokerAPI.removeClientRule(client.login, ruleCode)
      console.log('[ClientPositionsModal] ✅ Remove rule response:', response)
      
      if (response.status === 'success') {
        console.log('[ClientPositionsModal] 📋 Rule deactivated successfully')
        // Refresh client rules from API to get updated is_active status
        await fetchClientRules()
        console.log('[ClientPositionsModal] ✅ Rule deactivation completed')
      } else {
        console.error('[ClientPositionsModal] ❌ Remove rule failed:', response.message)
        alert(response.message || 'Failed to remove rule')
      }
    } catch (error) {
      console.error('[ClientPositionsModal] ❌ Error removing rule:', error)
      alert('Failed to remove rule: ' + (error.response?.data?.message || error.message))
    } finally {
      setRulesLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toFixed(2)}`
  }

  // Sorting handler for positions
  const handlePositionsSort = (column) => {
    if (positionsSortColumn === column) {
      // Toggle direction if same column
      setPositionsSortDirection(positionsSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setPositionsSortColumn(column)
      setPositionsSortDirection('asc')
    }
  }

  // Sorting handler for deals
  const handleDealsSort = (column) => {
    if (dealsSortColumn === column) {
      // Toggle direction if same column
      setDealsSortDirection(dealsSortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setDealsSortColumn(column)
      setDealsSortDirection('asc')
    }
  }

  // Sort icon component
  const SortIcon = ({ column, currentColumn, direction }) => {
    if (column !== currentColumn) {
      return (
        <svg className="w-3 h-3 text-blue-200 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return direction === 'asc' ? (
      <svg className="w-3 h-3 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  }

  const parseDateInput = (dateStr) => {
    // Parse dd/mm/yyyy format or yyyy-mm-dd format (from date picker)
    if (!dateStr) return null
    
    let day, month, year
    
    if (dateStr.includes('/')) {
      // dd/mm/yyyy format
      const parts = dateStr.split('/')
      if (parts.length !== 3) return null
      day = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
      year = parseInt(parts[2], 10)
    } else if (dateStr.includes('-')) {
      // yyyy-mm-dd format (from date input)
      const parts = dateStr.split('-')
      if (parts.length !== 3) return null
      year = parseInt(parts[0], 10)
      month = parseInt(parts[1], 10) - 1 // Month is 0-indexed
      day = parseInt(parts[2], 10)
    } else {
      return null
    }
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null
    if (day < 1 || day > 31 || month < 0 || month > 11 || year < 1970) return null
    
    return new Date(year, month, day)
  }

  const formatDateToInput = (dateStr) => {
    // Convert dd/mm/yyyy to yyyy-mm-dd for date input
    if (!dateStr || !dateStr.includes('/')) return dateStr
    const parts = dateStr.split('/')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }

  const formatDateFromInput = (dateStr) => {
    // Convert yyyy-mm-dd to dd/mm/yyyy for display
    if (!dateStr || !dateStr.includes('-')) return dateStr
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }

  const handleApplyDateFilter = async () => {
    if (!fromDate && !toDate) {
      setOperationError('Please select at least one date (From or To)')
      return
    }

    const fromDateObj = fromDate ? parseDateInput(fromDate) : null
    const toDateObj = toDate ? parseDateInput(toDate) : null

    if ((fromDate && !fromDateObj) || (toDate && !toDateObj)) {
      setOperationError('Invalid date format. Please select a valid date')
      return
    }

    // Set time to start/end of day
    if (fromDateObj) {
      fromDateObj.setHours(0, 0, 0, 0)
    }
    if (toDateObj) {
      toDateObj.setHours(23, 59, 59, 999)
    }

    // Convert to Unix timestamp (seconds)
    const fromTimestamp = fromDateObj ? Math.floor(fromDateObj.getTime() / 1000) : 0
    const toTimestamp = toDateObj ? Math.floor(toDateObj.getTime() / 1000) : Math.floor(Date.now() / 1000)

    // Fetch deals from API with selected date range
    await fetchDeals(fromTimestamp, toTimestamp)
    setOperationError('')
  }

  const handleClearDateFilter = () => {
    setFromDate('')
    setToDate('')
    setFilteredDeals([])
    setDeals([])
    setAllDeals([])
    setHasAppliedFilter(false)
    setOperationError('')
    setSelectedPreset('')
  }

  const handleDatePreset = async (preset) => {
    const now = new Date()
    let fromDateObj, toDateObj
    
    setSelectedPreset(preset)
    
    switch (preset) {
      case 'today':
        fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'last3days':
        fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'lastweek':
        fromDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'lastmonth':
        fromDateObj = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'last3months':
        fromDateObj = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'last6months':
        fromDateObj = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      case 'allhistory':
        // Set from date to 2 years ago for "all history"
        fromDateObj = new Date(now.getFullYear() - 2, 0, 1, 0, 0, 0)
        toDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        break
      default:
        return
    }
    
    // Update the date inputs
    const formatToInput = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    setFromDate(formatToInput(fromDateObj))
    setToDate(formatToInput(toDateObj))
    
    // Automatically apply the filter
    const fromTimestamp = Math.floor(fromDateObj.getTime() / 1000)
    const toTimestamp = Math.floor(toDateObj.getTime() / 1000)
    await fetchDeals(fromTimestamp, toTimestamp)
    setOperationError('')
  }

  const getActionLabel = (action) => {
    // Handle both numeric (0, 1) and string ('BUY', 'SELL', 'buy', 'sell') action values
    if (action === 0 || action === '0') return 'Buy'
    if (action === 1 || action === '1') return 'Sell'
    if (typeof action === 'string') {
      const normalized = action.toUpperCase()
      if (normalized === 'BUY') return 'Buy'
      if (normalized === 'SELL') return 'Sell'
    }
    // Default fallback
    return action === 0 ? 'Buy' : 'Sell'
  }

  const getDealActionLabel = (action) => {
    // Handle both numeric and string action values
    const numericAction = typeof action === 'string' ? parseInt(action) : action
    
    const actions = {
      0: 'Buy',
      1: 'Sell',
      2: 'Balance',
      3: 'Credit',
      4: 'Charge',
      5: 'Correction',
      6: 'Bonus',
      7: 'Commission',
      8: 'Daily Commission',
      9: 'Monthly Commission',
      10: 'Agent Daily',
      11: 'Agent Monthly',
      12: 'Intergroup Agent',
      'buy': 'Buy',
      'sell': 'Sell',
      'balance': 'Balance',
      'credit': 'Credit',
      'deposit': 'Deposit',
      'withdrawal': 'Withdrawal'
    }
    
    // Try lowercase string match if numeric doesn't work
    const stringAction = typeof action === 'string' ? action.toLowerCase() : null
    
    return actions[numericAction] || actions[stringAction] || actions[action] || `Unknown (${action})`
  }

  const getDealActionColor = (action) => {
    const numericAction = typeof action === 'string' ? parseInt(action) : action
    const stringAction = typeof action === 'string' ? action.toLowerCase() : ''
    
    if (numericAction === 0 || stringAction === 'buy') return 'text-green-600 bg-green-50'
    if (numericAction === 1 || stringAction === 'sell') return 'text-green-600 bg-green-50'
    if (numericAction === 2 || numericAction === 3 || stringAction === 'balance' || stringAction === 'credit' || stringAction === 'deposit') return 'text-purple-600 bg-purple-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getActionColor = (action) => {
    // Handle both numeric and string action values
    if (action === 0 || action === '0' || (typeof action === 'string' && action.toUpperCase() === 'BUY')) {
      return 'text-blue-600 bg-blue-50' // Buy is blue
    }
    return 'text-green-600 bg-green-50' // Sell is green
  }

  const getProfitColor = (profit) => {
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Filter helper functions
  const getUniqueColumnValues = (columnKey) => {
    const values = new Set()
    positions.forEach(pos => {
      let value
      if (columnKey === 'type') {
        value = getActionLabel(pos.action)
      } else if (columnKey === 'symbol') {
        value = pos.symbol
      } else if (columnKey === 'time') {
        value = formatDate(pos.timeCreate)
      }
      if (value) values.add(value)
    })
    return Array.from(values).sort()
  }

  const toggleColumnFilter = (columnKey, value) => {
    setColumnFilters(prev => {
      const current = prev[columnKey] || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      
      return {
        ...prev,
        [columnKey]: updated.length > 0 ? updated : undefined
      }
    })
  }

  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const updated = { ...prev }
      delete updated[columnKey]
      return updated
    })
  }

  const getActiveFilterCount = (columnKey) => {
    return columnFilters[columnKey]?.length || 0
  }

  const getUniqueDealsColumnValues = (columnKey) => {
    const values = new Set()
    filteredDeals.forEach(deal => {
      let value
      if (columnKey === 'action') {
        value = getDealActionLabel(deal.action)
      } else if (columnKey === 'symbol') {
        value = deal.symbol
      } else if (columnKey === 'time') {
        value = formatDate(deal.time)
      }
      if (value) values.add(value)
    })
    return Array.from(values).sort()
  }

  const toggleDealsColumnFilter = (columnKey, value) => {
    setDealsColumnFilters(prev => {
      const current = prev[columnKey] || []
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      
      return {
        ...prev,
        [columnKey]: updated.length > 0 ? updated : undefined
      }
    })
  }

  const clearDealsColumnFilter = (columnKey) => {
    setDealsColumnFilters(prev => {
      const updated = { ...prev }
      delete updated[columnKey]
      return updated
    })
  }

  const getActiveDealsFilterCount = (columnKey) => {
    return dealsColumnFilters[columnKey]?.length || 0
  }

  // Get search suggestions for positions
  const getPositionSearchSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 1 || !positions || positions.length === 0) {
      return []
    }
    
    const query = searchQuery.toLowerCase().trim()
    const uniqueValues = new Map() // Use Map to track type and avoid duplicates
    
    positions.forEach(pos => {
      const symbol = String(pos.symbol || '')
      const type = getActionLabel(pos.action)
      const positionNum = String(pos.position || '')
      const volume = String(pos.volume || '')
      const time = formatDate(pos.timeCreate)
      
      // Check each field and add to suggestions if matches
      if (symbol && symbol.toLowerCase().includes(query) && !uniqueValues.has(symbol)) {
        uniqueValues.set(symbol, { type: 'Symbol', value: symbol, priority: 1 })
      }
      if (type && type.toLowerCase().includes(query) && !uniqueValues.has(type)) {
        uniqueValues.set(type, { type: 'Type', value: type, priority: 2 })
      }
      if (positionNum && positionNum.includes(query) && !uniqueValues.has(`#${positionNum}`)) {
        uniqueValues.set(`#${positionNum}`, { type: 'Position', value: `#${positionNum}`, priority: 3 })
      }
      if (volume && volume.includes(query) && !uniqueValues.has(volume)) {
        uniqueValues.set(volume, { type: 'Volume', value: volume, priority: 4 })
      }
      if (time && time.toLowerCase().includes(query) && !uniqueValues.has(time)) {
        uniqueValues.set(time, { type: 'Time', value: time, priority: 5 })
      }
    })
    
    return Array.from(uniqueValues.values())
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 8)
  }

  // Get search suggestions for deals
  const getDealsSearchSuggestions = () => {
    if (!dealsSearchQuery.trim() || dealsSearchQuery.length < 1) {
      return []
    }
    
    const query = dealsSearchQuery.toLowerCase().trim()
    const uniqueValues = new Map() // Use Map to track type and avoid duplicates
    
    // Use deals array instead of filteredDeals to avoid circular dependency
    if (!deals || deals.length === 0) {
      return []
    }
    
    deals.forEach(deal => {
      const symbol = String(deal.symbol || '')
      const action = getDealActionLabel(deal.action)
      const dealNum = String(deal.deal || '')
      const order = deal.order > 0 ? String(deal.order) : ''
      const position = deal.position > 0 ? String(deal.position) : ''
      const time = formatDate(deal.time)
      
      // Check each field and add to suggestions if matches
      if (symbol && symbol.toLowerCase().includes(query) && !uniqueValues.has(symbol)) {
        uniqueValues.set(symbol, { type: 'Symbol', value: symbol, priority: 1 })
      }
      if (action && action.toLowerCase().includes(query) && !uniqueValues.has(action)) {
        uniqueValues.set(action, { type: 'Action', value: action, priority: 2 })
      }
      if (dealNum && dealNum.includes(query) && !uniqueValues.has(`#${dealNum}`)) {
        uniqueValues.set(`#${dealNum}`, { type: 'Deal', value: `#${dealNum}`, priority: 3 })
      }
      if (order && order.includes(query) && !uniqueValues.has(`#${order}`)) {
        uniqueValues.set(`#${order}`, { type: 'Order', value: `#${order}`, priority: 4 })
      }
      if (position && position.includes(query) && !uniqueValues.has(`#${position}`)) {
        uniqueValues.set(`#${position}`, { type: 'Position', value: `#${position}`, priority: 5 })
      }
      if (time && time.toLowerCase().includes(query) && !uniqueValues.has(time)) {
        uniqueValues.set(time, { type: 'Time', value: time, priority: 6 })
      }
    })
    
    return Array.from(uniqueValues.values())
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 8)
  }

  // Apply search and filters to positions
  const filteredPositions = useMemo(() => {
    let filtered = [...positions]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      // Strip # prefix if present for numeric field matching
      const numericQuery = query.startsWith('#') ? query.slice(1) : query
      
      filtered = filtered.filter(pos => {
        return (
          pos.symbol?.toLowerCase().includes(query) ||
          String(pos.position).includes(numericQuery) ||
          String(pos.deal).includes(numericQuery) ||
          getActionLabel(pos.action).toLowerCase().includes(query) ||
          String(pos.volume).includes(query) ||
          String(pos.priceOpen).includes(query) ||
          String(pos.priceCurrent).includes(query) ||
          pos.comment?.toLowerCase().includes(query)
        )
      })
    }

    Object.entries(columnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues && selectedValues.length > 0) {
        filtered = filtered.filter(pos => {
          let value
          if (columnKey === 'type') {
            value = getActionLabel(pos.action)
          } else if (columnKey === 'symbol') {
            value = pos.symbol
          } else if (columnKey === 'time') {
            value = formatDate(pos.timeCreate)
          }
          return selectedValues.includes(value)
        })
      }
    })

    // Apply sorting
    if (positionsSortColumn) {
      filtered.sort((a, b) => {
        let aValue, bValue
        
        switch (positionsSortColumn) {
          case 'time':
            aValue = a.timeCreate || 0
            bValue = b.timeCreate || 0
            break
          case 'position':
            aValue = a.position || 0
            bValue = b.position || 0
            break
          case 'symbol':
            aValue = (a.symbol || '').toLowerCase()
            bValue = (b.symbol || '').toLowerCase()
            break
          case 'action':
            aValue = getActionLabel(a.action)
            bValue = getActionLabel(b.action)
            break
          case 'volume':
            aValue = a.volume || 0
            bValue = b.volume || 0
            break
          case 'priceOpen':
            aValue = a.priceOpen || 0
            bValue = b.priceOpen || 0
            break
          case 'priceCurrent':
            aValue = a.priceCurrent || 0
            bValue = b.priceCurrent || 0
            break
          case 'sl':
            aValue = a.priceSL || 0
            bValue = b.priceSL || 0
            break
          case 'tp':
            aValue = a.priceTP || 0
            bValue = b.priceTP || 0
            break
          case 'profit':
            aValue = a.profit || 0
            bValue = b.profit || 0
            break
          case 'storage':
            aValue = a.storage || 0
            bValue = b.storage || 0
            break
          case 'commission':
            aValue = a.commission || 0
            bValue = b.commission || 0
            break
          case 'comment':
            aValue = (a.comment || '').toLowerCase()
            bValue = (b.comment || '').toLowerCase()
            break
          default:
            return 0
        }

        if (typeof aValue === 'string') {
          return positionsSortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        } else {
          return positionsSortDirection === 'asc'
            ? aValue - bValue
            : bValue - aValue
        }
      })
    }

    return filtered
  }, [positions, searchQuery, columnFilters, positionsSortColumn, positionsSortDirection])

  // Pagination logic for positions
  const positionsTotalPages = Math.ceil(filteredPositions.length / positionsItemsPerPage)
  const positionsStartIndex = (positionsCurrentPage - 1) * positionsItemsPerPage
  const positionsEndIndex = positionsStartIndex + positionsItemsPerPage
  const displayedPositions = filteredPositions.slice(positionsStartIndex, positionsEndIndex)

  // Reset to page 1 when positions filters change
  useEffect(() => {
    setPositionsCurrentPage(1)
  }, [searchQuery])

  // Keep positions page-size selection valid when total filtered rows changes
  useEffect(() => {
    const total = filteredPositions.length
    const options = getPositionsPageSizeOptions(total)
    if (options.length > 0 && (!options.includes(positionsItemsPerPage) || positionsItemsPerPage > total)) {
      setPositionsItemsPerPage(options[0] || 50)
      setPositionsCurrentPage(1)
    }
  }, [filteredPositions.length])

  // Apply search and filters to deals
  const filteredDealsResult = (() => {
    if (!hasAppliedFilter) return []
    
    let filtered = [...filteredDeals]

    if (dealsSearchQuery.trim()) {
      const query = dealsSearchQuery.toLowerCase()
      // Strip # prefix if present for numeric field matching
      const numericQuery = query.startsWith('#') ? query.slice(1) : query
      
      filtered = filtered.filter(deal => {
        return (
          deal.symbol?.toLowerCase().includes(query) ||
          String(deal.deal).includes(numericQuery) ||
          String(deal.position).includes(numericQuery) ||
          String(deal.order || '').includes(numericQuery) ||
          getDealActionLabel(deal.action).toLowerCase().includes(query) ||
          String(deal.volume).includes(query)
        )
      })
    }

    Object.entries(dealsColumnFilters).forEach(([columnKey, selectedValues]) => {
      if (selectedValues && selectedValues.length > 0) {
        filtered = filtered.filter(deal => {
          let value
          if (columnKey === 'action') {
            value = getDealActionLabel(deal.action)
          } else if (columnKey === 'symbol') {
            value = deal.symbol
          } else if (columnKey === 'time') {
            value = formatDate(deal.time)
          }
          return selectedValues.includes(value)
        })
      }
    })

    // Apply sorting
    if (dealsSortColumn) {
      filtered.sort((a, b) => {
        let aValue, bValue
        
        switch (dealsSortColumn) {
          case 'time':
            aValue = a.time || 0
            bValue = b.time || 0
            break
          case 'deal':
            aValue = a.deal || 0
            bValue = b.deal || 0
            break
          case 'position':
            aValue = a.position || 0
            bValue = b.position || 0
            break
          case 'symbol':
            aValue = (a.symbol || '').toLowerCase()
            bValue = (b.symbol || '').toLowerCase()
            break
          case 'action':
            aValue = getDealActionLabel(a.action)
            bValue = getDealActionLabel(b.action)
            break
          case 'entry':
            aValue = getDealEntryLabel(a.entry)
            bValue = getDealEntryLabel(b.entry)
            break
          case 'volume':
            aValue = a.volume || 0
            bValue = b.volume || 0
            break
          case 'price':
            aValue = a.price || 0
            bValue = b.price || 0
            break
          case 'profit':
            aValue = a.profit || 0
            bValue = b.profit || 0
            break
          case 'storage':
            aValue = a.storage || 0
            bValue = b.storage || 0
            break
          case 'commission':
            aValue = a.commission || 0
            bValue = b.commission || 0
            break
          case 'comment':
            aValue = (a.comment || '').toLowerCase()
            bValue = (b.comment || '').toLowerCase()
            break
          default:
            return 0
        }

        if (typeof aValue === 'string') {
          return dealsSortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        } else {
          return dealsSortDirection === 'asc'
            ? aValue - bValue
            : bValue - aValue
        }
      })
    }

    return filtered
  })()

  // Apply pagination to deals
  const dealsTotalPages = Math.ceil(filteredDealsResult.length / dealsItemsPerPage)
  const dealsStartIndex = (dealsCurrentPage - 1) * dealsItemsPerPage
  const dealsEndIndex = dealsStartIndex + dealsItemsPerPage
  const displayedDeals = filteredDealsResult.slice(dealsStartIndex, dealsEndIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setDealsCurrentPage(1)
  }, [dealsSearchQuery, hasAppliedFilter])

  // Keep page-size selection valid when total filtered rows changes
  useEffect(() => {
    const total = filteredDealsResult.length
    const options = getDealsPageSizeOptions(total)
    if (options.length > 0 && (!options.includes(dealsItemsPerPage) || dealsItemsPerPage > total)) {
      setDealsItemsPerPage(options[0] || 50)
      setDealsCurrentPage(1)
    }
  }, [filteredDealsResult.length])

  // Column resize handlers for positions
  const handlePositionsResizeStart = (e, columnKey) => {
    e.preventDefault()
    setResizingPositionsColumn(columnKey)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = positionsColumnWidths[columnKey] || 150
  }

  const handlePositionsResizeMove = (e) => {
    if (!resizingPositionsColumn) return
    const diff = e.clientX - resizeStartX.current
    const newWidth = Math.max(80, resizeStartWidth.current + diff)
    setPositionsColumnWidths(prev => ({
      ...prev,
      [resizingPositionsColumn]: newWidth
    }))
  }

  const handlePositionsResizeEnd = () => {
    setResizingPositionsColumn(null)
  }

  // Column resize handlers for deals
  const handleDealsResizeStart = (e, columnKey) => {
    e.preventDefault()
    setResizingDealsColumn(columnKey)
    resizeStartX.current = e.clientX
    resizeStartWidth.current = dealsColumnWidths[columnKey] || 150
  }

  const handleDealsResizeMove = (e) => {
    if (!resizingDealsColumn) return
    const diff = e.clientX - resizeStartX.current
    const newWidth = Math.max(80, resizeStartWidth.current + diff)
    setDealsColumnWidths(prev => ({
      ...prev,
      [resizingDealsColumn]: newWidth
    }))
  }

  const handleDealsResizeEnd = () => {
    setResizingDealsColumn(null)
  }

  // Add mouse event listeners for resize
  useEffect(() => {
    if (resizingPositionsColumn || resizingDealsColumn) {
      const handleMove = (e) => {
        handlePositionsResizeMove(e)
        handleDealsResizeMove(e)
      }
      const handleEnd = () => {
        handlePositionsResizeEnd()
        handleDealsResizeEnd()
      }
      document.addEventListener('mousemove', handleMove)
      document.addEventListener('mouseup', handleEnd)
      return () => {
        document.removeEventListener('mousemove', handleMove)
        document.removeEventListener('mouseup', handleEnd)
      }
    }
  }, [resizingPositionsColumn, resizingDealsColumn, positionsColumnWidths, dealsColumnWidths])

  const handleFundsOperation = async (e) => {
    e.preventDefault()
    
    if (!amount || parseFloat(amount) <= 0) {
      setOperationError('Please enter a valid amount')
      return
    }

    try {
      setOperationLoading(true)
      setOperationError('')
      setOperationSuccess('')

      const amountValue = parseFloat(amount)
      const commentValue = comment || `${operationType} operation`

      let response
      switch (operationType) {
        case 'deposit':
          response = await brokerAPI.depositFunds(client.login, amountValue, commentValue)
          break
        case 'withdrawal':
          response = await brokerAPI.withdrawFunds(client.login, amountValue, commentValue)
          break
        case 'credit_in':
          response = await brokerAPI.creditIn(client.login, amountValue, commentValue)
          break
        case 'credit_out':
          response = await brokerAPI.creditOut(client.login, amountValue, commentValue)
          break
        default:
          throw new Error('Invalid operation type')
      }

      setOperationSuccess(response.message || 'Operation completed successfully')
      setAmount('')
      setComment('')
      
      // Refresh deals and client data silently (no page reload)
      // Wait a bit for the server to process the transaction
      setTimeout(async () => {
        await fetchUpdatedClientData()
        
        // Clear positions cache so it refetches on next page load
        if (onCacheUpdate) {
          onCacheUpdate(null)
        }
        
        await fetchDeals()
      }, 1000)
    } catch (error) {
      setOperationError(error.response?.data?.message || 'Operation failed. Please try again.')
    } finally {
      setOperationLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b-2 border-slate-200 bg-blue-600">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {(client?.name && String(client.name).trim().length > 0)
                ? `${client.name} - ${client.login}`
                : client.login}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <p className="text-[11px] text-blue-100">{client.email || 'No email'}</p>
              {client.lastAccess && (
                <p className="text-[11px] text-blue-100">
                  Last Access: <span className="font-semibold text-white">{formatTime(client.lastAccess)}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100 p-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 px-2 bg-white shadow-sm">
          <div className="flex overflow-x-auto">
            <button
              onClick={() => setActiveTab('positions')}
              className={`px-6 py-3.5 text-sm font-semibold transition-all duration-200 border-b-3 whitespace-nowrap relative ${
                activeTab === 'positions'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-slate-600 hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              Positions ({positions.length})
            </button>
            <button
              onClick={() => setActiveTab('netpositions')}
              className={`px-6 py-3.5 text-sm font-semibold transition-all duration-200 border-b-3 whitespace-nowrap relative ${
                activeTab === 'netpositions'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-slate-600 hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              NET Position ({netPositions.length})
            </button>
            <button
              onClick={() => setActiveTab('deals')}
              className={`px-6 py-3.5 text-sm font-semibold transition-all duration-200 border-b-3 whitespace-nowrap relative ${
                activeTab === 'deals'
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-slate-600 hover:text-blue-600 hover:bg-slate-50'
              }`}
            >
              Deals ({deals.length})
            </button>
          </div>

          {/* Controls for Positions Tab */}
          {activeTab === 'positions' && (
            <div className="flex items-center justify-between gap-1.5 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">Show:</span>
                <select
                  value={positionsItemsPerPage}
                  onChange={(e) => setPositionsItemsPerPage(parseInt(e.target.value))}
                  className="px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  {getPositionsPageSizeOptions(filteredPositions.length).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Columns Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowPositionsColumnSelector(!showPositionsColumnSelector)}
                    className="text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded hover:bg-gray-100 border border-gray-300 transition-colors inline-flex items-center gap-1 text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Columns
                  </button>
                  {showPositionsColumnSelector && (
                    <div
                      ref={positionsColumnSelectorRef}
                      className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48"
                      style={{ maxHeight: '300px', overflowY: 'auto' }}
                    >
                      <div className="px-2 py-1 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-700 uppercase">Show/Hide Columns</p>
                      </div>
                      {positionsColumns.map(col => (
                        <label
                          key={col.key}
                          className="flex items-center px-2 py-1 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={positionsVisibleColumns[col.key] === true}
                            onChange={() => togglePositionsColumn(col.key)}
                            className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                          />
                          <span className="ml-2 text-xs text-gray-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Filter Button */}
                <div className="relative" ref={dealStatsFilterRef}>
                  <button
                    onClick={() => setShowDealStatsFilter(v => !v)}
                    className="text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded hover:bg-gray-100 border border-gray-300 transition-colors inline-flex items-center gap-1 text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6M11 16h2"/></svg>
                    Card Filter
                  </button>
                  {showDealStatsFilter && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-50 w-64 max-h-80 overflow-y-auto">
                      <p className="text-[11px] font-semibold text-gray-700 uppercase mb-1">Position Metrics</p>
                      {[
                        ['pf_totalPositions','Total Positions'],
                        ['pf_totalVolume','Total Volume'],
                        ['pf_totalPL','Floating Profit'],
                        ['pf_lifetimePnL','Lifetime PnL'],
                        ['pf_bookPnL','Book PnL']
                      ].map(([key,label]) => (
                        <label key={key} className="flex items-center gap-2 py-1 px-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" className="w-3 h-3" checked={fixedCardVisibility[key]} onChange={() => setFixedCardVisibility(prev => ({...prev, [key]: !prev[key]}))} />
                          <span className="text-[12px] text-gray-700">{label}</span>
                        </label>
                      ))}
                      <div className="h-px bg-gray-200 my-2" />
                      <p className="text-[11px] font-semibold text-gray-700 uppercase mb-1">Money Metrics</p>
                      {[
                        ['pf_balance','Balance'],
                        ['pf_credit','Credit'],
                        ['pf_equity','Equity']
                      ].map(([key,label]) => (
                        <label key={key} className="flex items-center gap-2 py-1 px-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" className="w-3 h-3" checked={fixedCardVisibility[key]} onChange={() => setFixedCardVisibility(prev => ({...prev, [key]: !prev[key]}))} />
                          <span className="text-[12px] text-gray-700">{label}</span>
                        </label>
                      ))}
                      <div className="h-px bg-gray-200 my-2" />
                      <p className="text-[11px] font-semibold text-gray-700 uppercase mb-1">Deals Summary</p>
                      {(dealStats ? Object.keys({ ...dealStats }) : Object.keys(defaultDealStatVisibility))
                        .sort()
                        .map(key => (
                        <label key={key} className="flex items-center gap-2 py-1 px-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" className="w-3 h-3" checked={dealStatVisibility[key] ?? false} onChange={() => toggleDealStatKey(key)} />
                          <span className="text-[12px] text-gray-700">{toTitle(key)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {filteredPositions.length > 0 && positionsItemsPerPage !== 'All' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPositionsCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={positionsCurrentPage === 1}
                    className={`p-0.5 rounded transition-colors ${
                      positionsCurrentPage === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-blue-100 cursor-pointer'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-xs text-gray-700 font-medium px-1">
                    {positionsCurrentPage}/{positionsTotalPages}
                  </span>
                  
                  <button
                    onClick={() => setPositionsCurrentPage(prev => Math.min(positionsTotalPages, prev + 1))}
                    disabled={positionsCurrentPage === positionsTotalPages}
                    className={`p-0.5 rounded transition-colors ${
                      positionsCurrentPage === positionsTotalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-blue-100 cursor-pointer'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              </div>
            </div>
          )}
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50">
          {activeTab === 'positions' && (
            <div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">No open positions</p>
                </div>
              ) : (
                <>
                  
                  {/* Search Bar */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative flex-1" ref={searchRef}>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setShowSearchSuggestions(true)
                        }}
                        onFocus={() => setShowSearchSuggestions(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setShowSearchSuggestions(false)
                          }
                        }}
                        placeholder="Search by symbol, position, type, volume..."
                        className="w-full pl-9 pr-10 py-2 text-sm text-gray-700 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400"
                      />
                      <svg 
                        className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('')
                            setShowSearchSuggestions(false)
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Search Suggestions Dropdown */}
                      {showSearchSuggestions && getPositionSearchSuggestions().length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-[60] max-h-40 overflow-y-auto">
                          {getPositionSearchSuggestions().map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setSearchQuery(suggestion.value)
                                setShowSearchSuggestions(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                              <span className="text-gray-700">{suggestion.value}</span>
                              <span className="ml-auto text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{suggestion.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {displayedPositions.length} of {filteredPositions.length} positions
                    </div>
                  </div>
                  
                  {filteredPositions.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-gray-500 text-sm font-medium mb-1">No positions found</p>
                      <p className="text-gray-400 text-xs">Try adjusting your search or filters</p>
                      {(searchQuery || Object.keys(columnFilters).length > 0) && (
                        <button
                          onClick={() => {
                            setSearchQuery('')
                            setColumnFilters({})
                          }}
                          className="mt-3 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-96 relative">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-600 sticky top-0 z-10 shadow-md">
                      <tr>
                        {positionsVisibleColumns.time && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['time'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('time')}
                        >
                          <div className="flex items-center gap-1.5">
                            Time
                            <SortIcon column="time" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                            <div className="relative" ref={el => filterRefs.current['time'] = el}>
                              <button
                                onClick={() => setShowFilterDropdown(showFilterDropdown === 'time' ? null : 'time')}
                                className={`p-0.5 rounded hover:bg-blue-700 transition-colors ${getActiveFilterCount('time') > 0 ? 'text-yellow-300' : 'text-blue-100'}`}
                                title="Filter"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                              {getActiveFilterCount('time') > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {getActiveFilterCount('time')}
                                </span>
                              )}
                              {showFilterDropdown === 'time' && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48 max-h-40 overflow-y-auto">
                                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Filter by Time</span>
                                    {getActiveFilterCount('time') > 0 && (
                                      <button
                                        onClick={() => clearColumnFilter('time')}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {getUniqueColumnValues('time').map(value => (
                                    <label key={value} className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={columnFilters.time?.includes(value) || false}
                                        onChange={() => toggleColumnFilter('time', value)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-700">{value}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'time')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.position && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['position'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('position')}
                        >
                          <div className="flex items-center gap-1.5">
                            Position
                            <SortIcon column="position" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'position')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.symbol && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['symbol'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('symbol')}
                        >
                          <div className="flex items-center gap-1.5">
                            Symbol
                            <SortIcon column="symbol" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                            <div className="relative" ref={el => filterRefs.current['symbol'] = el}>
                              <button
                                onClick={() => setShowFilterDropdown(showFilterDropdown === 'symbol' ? null : 'symbol')}
                                className={`p-0.5 rounded hover:bg-blue-700 transition-colors ${getActiveFilterCount('symbol') > 0 ? 'text-yellow-300' : 'text-blue-100'}`}
                                title="Filter"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                              {getActiveFilterCount('symbol') > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {getActiveFilterCount('symbol')}
                                </span>
                              )}
                              {showFilterDropdown === 'symbol' && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48 max-h-48 overflow-y-auto">
                                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Filter by Symbol</span>
                                    {getActiveFilterCount('symbol') > 0 && (
                                      <button
                                        onClick={() => clearColumnFilter('symbol')}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {getUniqueColumnValues('symbol').map(value => (
                                    <label key={value} className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={columnFilters.symbol?.includes(value) || false}
                                        onChange={() => toggleColumnFilter('symbol', value)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-700">{value}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'symbol')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.action && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['action'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('action')}
                        >
                          <div className="flex items-center gap-1.5">
                            Type
                            <SortIcon column="action" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                            <div className="relative" ref={el => filterRefs.current['type'] = el}>
                              <button
                                onClick={() => setShowFilterDropdown(showFilterDropdown === 'type' ? null : 'type')}
                                className={`p-0.5 rounded hover:bg-blue-700 transition-colors ${getActiveFilterCount('type') > 0 ? 'text-yellow-300' : 'text-blue-100'}`}
                                title="Filter"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                              {getActiveFilterCount('type') > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {getActiveFilterCount('type')}
                                </span>
                              )}
                              {showFilterDropdown === 'type' && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48 max-h-48 overflow-y-auto">
                                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Filter by Type</span>
                                    {getActiveFilterCount('type') > 0 && (
                                      <button
                                        onClick={() => clearColumnFilter('type')}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {getUniqueColumnValues('type').map(value => (
                                    <label key={value} className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={columnFilters.type?.includes(value) || false}
                                        onChange={() => toggleColumnFilter('type', value)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-700">{value}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'action')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.volume && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['volume'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('volume')}
                        >
                          <div className="flex items-center gap-1.5">
                            Volume
                            <SortIcon column="volume" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'volume')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.priceOpen && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['priceOpen'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('priceOpen')}
                        >
                          <div className="flex items-center gap-1.5">
                            Open Price
                            <SortIcon column="priceOpen" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'priceOpen')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.priceCurrent && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['priceCurrent'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('priceCurrent')}
                        >
                          <div className="flex items-center gap-1.5">
                            Current Price
                            <SortIcon column="priceCurrent" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'priceCurrent')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.sl && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['sl'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('sl')}
                        >
                          <div className="flex items-center gap-1.5">
                            S/L
                            <SortIcon column="sl" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'sl')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.tp && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['tp'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('tp')}
                        >
                          <div className="flex items-center gap-1.5">
                            T/P
                            <SortIcon column="tp" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'tp')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.profit && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['profit'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('profit')}
                        >
                          <div className="flex items-center gap-1.5">
                            Profit
                            <SortIcon column="profit" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'profit')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.storage && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['storage'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('storage')}
                        >
                          <div className="flex items-center gap-1.5">
                            Storage
                            <SortIcon column="storage" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'storage')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.commission && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['commission'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('commission')}
                        >
                          <div className="flex items-center gap-1.5">
                            Commission
                            <SortIcon column="commission" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'commission')}
                          />
                        </th>
                        )}
                        {positionsVisibleColumns.comment && (
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: positionsColumnWidths['comment'] || 'auto', minWidth: '80px' }}
                          onClick={() => handlePositionsSort('comment')}
                        >
                          <div className="flex items-center gap-1.5">
                            Comment
                            <SortIcon column="comment" currentColumn={positionsSortColumn} direction={positionsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handlePositionsResizeStart(e, 'comment')}
                          />
                        </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {displayedPositions.map((position) => (
                        <tr key={position.position} className="hover:bg-blue-50 transition-colors">
                          {positionsVisibleColumns.time && (
                          <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(position.timeCreate)}
                          </td>
                          )}
                          {positionsVisibleColumns.position && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            #{position.position}
                          </td>
                          )}
                          {positionsVisibleColumns.symbol && (
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {position.symbol}
                          </td>
                          )}
                          {positionsVisibleColumns.action && (
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getActionColor(position.action)}`}>
                              {getActionLabel(position.action)}
                            </span>
                          </td>
                          )}
                          {positionsVisibleColumns.volume && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.volume}
                          </td>
                          )}
                          {positionsVisibleColumns.priceOpen && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {typeof position.priceOpen === 'number' ? position.priceOpen.toFixed(5) : '-'}
                          </td>
                          )}
                          {positionsVisibleColumns.priceCurrent && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {typeof position.priceCurrent === 'number' ? position.priceCurrent.toFixed(5) : '-'}
                          </td>
                          )}
                          {positionsVisibleColumns.sl && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.priceSL > 0 ? position.priceSL.toFixed(5) : '-'}
                          </td>
                          )}
                          {positionsVisibleColumns.tp && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.priceTP > 0 ? position.priceTP.toFixed(5) : '-'}
                          </td>
                          )}
                          {positionsVisibleColumns.profit && (
                          <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${getProfitColor(position.profit)}`}>
                            {formatCurrency(position.profit)}
                          </td>
                          )}
                          {positionsVisibleColumns.storage && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {typeof position.storage === 'number' ? formatCurrency(position.storage) : '-'}
                          </td>
                          )}
                          {positionsVisibleColumns.commission && (
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {typeof position.commission === 'number' ? formatCurrency(position.commission) : '-'}
                          </td>
                          )}
                          {positionsVisibleColumns.comment && (
                          <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap max-w-xs truncate">
                            {position.comment || '-'}
                          </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'netpositions' && (
            <div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : netPositions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">No net positions available</p>
                  <p className="text-gray-400 text-xs mt-1">Open some positions to see NET position summary</p>
                </div>
              ) : (
                <div className="overflow-x-auto overflow-y-auto max-h-96 relative">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-600 sticky top-0 z-10 shadow-md">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Symbol</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">NET Type</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">NET Volume</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Avg Open Price</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Total Profit</th>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Positions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {netPositions.map((netPos, index) => (
                        <tr key={`${netPos.symbol}-${index}`} className="hover:bg-blue-50 transition-colors">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {netPos.symbol}
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              netPos.netType === 'Buy' 
                                ? 'text-green-600 bg-green-50' 
                                : netPos.netType === 'Sell'
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-gray-600 bg-gray-50'
                            }`}>
                              {netPos.netType}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap font-semibold">
                            {netPos.netVolume.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {netPos.avgOpenPrice > 0 ? netPos.avgOpenPrice.toFixed(5) : '-'}
                          </td>
                          <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${getProfitColor(netPos.totalProfit)}`}>
                            {formatCurrency(netPos.totalProfit)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                            {netPos.positionCount} {netPos.positionCount === 1 ? 'position' : 'positions'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deals' && (
            <div>
              {/* Date Filter with Dropdown Presets */}
              <div className="bg-blue-50 rounded-lg p-2 mb-3 border border-blue-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-700 whitespace-nowrap">Date Range:</span>
                    <input
                      type="date"
                      value={formatDateToInput(fromDate)}
                      onChange={(e) => {
                        setFromDate(e.target.value)
                        setSelectedPreset('')
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="date"
                      value={formatDateToInput(toDate)}
                      onChange={(e) => {
                        setToDate(e.target.value)
                        setSelectedPreset('')
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs text-gray-900"
                    />
                    <button
                      onClick={handleApplyDateFilter}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-all inline-flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      Apply
                    </button>
                    <button
                      onClick={handleClearDateFilter}
                      className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Clear
                    </button>
                    
                    {/* Quick Filters Dropdown */}
                    <select
                      value={selectedPreset}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDatePreset(e.target.value)
                        }
                      }}
                      className="px-3 py-1 text-xs font-medium border-2 border-blue-300 rounded-md bg-white text-blue-700 hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all shadow-sm"
                    >
                      <option value="">Quick Filters</option>
                      <option value="today">Today</option>
                      <option value="lastweek">Last Week</option>
                      <option value="lastmonth">Last Month</option>
                      <option value="last3months">Last 3 Months</option>
                      <option value="last6months">Last 6 Months</option>
                      <option value="allhistory">All History</option>
                    </select>
                    
                    {operationError && (
                      <span className="text-xs text-red-600 ml-2">{operationError}</span>
                    )}
                    {!hasAppliedFilter && !operationError && (
                      <span className="text-xs text-blue-600 ml-2 inline-flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Select a quick filter or custom range
                      </span>
                    )}
                  </div>

                  {/* Pagination Controls */}
                  {filteredDealsResult.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-600">Show:</span>
                        <select
                          value={dealsItemsPerPage}
                          onChange={(e) => setDealsItemsPerPage(parseInt(e.target.value))}
                          className="px-1.5 py-0.5 text-xs border border-gray-300 rounded bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          {getDealsPageSizeOptions(filteredDealsResult.length).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDealsCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={dealsCurrentPage === 1}
                            className={`p-0.5 rounded transition-colors ${
                              dealsCurrentPage === 1
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-blue-100 cursor-pointer'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          <span className="text-xs text-gray-700 font-medium px-1">
                            {dealsCurrentPage}/{dealsTotalPages}
                          </span>
                          
                          <button
                            onClick={() => setDealsCurrentPage(prev => Math.min(dealsTotalPages, prev + 1))}
                            disabled={dealsCurrentPage === dealsTotalPages}
                            className={`p-0.5 rounded transition-colors ${
                              dealsCurrentPage === dealsTotalPages
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-blue-100 cursor-pointer'
                            }`}
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                    </div>
                  )}
                </div>
              </div>

              {dealsServerLimitReached && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Showing first {CLIENT_DEALS_FETCH_LIMIT} deals for this range. Narrow date range to see older records.
                  </p>
                </div>
              )}

              {dealsLoading ? (
                <>
                  {/* Show table structure with loading bar */}
                  <div className="overflow-x-auto overflow-y-auto max-h-96 relative">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-600 sticky top-0 z-10 shadow-md">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Time</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Deal</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Order</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Position</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Symbol</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Action</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Volume</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Price</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Commission</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Storage</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Profit</th>
                          <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase">Comment</th>
                        </tr>
                      </thead>

                      {/* YouTube-style Loading Progress Bar */}
                      <thead className="sticky z-40" style={{ top: '48px' }}>
                        <tr>
                          <th colSpan="12" className="p-0" style={{ height: '3px' }}>
                            <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                              <style>{`
                                @keyframes shimmerSlideDeals {
                                  0% { transform: translateX(-100%); }
                                  100% { transform: translateX(400%); }
                                }
                                .shimmer-loading-bar-deals {
                                  width: 30%;
                                  height: 100%;
                                  background: #2563eb;
                                  animation: shimmerSlideDeals 0.9s linear infinite;
                                }
                              `}</style>
                              <div className="shimmer-loading-bar-deals absolute top-0 left-0 h-full" />
                            </div>
                          </th>
                        </tr>
                      </thead>

                      <tbody className="bg-white">
                        <tr>
                          <td colSpan="12" className="px-6 py-8 text-center text-sm text-gray-400">
                            Loading deals...
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              ) : !hasAppliedFilter ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-blue-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm font-medium mb-1">Select Date Range</p>
                  <p className="text-gray-400 text-xs">Choose a date range and click Apply to view deals</p>
                </div>
              ) : filteredDeals.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500 text-sm">No deals found for the selected date range</p>
                  <p className="text-gray-400 text-xs mt-1">Try adjusting your date range</p>
                </div>
              ) : (
                <>
                  {/* Search Bar */}
                  <div className="mb-4 flex items-center gap-3">
                    <div className="relative flex-1" ref={dealsSearchRef}>
                      <div className="relative">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          value={dealsSearchQuery}
                          onChange={(e) => setDealsSearchQuery(e.target.value)}
                          onFocus={() => setShowDealsSearchSuggestions(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setShowDealsSearchSuggestions(false);
                            }
                          }}
                          placeholder="Search deals by time, symbol, or action..."
                          className="w-full pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-700 placeholder:text-gray-400"
                        />
                        {dealsSearchQuery && (
                          <button
                            onClick={() => setDealsSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Search Suggestions Dropdown */}
                      {showDealsSearchSuggestions && dealsSearchQuery && getDealsSearchSuggestions().length > 0 && (
                        <div className="absolute z-[60] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {getDealsSearchSuggestions().map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setDealsSearchQuery(suggestion.value);
                                setShowDealsSearchSuggestions(false);
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                            >
                              <span className="text-gray-700">{suggestion.value}</span>
                              <span className="ml-auto text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{suggestion.type}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 whitespace-nowrap">
                      {displayedDeals.length} of {filteredDealsResult.length} deals
                    </div>
                  </div>

                  {displayedDeals.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-gray-500 text-sm font-medium mb-1">No deals match your search</p>
                      <p className="text-gray-400 text-xs mb-3">Try different search terms or clear filters</p>
                      <button
                        onClick={() => {
                          setDealsSearchQuery('');
                          setDealsColumnFilters({});
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                      >
                        Clear all filters
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto overflow-y-auto max-h-96 relative">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-blue-600 sticky top-0 z-10 shadow-md">
                            <tr>
                              <th 
                                className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                                style={{ width: dealsColumnWidths['time'] || 'auto', minWidth: '80px' }}
                                onClick={() => handleDealsSort('time')}
                              >
                                <div className="flex items-center gap-1.5">
                                  Time
                                  <SortIcon column="time" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                                  <div className="relative" ref={el => dealsFilterRefs.current['time'] = el}>
                              <button
                                onClick={() => setShowDealsFilterDropdown(showDealsFilterDropdown === 'time' ? null : 'time')}
                                className={`p-0.5 rounded hover:bg-blue-700 transition-colors ${getActiveDealsFilterCount('time') > 0 ? 'text-yellow-300' : 'text-blue-100'}`}
                                title="Filter"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                              {getActiveDealsFilterCount('time') > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {getActiveDealsFilterCount('time')}
                                </span>
                              )}
                              {showDealsFilterDropdown === 'time' && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48 max-h-40 overflow-y-auto">
                                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Filter by Time</span>
                                    {getActiveDealsFilterCount('time') > 0 && (
                                      <button
                                        onClick={() => clearDealsColumnFilter('time')}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {getUniqueDealsColumnValues('time').map(value => (
                                    <label key={value} className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={dealsColumnFilters.time?.includes(value) || false}
                                        onChange={() => toggleDealsColumnFilter('time', value)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-700">{value}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'time')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['deal'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('deal')}
                        >
                          <div className="flex items-center gap-1.5">
                            Deal
                            <SortIcon column="deal" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'deal')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative" 
                          style={{ width: dealsColumnWidths['order'] || 'auto', minWidth: '80px' }}
                        >
                          Order
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'order')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['position'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('position')}
                        >
                          <div className="flex items-center gap-1.5">
                            Position
                            <SortIcon column="position" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'position')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['symbol'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('symbol')}
                        >
                          <div className="flex items-center gap-1.5">
                            Symbol
                            <SortIcon column="symbol" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                            <div className="relative" ref={el => dealsFilterRefs.current['symbol'] = el}>
                              <button
                                onClick={() => setShowDealsFilterDropdown(showDealsFilterDropdown === 'symbol' ? null : 'symbol')}
                                className={`p-0.5 rounded hover:bg-blue-700 transition-colors ${getActiveDealsFilterCount('symbol') > 0 ? 'text-yellow-300' : 'text-blue-100'}`}
                                title="Filter"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                              {getActiveDealsFilterCount('symbol') > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {getActiveDealsFilterCount('symbol')}
                                </span>
                              )}
                              {showDealsFilterDropdown === 'symbol' && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48 max-h-40 overflow-y-auto">
                                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Filter by Symbol</span>
                                    {getActiveDealsFilterCount('symbol') > 0 && (
                                      <button
                                        onClick={() => clearDealsColumnFilter('symbol')}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {getUniqueDealsColumnValues('symbol').map(value => (
                                    <label key={value} className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={dealsColumnFilters.symbol?.includes(value) || false}
                                        onChange={() => toggleDealsColumnFilter('symbol', value)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-700">{value}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'symbol')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['action'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('action')}
                        >
                          <div className="flex items-center gap-1.5">
                            Action
                            <SortIcon column="action" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                            <div className="relative" ref={el => dealsFilterRefs.current['action'] = el}>
                              <button
                                onClick={() => setShowDealsFilterDropdown(showDealsFilterDropdown === 'action' ? null : 'action')}
                                className={`p-0.5 rounded hover:bg-blue-700 transition-colors ${getActiveDealsFilterCount('action') > 0 ? 'text-yellow-300' : 'text-blue-100'}`}
                                title="Filter"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                              </button>
                              {getActiveDealsFilterCount('action') > 0 && (
                                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-yellow-400 text-blue-900 text-[9px] font-bold rounded-full flex items-center justify-center">
                                  {getActiveDealsFilterCount('action')}
                                </span>
                              )}
                              {showDealsFilterDropdown === 'action' && (
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 w-48 max-h-40 overflow-y-auto">
                                  <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Filter by Action</span>
                                    {getActiveDealsFilterCount('action') > 0 && (
                                      <button
                                        onClick={() => clearDealsColumnFilter('action')}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                  {getUniqueDealsColumnValues('action').map(value => (
                                    <label key={value} className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={dealsColumnFilters.action?.includes(value) || false}
                                        onChange={() => toggleDealsColumnFilter('action', value)}
                                        className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-xs text-gray-700">{value}</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'action')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['volume'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('volume')}
                        >
                          <div className="flex items-center gap-1.5">
                            Volume
                            <SortIcon column="volume" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'volume')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['price'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('price')}
                        >
                          <div className="flex items-center gap-1.5">
                            Price
                            <SortIcon column="price" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'price')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['commission'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('commission')}
                        >
                          <div className="flex items-center gap-1.5">
                            Commission
                            <SortIcon column="commission" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'commission')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['storage'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('storage')}
                        >
                          <div className="flex items-center gap-1.5">
                            Storage
                            <SortIcon column="storage" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'storage')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['profit'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('profit')}
                        >
                          <div className="flex items-center gap-1.5">
                            Profit
                            <SortIcon column="profit" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'profit')}
                          />
                        </th>
                        <th 
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase relative cursor-pointer hover:bg-blue-700"
                          style={{ width: dealsColumnWidths['comment'] || 'auto', minWidth: '80px' }}
                          onClick={() => handleDealsSort('comment')}
                        >
                          <div className="flex items-center gap-1.5">
                            Comment
                            <SortIcon column="comment" currentColumn={dealsSortColumn} direction={dealsSortDirection} />
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-blue-300/50 hover:bg-yellow-400 active:bg-yellow-500"
                            onMouseDown={(e) => handleDealsResizeStart(e, 'comment')}
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {displayedDeals.map((deal) => (
                        <tr key={deal.deal} className="hover:bg-blue-50 transition-colors">
                          <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(deal.time)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            #{deal.deal}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.order > 0 ? `#${deal.order}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.position > 0 ? `#${deal.position}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {deal.symbol || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDealActionColor(deal.action)}`}>
                              {getDealActionLabel(deal.action)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.volume > 0 ? deal.volume.toFixed(2) : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.price > 0 ? deal.price.toFixed(5) : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {formatCurrency(deal.commission)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {formatCurrency(deal.storage)}
                          </td>
                          <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${getProfitColor(deal.profit)}`}>
                            {formatCurrency(deal.profit)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap max-w-xs truncate">
                            {deal.comment || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

        </div>

        {/* Summary Cards - Fixed at Bottom */}
  <div className="flex-shrink-0 p-1.5 bg-slate-50 border-t-2 border-blue-200">
          {/* Show face cards even if there are no open positions (missing values default to 0) */}
          {activeTab === 'positions' && (
            <div className="space-y-1">
              {/* Positions + Deals Summary face cards in 2 rows of Excel-like cells */}
              {(() => {
                // Build first row: fixed position & money cards
                const row1 = []
                const totalPL = positions.reduce((sum, p) => sum + (p.profit || 0), 0)
                const lifetime = Number(clientData?.lifetimePnL ?? clientData?.pnl ?? 0)
                const floating = Number(clientData?.floating ?? totalPL)
                const bookPnL = lifetime + floating

                if (fixedCardVisibility.pf_totalPositions) {
                  row1.push({ label: 'Positions', value: String(positions.length), labelClass: 'text-blue-700', accent: 'border-blue-300' })
                }
                if (fixedCardVisibility.pf_totalVolume) {
                  const vol = positions.reduce((sum, p) => sum + (p.volume || 0), 0)
                  row1.push({ label: 'Total Volume', value: vol.toFixed(2), labelClass: 'text-indigo-700', accent: 'border-indigo-300' })
                }
                if (fixedCardVisibility.pf_totalPL) {
                  row1.push({ label: 'Floating Profit', value: formatCurrency(totalPL), labelClass: totalPL >= 0 ? 'text-emerald-700' : 'text-red-700', valueClass: getProfitColor(totalPL), accent: totalPL >= 0 ? 'border-emerald-400' : 'border-red-400' })
                }
                if (fixedCardVisibility.pf_lifetimePnL) {
                  row1.push({ label: 'Lifetime PnL', value: formatCurrency(lifetime), labelClass: lifetime >= 0 ? 'text-teal-700' : 'text-orange-700', valueClass: getProfitColor(lifetime), accent: lifetime >= 0 ? 'border-teal-400' : 'border-orange-400' })
                }
                if (fixedCardVisibility.pf_bookPnL) {
                  row1.push({ label: 'Book PnL', value: formatCurrency(bookPnL), labelClass: bookPnL >= 0 ? 'text-emerald-700' : 'text-red-700', valueClass: getProfitColor(bookPnL), accent: bookPnL >= 0 ? 'border-emerald-400' : 'border-red-400' })
                }
                if (fixedCardVisibility.pf_balance) {
                  row1.push({ label: 'Balance', value: formatCurrency(clientData?.balance), labelClass: 'text-cyan-700', accent: 'border-cyan-300' })
                }
                if (fixedCardVisibility.pf_credit) {
                  row1.push({ label: 'Credit', value: formatCurrency(clientData?.credit), labelClass: 'text-violet-700', accent: 'border-violet-300' })
                }
                if (fixedCardVisibility.pf_equity) {
                  row1.push({ label: 'Equity', value: formatCurrency(clientData?.equity), labelClass: 'text-green-700', accent: 'border-green-300' })
                }

                // Build second row: Deals Summary (six face cards from GET stats)
                const keys = dealStats ? Object.keys(dealStats) : []
                const visibleKeys = keys.filter(k => dealStatVisibility[k])
                const baseKeys = visibleKeys.length ? visibleKeys : Object.keys(defaultDealStatVisibility)
                const preferredOrder = ['totalCommission','totalDeals','totalPnL','totalStorage','totalVolume','winRate']
                const toRender = [
                  ...preferredOrder.filter(k => baseKeys.includes(k)),
                  ...baseKeys.filter(k => !preferredOrder.includes(k))
                ]
                const row2 = []
                const dealAccent = (k, v) => {
                  if (k === 'totalCommission') return 'border-amber-400'
                  if (k === 'totalDeals') return 'border-blue-300'
                  if (k === 'totalPnL') return (Number(v || 0) >= 0) ? 'border-emerald-400' : 'border-red-400'
                  if (k === 'totalStorage') return (Number(v || 0) >= 0) ? 'border-teal-400' : 'border-orange-400'
                  if (k === 'totalVolume') return 'border-indigo-300'
                  if (k === 'winRate') return (Number(v || 0) >= 50) ? 'border-green-400' : 'border-orange-400'
                  return 'border-gray-200'
                }
                toRender.forEach((key) => {
                  const styles = getDealStatStyle(key, dealStats?.[key])
                  row2.push({ label: toTitle(key), value: formatStatValue(key, dealStats?.[key]), labelClass: styles.label, valueClass: styles.value, accent: dealAccent(key, dealStats?.[key]) })
                })

                if (!row1.length && !row2.length) return null

                return (
                  <div className="space-y-2">
                    <div className="ring-1 ring-gray-300 rounded-sm overflow-hidden bg-white grid divide-x divide-y divide-gray-300" style={{ gridTemplateColumns: `repeat(${row1.length || 1}, minmax(0, 1fr))` }}>
                      {row1.map((it, idx) => (
                        <div key={`r1-${it.label}-${idx}`} className={`p-2 bg-gray-50 border-t-2 ${it.accent || 'border-gray-200'}`}>
                          <p className={`text-[10px] sm:text-[11px] font-semibold ${it.labelClass}`}>{it.label}</p>
                          <p className={`text-xs font-bold ${it.valueClass || 'text-gray-800'}`}>{it.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="ring-1 ring-gray-300 rounded-sm overflow-hidden bg-white grid divide-x divide-y divide-gray-300" style={{ gridTemplateColumns: `repeat(${row2.length || 1}, minmax(0, 1fr))` }}>
                      {row2.map((it, idx) => (
                        <div key={`r2-${it.label}-${idx}`} className={`p-2 bg-gray-50 border-t-2 ${it.accent || 'border-gray-200'}`}>
                          <p className={`text-[10px] sm:text-[11px] font-semibold ${it.labelClass}`}>{it.label}</p>
                          <p className={`text-xs font-bold ${it.valueClass || 'text-gray-800'}`}>{it.value}</p>
                        </div>
                      ))}
                    </div>
                    {dealStatsError && <p className="text-[11px] text-red-600">{dealStatsError}</p>}
                  </div>
                )
              })()}
            </div>
          )}

          {activeTab === 'netpositions' && netPositions.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-purple-50 rounded-lg border border-purple-200 p-2 hover:shadow-sm transition-shadow">
                <p className="text-[9px] font-semibold text-purple-600 uppercase mb-0.5">NET Symbols</p>
                <p className="text-base font-bold text-purple-900">{netPositions.length}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-2 hover:shadow-sm transition-shadow">
                <p className="text-[9px] font-semibold text-indigo-600 uppercase mb-0.5">Total NET Volume</p>
                <p className="text-base font-bold text-indigo-900">
                  {netPositions.reduce((sum, p) => sum + p.netVolume, 0).toFixed(2)}
                </p>
              </div>
              {(() => {
                const buyTotal = netPositions.filter(p => p.netType === 'Buy').reduce((sum, p) => sum + p.totalProfit, 0)
                const sellTotal = netPositions.filter(p => p.netType === 'Sell').reduce((sum, p) => sum + p.totalProfit, 0)
                return (
                  <>
                    <div className={`rounded-lg border p-2 hover:shadow-sm transition-shadow ${
                      buyTotal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <p className={`text-[9px] font-semibold uppercase mb-0.5 ${
                        buyTotal >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>Buy Floating Profit</p>
                      <p className={`text-base font-bold ${getProfitColor(buyTotal)}`}>
                        {formatCurrency(buyTotal)}
                      </p>
                    </div>
                    <div className={`rounded-lg border p-2 hover:shadow-sm transition-shadow ${
                      sellTotal >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                    }`}>
                      <p className={`text-[9px] font-semibold uppercase mb-0.5 ${
                        sellTotal >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>Sell Floating Profit</p>
                      <p className={`text-base font-bold ${getProfitColor(sellTotal)}`}>
                        {formatCurrency(sellTotal)}
                      </p>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {activeTab === 'deals' && displayedDeals.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-2 hover:shadow-sm transition-shadow">
                <p className="text-[9px] font-semibold text-blue-600 uppercase mb-0.5">Total Deals</p>
                <p className="text-base font-bold text-blue-900">{displayedDeals.length}</p>
              </div>
              <div className="bg-purple-50 rounded-lg border border-purple-200 p-2 hover:shadow-sm transition-shadow">
                <p className="text-[9px] font-semibold text-purple-600 uppercase mb-0.5">Total Volume</p>
                <p className="text-base font-bold text-purple-900">
                  {displayedDeals.reduce((sum, d) => sum + d.volume, 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-2 hover:shadow-sm transition-shadow">
                <p className="text-[9px] font-semibold text-amber-600 uppercase mb-0.5">Total Commission</p>
                <p className="text-base font-bold text-amber-900">
                  {formatCurrency(displayedDeals.reduce((sum, d) => sum + d.commission, 0))}
                </p>
              </div>
              <div className={`rounded-lg border p-2 hover:shadow-sm transition-shadow ${
                displayedDeals.reduce((sum, d) => sum + d.profit, 0) >= 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <p className={`text-[9px] font-semibold uppercase mb-0.5 ${
                  displayedDeals.reduce((sum, d) => sum + d.profit, 0) >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }`}>Floating Profit</p>
                <p className={`text-base font-bold ${getProfitColor(displayedDeals.reduce((sum, d) => sum + d.profit, 0))}`}>
                  {formatCurrency(displayedDeals.reduce((sum, d) => sum + d.profit, 0))}
                </p>
              </div>
            </div>
          )}


        </div>

      </div>
    </div>
  )
}

export default ClientPositionsModal

