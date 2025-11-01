import { useState, useEffect, useRef } from 'react'
import websocketService from '../services/websocket'
import { brokerAPI } from '../services/api'
import { useData } from '../contexts/DataContext'
import { useGroups } from '../contexts/GroupContext'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import LoginDetailsModal from '../components/LoginDetailsModal'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'

const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'

const LiveDealingPage = () => {
  const { positions: cachedPositions } = useData() // Get positions from DataContext
  const { filterByActiveGroup } = useGroups()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedLogin, setSelectedLogin] = useState(null) // For login details modal
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  
  const [deals, setDeals] = useState([])
  
  const [connectionState, setConnectionState] = useState('disconnected')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasInitialLoad = useRef(false)
  const isInitialMount = useRef(true)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Filter states
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [timeFilter, setTimeFilter] = useState('24h') // '24h' (default), '7d', 'custom'
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [appliedFromDate, setAppliedFromDate] = useState('')
  const [appliedToDate, setAppliedToDate] = useState('')
  const [customDateError, setCustomDateError] = useState('')
  const filterMenuRef = useRef(null)
  // Display mode: 'value' | 'percentage' | 'both'
  const [displayMode, setDisplayMode] = useState('value')
  const [showDisplayMenu, setShowDisplayMenu] = useState(false)
  const displayMenuRef = useRef(null)
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)

  // Persist recent WebSocket deals across refresh
  const WS_CACHE_KEY = 'liveDealsWsCache'
  const loadWsCache = () => {
    try {
      const raw = localStorage.getItem(WS_CACHE_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }
  const saveWsCache = (list) => {
    try {
      localStorage.setItem(WS_CACHE_KEY, JSON.stringify(list))
    } catch {}
  }
  
  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef(null)
  
  // Load visible columns from localStorage or use defaults
  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem('liveDealingPageVisibleColumns')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved columns:', e)
      }
    }
    return {
      deal: true,
      time: true,
      login: true,
      action: true,
      symbol: true,
      volume: true,
      price: true,
      profit: true,
      commission: true,
      storage: true,
      appliedPercentage: true,
      volumePercentage: true,
      profitPercentage: true,
      commissionPercentage: true,
      storagePercentage: true,
      entry: true,
      order: false,
      position: false,
      reason: false
    }
  }
  
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns)

  const allColumns = [
    { key: 'deal', label: 'Deal' },
    { key: 'time', label: 'Time' },
    { key: 'login', label: 'Login' },
    { key: 'action', label: 'Action' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'volume', label: 'Volume' },
    { key: 'price', label: 'Price' },
    { key: 'profit', label: 'Profit' },
    { key: 'commission', label: 'Commission' },
    { key: 'storage', label: 'Storage' },
    { key: 'appliedPercentage', label: 'Applied %' },
    { key: 'volumePercentage', label: 'Volume %' },
    { key: 'profitPercentage', label: 'Profit %' },
    { key: 'commissionPercentage', label: 'Commission %' },
    { key: 'storagePercentage', label: 'Storage %' },
    { key: 'entry', label: 'Entry' },
    { key: 'order', label: 'Order' },
    { key: 'position', label: 'Position' },
    { key: 'reason', label: 'Reason' }
  ]

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('liveDealingPageVisibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // Refetch deals when time filter changes
  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    if (hasInitialLoad.current) {
      console.log('[LiveDealing] ⏰ Time filter changed to:', timeFilter)
      fetchAllDealsOnce()
    }
  }, [timeFilter, appliedFromDate, appliedToDate])
  
  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
      if (displayMenuRef.current && !displayMenuRef.current.contains(event.target)) {
        setShowDisplayMenu(false)
      }
    }
    
    if (showFilterMenu || showColumnSelector || showDisplayMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterMenu, showColumnSelector, showDisplayMenu])
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    
    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      
      console.log('[LiveDealing] 🚀 Initial load started')
      const cachedDeals = loadWsCache()
      console.log('[LiveDealing] 💾 Loaded', cachedDeals.length, 'deals from cache')
      
      // Step 1: Load ALL deals from API ONCE
      fetchAllDealsOnce()
      
      // Step 2: Connect WebSocket for real-time updates
      websocketService.connect()
    }

    // Subscribe to connection state changes
    const unsubscribeConnectionState = websocketService.onConnectionStateChange((state) => {
      setConnectionState(state)
    })

    // Subscribe to ALL DEAL events
    const unsubscribeDealAdded = websocketService.subscribe('DEAL_ADDED', handleDealAddedEvent)
    const unsubscribeDealCreated = websocketService.subscribe('DEAL_CREATED', handleDealAddedEvent)
    const unsubscribeNewDeal = websocketService.subscribe('NEW_DEAL', handleDealAddedEvent)
    const unsubscribeDeal = websocketService.subscribe('deal', handleDealAddedEvent)
    
    const unsubscribeDealUpdated = websocketService.subscribe('DEAL_UPDATED', handleDealUpdatedEvent)
    const unsubscribeDealUpdate = websocketService.subscribe('DEAL_UPDATE', handleDealUpdatedEvent)
    
    const unsubscribeDealDeleted = websocketService.subscribe('DEAL_DELETED', handleDealDeleteEvent)
    const unsubscribeDealDelete = websocketService.subscribe('DEAL_DELETE', handleDealDeleteEvent)
    
    return () => {
      unsubscribeConnectionState()
      unsubscribeDealAdded()
      unsubscribeDealCreated()
      unsubscribeNewDeal()
      unsubscribeDeal()
      unsubscribeDealUpdated()
      unsubscribeDealUpdate()
      unsubscribeDealDeleted()
      unsubscribeDealDelete()
    }
  }, [])

  // Fetch ALL deals from API ONE TIME on initial load
  const fetchAllDealsOnce = async () => {
    try {
      setError('')
      setLoading(true)
      
      // IST is UTC+5:30
      const IST_OFFSET = 5.5 * 60 * 60 * 1000 // 5 hours 30 minutes in milliseconds
      
      let from, to
      
      // Calculate time range based on filter
      if (timeFilter === '24h') {
        // Get current time in IST
        const nowIST = new Date(Date.now() + IST_OFFSET)
        // Add 2 hours to 'to' timestamp to include very recent deals
        const toIST = new Date(nowIST.getTime() + (2 * 60 * 60 * 1000))
        // Subtract 24 hours from current time to get "from" time in IST
        const fromIST = new Date(nowIST.getTime() - (24 * 60 * 60 * 1000))
        
        // Convert both to UTC epoch (seconds)
        from = Math.floor((fromIST.getTime() - IST_OFFSET) / 1000)
        to = Math.floor((toIST.getTime() - IST_OFFSET) / 1000)
      } else if (timeFilter === '7d') {
        // Get current IST time
        const nowIST = new Date(Date.now() + IST_OFFSET)
        // Add 2 hours to 'to' timestamp to include very recent deals
        const toIST = new Date(nowIST.getTime() + (2 * 60 * 60 * 1000))
        // Subtract 7 days from current time to get "from" time in IST
        const fromIST = new Date(nowIST.getTime() - (7 * 24 * 60 * 60 * 1000))
        
        // Convert both to UTC epoch (seconds)
        from = Math.floor((fromIST.getTime() - IST_OFFSET) / 1000)
        to = Math.floor((toIST.getTime() - IST_OFFSET) / 1000)
      } else if (timeFilter === 'custom' && appliedFromDate && appliedToDate) {
        // Parse custom dates as IST
        const fromDateIST = new Date(appliedFromDate)
        const toDateIST = new Date(appliedToDate)
        
        // Convert IST to UTC epoch (seconds)
        from = Math.floor((fromDateIST.getTime() - IST_OFFSET) / 1000)
        to = Math.floor((toDateIST.getTime() - IST_OFFSET) / 1000)
      } else {
        // Default to 24h if custom dates not set
        const nowIST = new Date(Date.now() + IST_OFFSET)
        // Add 2 hours to 'to' timestamp to include very recent deals
        const toIST = new Date(nowIST.getTime() + (2 * 60 * 60 * 1000))
        const fromIST = new Date(nowIST.getTime() - (24 * 60 * 60 * 1000))
        
        from = Math.floor((fromIST.getTime() - IST_OFFSET) / 1000)
        to = Math.floor((toIST.getTime() - IST_OFFSET) / 1000)
      }
      
      const response = await brokerAPI.getAllDeals(from, to, 10000)
      
      const dealsData = response.data?.deals || response.deals || []
      
      // Transform deals
      const transformedDeals = dealsData.map(deal => ({
        id: deal.deal || deal.id,
        time: deal.time || deal.timestamp,
        dealer: deal.dealer || '-',
        login: deal.login,
        request: formatRequestFromDeal(deal),
        answer: 'Done',
        rawData: deal
      }))
      
      // Sort newest first
      transformedDeals.sort((a, b) => b.time - a.time)
      
      // Merge with any recent WebSocket deals cached locally (dedupe by id)
      const wsCached = loadWsCache()
      
      const apiDealIds = new Set(transformedDeals.map(d => d.id))
      
      // Filter cached deals based on the current time range
      const relevantCachedDeals = wsCached.filter(d => {
        if (!d || !d.id) return false
        
        // Skip if already in API response
        if (apiDealIds.has(d.id)) {
          return false
        }
        
        const dealTime = d.time || d.rawData?.time || 0
        
        // Filter by the same time range as the API call
        const isInTimeRange = dealTime >= from && dealTime <= to
        
        return isInTimeRange
      })
      
      console.log('[LiveDealing] 📊 API returned', transformedDeals.length, 'deals')
      console.log('[LiveDealing] 💾 Cache had', wsCached.length, 'deals')
      console.log('[LiveDealing] ✅ Keeping', relevantCachedDeals.length, 'cached deals not in API')
      
      const merged = [
        // Put cached WS deals first (newest on top), but only those not in API list
        ...relevantCachedDeals,
        ...transformedDeals
      ]

      // Save back the relevant cached deals (those still missing from API)
      saveWsCache(relevantCachedDeals.slice(0, 200))

      setDeals(merged)
      
      setLoading(false)
    } catch (error) {
      console.error('[LiveDealing] ❌ Error loading deals:', error)
      setError('Failed to load deals')
      setLoading(false)
    }
  }

  // Handle DEAL_ADDED events
  const handleDealAddedEvent = (data) => {
    setLoading(false)
    
    try {
      const dealData = data.data || data
      const login = data.login || dealData.login
      
      // Use the actual deal timestamp from server, fallback to current time if not available
      const timestamp = dealData.time || dealData.timestamp || Math.floor(Date.now() / 1000)
      
      const dealEntry = {
        id: dealData.deal || Date.now() + Math.random(),
        time: timestamp,
        dealer: dealData.dealer || '-',
        login: login,
        request: formatRequestFromDeal(dealData, login),
        answer: 'Done',
        rawData: dealData,
        isWebSocketDeal: true // Mark as WebSocket deal
      }

      setDeals(prevDeals => {
        // Check if deal already exists
        if (prevDeals.some(d => d.id === dealEntry.id)) {
          return prevDeals
        }
        
        // Add new deal at the beginning (newest first)
        const newDeals = [dealEntry, ...prevDeals]
        
        // Keep max 1000 deals (increased from 500)
        const trimmed = newDeals.slice(0, 1000)
        // Persist a lightweight cache of WS-added deals to survive page refresh
        try {
          const cache = loadWsCache()
          const existing = new Set(cache.map(d => d.id))
          const updatedCache = [dealEntry, ...cache.filter(d => !existing.has(d.id))].slice(0, 200)
          saveWsCache(updatedCache)
        } catch {}
        return trimmed
      })
    } catch (error) {
      console.error('[LiveDealing] Error processing DEAL_ADDED event:', error)
    }
  }

  // Handle DEAL_UPDATED events
  const handleDealUpdatedEvent = (data) => {
    try {
      const dealData = data.data || data
      const dealId = dealData.deal || dealData.id
      
      if (!dealId) {
        return
      }

      setDeals(prevDeals => {
        const index = prevDeals.findIndex(d => d.id === dealId)
        
        if (index === -1) {
          return prevDeals
        }

        const updatedDeals = [...prevDeals]
        const login = data.login || dealData.login || updatedDeals[index].login
        
        updatedDeals[index] = {
          ...updatedDeals[index],
          time: dealData.time || updatedDeals[index].time,
          dealer: dealData.dealer || updatedDeals[index].dealer,
          login: login,
          request: formatRequestFromDeal(dealData, login),
          answer: dealData.answer || updatedDeals[index].answer,
          rawData: data
        }

        return updatedDeals
      })
    } catch (error) {
      console.error('[LiveDealing] Error processing DEAL_UPDATED event:', error)
    }
  }

  // Handle DEAL_DELETED events
  const handleDealDeleteEvent = (data) => {
    try {
      const dealId = data.data?.deal || data.deal || data.data?.id || data.id
      
      if (!dealId) {
        return
      }

      setDeals(prevDeals => {
        const filtered = prevDeals.filter(d => d.id !== dealId)
        return filtered
      })
    } catch (error) {
      console.error('[LiveDealing] Error processing DEAL_DELETED event:', error)
    }
  }

  const formatRequestFromDeal = (dealData, login = null) => {
    const action = getActionLabel(dealData.action)
    const volume = dealData.volume ? (dealData.volume / 10000).toFixed(2) : ''
    const symbol = dealData.symbol || ''
    const price = dealData.price || ''
    const dealLogin = login || dealData.login || ''
    const comment = dealData.comment || ''

    // For BALANCE/CREDIT operations, show comment and profit
    if (action === 'Balance' || action === 'Credit') {
      const profit = dealData.profit || 0
      return `for '${dealLogin}' ${action} ${profit > 0 ? '+' : ''}${profit.toFixed(2)} ${comment ? `(${comment})` : ''}`
    }

    // For trading operations
    if (action && volume && symbol && price) {
      return `for '${dealLogin}' ${action} ${volume} ${symbol} at ${parseFloat(price).toFixed(5)}`
    }
    
    // Fallback
    return `${action || 'Operation'} for '${dealLogin}'${comment ? ` - ${comment}` : ''}`
  }

  const getActionLabel = (action) => {
    const actionMap = {
      'BUY': 'buy',
      'SELL': 'sell',
      'BALANCE': 'Balance',
      'CREDIT': 'Credit',
      'CHARGE': 'Charge',
      'CORRECTION': 'Correction',
      'BONUS': 'Bonus',
      'COMMISSION': 'Commission',
      'DAILY': 'Daily',
      'MONTHLY': 'Monthly',
      'AGENT_DAILY': 'Agent Daily',
      'AGENT_MONTHLY': 'Agent Monthly',
      'INTERESTRATE': 'Interest',
      'CANCEL_BUY': 'Cancel Buy',
      'CANCEL_SELL': 'Cancel Sell',
      'SO_CLOSE': 'Stop Out',
      'TP_CLOSE': 'TP Close',
      'SL_CLOSE': 'SL Close'
    }
    return actionMap[action] || action || 'Unknown'
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const handleRefresh = () => {
    console.log('[LiveDealing] 🔄 Refresh: Reloading all deals from API')
    fetchAllDealsOnce()
  }

  const handleClear = () => {
    console.log('[LiveDealing] 🗑️ Clearing all deals')
    setDeals([])
  }

  // Sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const handleApplyCustomDates = () => {
    // Clear any previous error
    setCustomDateError('')
    
    // Validate that both dates are filled
    if (!customFromDate || !customToDate) {
      setCustomDateError('Please select both From Date and To Date')
      return
    }
    
    // Validate that From date is not after To date
    const fromDate = new Date(customFromDate)
    const toDate = new Date(customToDate)
    
    if (fromDate > toDate) {
      setCustomDateError('From Date cannot be after To Date')
      return
    }
    
    // Apply the dates
    setAppliedFromDate(customFromDate)
    setAppliedToDate(customToDate)
    setCustomDateError('')
  }

  const sortDeals = (dealsToSort) => {
    if (!sortColumn) return dealsToSort

    return [...dealsToSort].sort((a, b) => {
      let aVal = a[sortColumn]
      let bVal = b[sortColumn]

      // Handle time sorting
      if (sortColumn === 'time') {
        aVal = parseInt(aVal) || 0
        bVal = parseInt(bVal) || 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      // Handle string values
      const aStr = String(aVal || '').toLowerCase()
      const bStr = String(bVal || '').toLowerCase()
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })
  }
  
  // Search and filter deals
  const searchDeals = (dealsToSearch) => {
    if (!searchQuery.trim()) {
      return dealsToSearch
    }
    
    const query = searchQuery.toLowerCase().trim()
    return dealsToSearch.filter(deal => {
      const login = String(deal.login || '').toLowerCase()
      const symbol = String(deal.rawData?.symbol || '').toLowerCase()
      const dealId = String(deal.id || '').toLowerCase()
      
      return login.includes(query) || symbol.includes(query) || dealId.includes(query)
    })
  }
  
  const handleSuggestionClick = (suggestion) => {
    // Extract the value after the colon
    const value = suggestion.split(': ')[1]
    setSearchQuery(value)
    setShowSuggestions(false)
  }
  
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false)
    }
  }

  // Module filter: Deal (buy/sell) vs Money transactions (others) vs Both
  const [moduleFilter, setModuleFilter] = useState('both') // 'deal' | 'money' | 'both'
  const isTradeAction = (label) => label === 'buy' || label === 'sell'
  const filterByModule = (list) => {
    if (moduleFilter === 'both') return list
    return list.filter((d) => {
      const label = getActionLabel(d?.rawData?.action)
      if (moduleFilter === 'deal' && isTradeAction(label)) return true
      if (moduleFilter === 'money' && !isTradeAction(label)) return true
      return false
    })
  }

  // Pagination
  const moduleFiltered = filterByModule(deals)
  const searchedDeals = searchDeals(moduleFiltered)
  
  // Apply group filter if active
  const groupFilteredDeals = filterByActiveGroup(searchedDeals, 'login', 'livedealing')
  
  const sortedDeals = sortDeals(groupFilteredDeals)
  
  // Get search suggestions from current deals
  const getSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      return []
    }
    
    const query = searchQuery.toLowerCase().trim()
    const suggestions = new Set()
    
    // Get unique values from current deals
    sortedDeals.forEach(deal => {
      const login = String(deal.login || '')
      const symbol = String(deal.rawData?.symbol || '')
      const dealId = String(deal.id || '')
      
      if (login.toLowerCase().includes(query)) {
        suggestions.add(`Login: ${login}`)
      }
      if (symbol.toLowerCase().includes(query) && symbol) {
        suggestions.add(`Symbol: ${symbol}`)
      }
      if (dealId.toLowerCase().includes(query)) {
        suggestions.add(`Deal: ${dealId}`)
      }
    })
    
    return Array.from(suggestions).slice(0, 10)
  }
  
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedDeals.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedDeals.length : startIndex + itemsPerPage
  const displayedDeals = sortedDeals.slice(startIndex, endIndex)

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  // Reset to first page when display mode changes
  useEffect(() => {
    setCurrentPage(1)
  }, [displayMode])

  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let endPage = Math.min(totalPages, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  const getAvailableOptions = () => {
    const options = ['All']
    const maxOption = Math.ceil(sortedDeals.length / 50) * 50
    for (let i = 50; i <= maxOption; i += 50) {
      options.push(i)
    }
    return options
  }

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <span className="text-gray-400 ml-1">⇅</span>
    }
    return sortDirection === 'asc' 
      ? <span className="text-blue-600 ml-1">↑</span>
      : <span className="text-blue-600 ml-1">↓</span>
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 flex flex-col overflow-hidden">
        <div className="max-w-full mx-auto w-full flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-white shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Live Dealing</h1>
                <p className="text-xs text-gray-500 mt-0.5">Real-time trading activity monitor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Groups Dropdown */}
              <GroupSelector 
                moduleName="livedealing" 
                onCreateClick={() => {
                  setEditingGroup(null)
                  setShowGroupModal(true)
                }}
                onEditClick={(group) => {
                  setEditingGroup(group)
                  setShowGroupModal(true)
                }}
              />
              
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {timeFilter === '24h' ? '24h' : timeFilter === '7d' ? '7d' : 'Custom'}
                  </span>
                </button>
                {showFilterMenu && (
                  <div
                    ref={filterMenuRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-72"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Time Period</p>
                    </div>
                    
                    {/* Time Filter Options */}
                    <div className="py-2">
                      <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="timeFilter"
                          checked={timeFilter === '24h'}
                          onChange={() => setTimeFilter('24h')}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">Last 24 Hours</span>
                      </label>
                      
                      <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="timeFilter"
                          checked={timeFilter === '7d'}
                          onChange={() => setTimeFilter('7d')}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">Last 7 Days</span>
                      </label>
                      
                      <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="timeFilter"
                          checked={timeFilter === 'custom'}
                          onChange={() => setTimeFilter('custom')}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">Custom Range</span>
                      </label>
                    </div>
                    
                    {/* Custom Date Range */}
                    {timeFilter === 'custom' && (
                      <div className="px-3 py-2 border-t border-gray-100 space-y-2">
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">From Date</label>
                          <input
                            type="date"
                            value={customFromDate}
                            onChange={(e) => setCustomFromDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">To Date</label>
                          <input
                            type="date"
                            value={customToDate}
                            onChange={(e) => setCustomToDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        {customDateError && (
                          <p className="text-xs text-red-600 mt-1">{customDateError}</p>
                        )}
                        <button
                          onClick={handleApplyCustomDates}
                          className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Columns Button */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Columns
                </button>
                {showColumnSelector && (
                  <div
                    ref={columnSelectorRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-56"
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Show/Hide Columns</p>
                    </div>
                    {allColumns.map(col => (
                      <label
                        key={col.key}
                        className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.key]}
                          onChange={() => toggleColumn(col.key)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              
              <WebSocketIndicator />
            </div>
          </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">
                {timeFilter === '24h' ? 'Deals (24h)' : timeFilter === '7d' ? 'Deals (7d)' : 'Filtered Deals'}
              </p>
              <p className="text-lg font-semibold text-gray-900">{searchedDeals.length}</p>
              {searchQuery && (
                <p className="text-xs text-gray-400 mt-1">of {deals.length} total</p>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Connection Status</p>
              <p className={`text-lg font-semibold ${
                connectionState === 'connected' ? 'text-green-600' :
                connectionState === 'connecting' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {connectionState === 'connected' ? 'Live' :
                 connectionState === 'connecting' ? 'Connecting...' :
                 'Disconnected'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Unique Logins</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Set(searchedDeals.map(d => d.login)).size}
              </p>
              {searchQuery && (
                <p className="text-xs text-gray-400 mt-1">of {new Set(deals.map(d => d.login)).size} total</p>
              )}
            </div>
          </div>

          {/* Pagination - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-lg shadow-sm border border-blue-100 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value === 'All' ? 'All' : parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableOptions().map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">entries</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Page Navigation */}
              {itemsPerPage !== 'All' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded-md transition-colors ${
                      currentPage === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-sm text-gray-700 font-medium px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded-md transition-colors ${
                      currentPage === totalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Module Type Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setModuleFilter('deal')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    moduleFilter === 'deal'
                      ? 'bg-white text-blue-600 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Deals
                </button>
                <button
                  onClick={() => setModuleFilter('money')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    moduleFilter === 'money'
                      ? 'bg-white text-blue-600 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Money
                </button>
                <button
                  onClick={() => setModuleFilter('both')}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    moduleFilter === 'both'
                      ? 'bg-white text-blue-600 shadow-sm font-medium'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Both
                </button>
              </div>
              
              {/* Percentage View Button */}
              <div className="relative">
                <button
                  onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Percentage View
                </button>
                {showDisplayMenu && (
                  <div
                    ref={displayMenuRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-56"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Display Mode</p>
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 hover:bg-blue-50 p-2 rounded cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="value"
                          checked={displayMode === 'value'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span>Without Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 hover:bg-blue-50 p-2 rounded cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="percentage"
                          checked={displayMode === 'percentage'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span>Show My Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 hover:bg-blue-50 p-2 rounded cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="both"
                          checked={displayMode === 'both'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span>Both</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Search Bar */}
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                      setCurrentPage(1)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search login, symbol, deal..."
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
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
                        setShowSuggestions(false)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Suggestions Dropdown */}
                {showSuggestions && getSuggestions().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto">
                    {getSuggestions().map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} - {Math.min(endIndex, sortedDeals.length)} of {sortedDeals.length}
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingSpinner />
          ) : displayedDeals.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">⚡</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No deals yet</h3>
              <p className="text-sm text-gray-500 mb-4">Waiting for live trades...</p>
              <div className="text-xs text-gray-400">
                <p className="mb-1">
                  <span className="inline-flex items-center gap-1">
                    <span className={connectionState === 'connected' ? 'text-green-600' : 'text-red-600'}>●</span>
                    Real-time via WebSocket (DEAL_ADDED events)
                  </span>
                </p>
                <p>
                  <span className="inline-flex items-center gap-1">
                    {connectionState === 'connected' ? '✅ Connected & Live' : '❌ Disconnected'}
                  </span>
                </p>
                <p className="mt-2">
                  ✅ Ready! New deals will appear automatically when trades are executed.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1">
              <div className="overflow-y-auto flex-1">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {visibleColumns.time && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Time
                      </th>
                    )}
                    {visibleColumns.deal && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Deal
                      </th>
                    )}
                    {visibleColumns.login && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Login
                      </th>
                    )}
                    {visibleColumns.action && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    )}
                    {visibleColumns.symbol && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Symbol
                      </th>
                    )}
                    {visibleColumns.volume && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        {displayMode === 'percentage' ? 'Volume %' : 'Volume'}
                      </th>
                    )}
                    {visibleColumns.volumePercentage && (displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Volume %
                      </th>
                    )}
                    {visibleColumns.price && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Price
                      </th>
                    )}
                    {visibleColumns.profit && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        {displayMode === 'percentage' ? 'Profit %' : 'Profit'}
                      </th>
                    )}
                    {visibleColumns.profitPercentage && (displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Profit %
                      </th>
                    )}
                    {visibleColumns.commission && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        {displayMode === 'percentage' ? 'Commission %' : 'Commission'}
                      </th>
                    )}
                    {visibleColumns.commissionPercentage && (displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Commission %
                      </th>
                    )}
                    {visibleColumns.storage && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        {displayMode === 'percentage' ? 'Storage %' : 'Storage'}
                      </th>
                    )}
                    {visibleColumns.storagePercentage && (displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Storage %
                      </th>
                    )}
                    {visibleColumns.appliedPercentage && (displayMode === 'percentage' || displayMode === 'both') && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Applied %
                      </th>
                    )}
                    {visibleColumns.entry && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Entry
                      </th>
                    )}
                    {visibleColumns.order && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Order
                      </th>
                    )}
                    {visibleColumns.position && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Position
                      </th>
                    )}
                    {visibleColumns.reason && (
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-700 uppercase tracking-wider">
                        Reason
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedDeals.map((deal, index) => (
                    <tr key={deal.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {visibleColumns.time && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {formatTime(deal.time)}
                        </td>
                      )}
                      {visibleColumns.deal && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-gray-900">
                          {deal.rawData?.deal || deal.id}
                        </td>
                      )}
                      {visibleColumns.login && (
                        <td 
                          className="px-2 py-1.5 whitespace-nowrap text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLogin(deal.login)
                          }}
                          title="Click to view login details"
                        >
                          {deal.login}
                        </td>
                      )}
                      {visibleColumns.action && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            deal.rawData?.action === 'BUY' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {deal.rawData?.action || '-'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.symbol && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-900 font-medium">
                          {deal.rawData?.symbol || '-'}
                        </td>
                      )}
                      {visibleColumns.volume && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {displayMode === 'percentage'
                            ? (deal.rawData?.volume_percentage != null
                                ? Number(deal.rawData.volume_percentage).toFixed(2)
                                : '0.00')
                            : (deal.rawData?.volume?.toFixed(2) || '-')}
                        </td>
                      )}
                      {visibleColumns.volumePercentage && (displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.volume_percentage != null ? Number(deal.rawData.volume_percentage).toFixed(2) : '0.00'}
                        </td>
                      )}
                      {visibleColumns.price && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.price?.toFixed(5) || '-'}
                        </td>
                      )}
                      {visibleColumns.profit && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                        <td className={`px-2 py-1.5 whitespace-nowrap text-xs font-medium ${
                          (deal.rawData?.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {displayMode === 'percentage'
                            ? (deal.rawData?.profit_percentage != null
                                ? Number(deal.rawData.profit_percentage).toFixed(2)
                                : '0.00')
                            : (deal.rawData?.profit?.toFixed(2) || '0.00')}
                        </td>
                      )}
                      {visibleColumns.profitPercentage && (displayMode === 'both') && (
                        <td className={`px-2 py-1.5 whitespace-nowrap text-xs ${
                          (deal.rawData?.profit_percentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {deal.rawData?.profit_percentage != null ? Number(deal.rawData.profit_percentage).toFixed(2) : '0.00'}
                        </td>
                      )}
                      {visibleColumns.commission && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {displayMode === 'percentage'
                            ? (deal.rawData?.commission_percentage != null
                                ? Number(deal.rawData.commission_percentage).toFixed(2)
                                : '0.00')
                            : (deal.rawData?.commission?.toFixed(2) || '0.00')}
                        </td>
                      )}
                      {visibleColumns.commissionPercentage && (displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.commission_percentage != null ? Number(deal.rawData.commission_percentage).toFixed(2) : '0.00'}
                        </td>
                      )}
                      {visibleColumns.storage && (displayMode === 'value' || displayMode === 'percentage' || displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {displayMode === 'percentage'
                            ? (deal.rawData?.storage_percentage != null
                                ? Number(deal.rawData.storage_percentage).toFixed(2)
                                : '0.00')
                            : (deal.rawData?.storage?.toFixed(2) || '0.00')}
                        </td>
                      )}
                      {visibleColumns.storagePercentage && (displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.storage_percentage != null ? Number(deal.rawData.storage_percentage).toFixed(2) : '0.00'}
                        </td>
                      )}
                      {visibleColumns.appliedPercentage && (displayMode === 'percentage' || displayMode === 'both') && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          <span className={deal.rawData?.applied_percentage_is_custom ? 'text-blue-600 font-semibold' : ''}>
                            {deal.rawData?.applied_percentage != null ? Number(deal.rawData.applied_percentage).toFixed(1) : '0.0'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.entry && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.entry || 0}
                        </td>
                      )}
                      {visibleColumns.order && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.order || '-'}
                        </td>
                      )}
                      {visibleColumns.position && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-700">
                          {deal.rawData?.position || '-'}
                        </td>
                      )}
                      {visibleColumns.reason && (
                        <td className="px-2 py-1.5 whitespace-nowrap text-xs text-gray-600">
                          {deal.rawData?.reason || '-'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Pagination - Bottom */}
        </div>
      </main>
      
      {/* Create Group Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false)
          setEditingGroup(null)
        }}
        availableItems={deals}
        loginField="login"
        displayField="symbol"
        secondaryField="id"
        editGroup={editingGroup}
      />

      {/* Login Details Modal */}
      {selectedLogin && (
        <LoginDetailsModal
          login={selectedLogin}
          onClose={() => setSelectedLogin(null)}
          allPositionsCache={cachedPositions}
        />
      )}
    </div>
  )
}

export default LiveDealingPage
