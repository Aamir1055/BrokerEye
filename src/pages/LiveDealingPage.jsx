import { useState, useEffect, useRef } from 'react'
import websocketService from '../services/websocket'
import { brokerAPI } from '../services/api'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'

const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'

const LiveDealingPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  // Load deals from localStorage on mount
  const [deals, setDeals] = useState(() => {
    try {
      const cached = localStorage.getItem('live_deals_cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        console.log('[LiveDealing] 🔄 Restored', parsed.length, 'deals from localStorage')
        return parsed
      }
    } catch (error) {
      console.error('[LiveDealing] Error loading from localStorage:', error)
    }
    return []
  })
  
  const [connectionState, setConnectionState] = useState('disconnected')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const hasInitialLoad = useRef(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Filter states
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [timeFilter, setTimeFilter] = useState('all') // 'all', '24h', '7d', 'custom'
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const filterMenuRef = useRef(null)

  // Save deals to localStorage whenever they change
  useEffect(() => {
    if (deals.length > 0) {
      try {
        localStorage.setItem('live_deals_cache', JSON.stringify(deals))
        console.log('[LiveDealing] 💾 Saved', deals.length, 'deals to localStorage')
      } catch (error) {
        console.error('[LiveDealing] Error saving to localStorage:', error)
      }
    }
  }, [deals])
  
  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
    }
    
    if (showFilterMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterMenu])

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      
      // Step 1: Load ALL deals from API ONCE
      console.log('[LiveDealing] 📥 Step 1: Loading all deals from API (one time only)...')
      fetchAllDealsOnce()
      
      // Step 2: Connect WebSocket for real-time updates
      console.log('[LiveDealing] 🔌 Step 2: Connecting WebSocket for real-time updates...')
      websocketService.connect()
    }

    // Subscribe to connection state changes
    const unsubscribeConnectionState = websocketService.onConnectionStateChange((state) => {
      console.log('[LiveDealing] Connection state changed:', state)
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
      console.log('[LiveDealing] 📥 Fetching ALL deals from API...')
      
      // Get ALL deals: from=0 to now
      const now = Math.floor(Date.now() / 1000)
      const from = 0 // From beginning
      
      const response = await brokerAPI.getAllDeals(from, now, 2000)
      
      const dealsData = response.data?.deals || response.deals || []
      console.log('[LiveDealing] ✅ API returned', dealsData.length, 'deals')
      
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
      
      // MERGE with existing deals (from localStorage or WebSocket)
      setDeals(prevDeals => {
        if (prevDeals.length === 0) {
          // No existing deals, just use API data
          console.log('[LiveDealing] 📊 First load:', transformedDeals.length, 'deals from API')
          return transformedDeals
        }
        
        // Merge: Keep existing deals + add new ones from API
        const existingIds = new Set(prevDeals.map(d => d.id))
        const newDealsFromAPI = transformedDeals.filter(d => !existingIds.has(d.id))
        
        const merged = [...prevDeals, ...newDealsFromAPI]
        merged.sort((a, b) => b.time - a.time)
        
        // Remove duplicates
        const uniqueDeals = Array.from(
          new Map(merged.map(d => [d.id, d])).values()
        )
        
        console.log('[LiveDealing] 📊 Merged:', {
          fromCache: prevDeals.length,
          fromAPI: newDealsFromAPI.length,
          total: uniqueDeals.length
        })
        
        return uniqueDeals
      })
      
      setLoading(false)
    } catch (error) {
      console.error('[LiveDealing] ❌ Error loading deals:', error)
      setError('Failed to load deals')
      setLoading(false)
    }
  }

  // Handle DEAL_ADDED events
  const handleDealAddedEvent = (data) => {
    console.log('[LiveDealing] ➕ DEAL_ADDED event:', data)
    setLoading(false)
    
    try {
      const dealData = data.data || data
      const login = data.login || dealData.login
      
      // Use data.timestamp (when the event was sent) instead of dealData.time (deal execution time on MT5)
      // This ensures WebSocket deals appear in real-time filters
      const timestamp = data.timestamp || dealData.time || Math.floor(Date.now() / 1000)
      
      // Log timestamp details
      const now = Math.floor(Date.now() / 1000)
      const ageInHours = ((now - timestamp) / 3600).toFixed(2)
      console.log('[LiveDealing] 🕒 Using timestamp:', timestamp, '| data.timestamp:', data.timestamp, '| dealData.time:', dealData.time, '| Age:', ageInHours, 'hours')
      
      const dealEntry = {
        id: dealData.deal || Date.now() + Math.random(),
        time: timestamp,
        dealer: dealData.dealer || '-',
        login: login,
        request: formatRequestFromDeal(dealData, login),
        answer: 'Done',
        rawData: data
      }

      console.log('[LiveDealing] ➕ Adding new deal:', dealEntry.id, 'Login:', login)

      setDeals(prevDeals => {
        if (prevDeals.some(d => d.id === dealEntry.id)) {
          console.log('[LiveDealing] ⚠️ Deal already exists, skipping')
          return prevDeals
        }
        
        const newDeals = [dealEntry, ...prevDeals]
        console.log(`[LiveDealing] ✅ Total deals: ${newDeals.length}`)
        
        // Keep max 500 deals
        return newDeals.slice(0, 500)
      })
    } catch (error) {
      console.error('[LiveDealing] Error processing DEAL_ADDED event:', error)
    }
  }

  // Handle DEAL_UPDATED events
  const handleDealUpdatedEvent = (data) => {
    console.log('[LiveDealing] 🔄 DEAL_UPDATED event:', data)
    
    try {
      const dealData = data.data || data
      const dealId = dealData.deal || dealData.id
      
      if (!dealId) {
        console.warn('[LiveDealing] No deal ID in update event')
        return
      }

      setDeals(prevDeals => {
        const index = prevDeals.findIndex(d => d.id === dealId)
        
        if (index === -1) {
          console.log('[LiveDealing] ⚠️ Deal not found for update:', dealId)
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

        console.log('[LiveDealing] ✅ Updated deal:', dealId)
        return updatedDeals
      })
    } catch (error) {
      console.error('[LiveDealing] Error processing DEAL_UPDATED event:', error)
    }
  }

  // Handle DEAL_DELETED events
  const handleDealDeleteEvent = (data) => {
    console.log('[LiveDealing] 🗑️ DEAL_DELETED event:', data)
    
    try {
      const dealId = data.data?.deal || data.deal || data.data?.id || data.id
      
      if (!dealId) {
        console.warn('[LiveDealing] No deal ID found in delete event')
        return
      }

      setDeals(prevDeals => {
        const filtered = prevDeals.filter(d => d.id !== dealId)
        if (filtered.length < prevDeals.length) {
          console.log(`[LiveDealing] ✅ Deleted deal ${dealId}. Remaining: ${filtered.length}`)
        }
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
  
  // Filter deals by time
  const filterDealsByTime = (dealsToFilter) => {
    if (timeFilter === 'all') {
      return dealsToFilter
    }
    
    const now = Math.floor(Date.now() / 1000)
    let fromTime = 0
    let toTime = now
    
    if (timeFilter === '24h') {
      fromTime = now - (24 * 60 * 60) // 24 hours ago
    } else if (timeFilter === '7d') {
      fromTime = now - (7 * 24 * 60 * 60) // 7 days ago
    } else if (timeFilter === 'custom') {
      if (customFromDate) {
        fromTime = Math.floor(new Date(customFromDate).getTime() / 1000)
      }
      if (customToDate) {
        toTime = Math.floor(new Date(customToDate).getTime() / 1000) + (24 * 60 * 60) - 1 // End of day
      }
    }
    
    return dealsToFilter.filter(deal => {
      const dealTime = parseInt(deal.time) || 0
      return dealTime >= fromTime && dealTime <= toTime
    })
  }

  // Pagination
  const filteredDeals = filterDealsByTime(deals)
  const sortedDeals = sortDeals(filteredDeals)
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
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-x-hidden">
        <div className="max-w-full mx-auto">
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
            <WebSocketIndicator />
          </div>            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">
                {timeFilter !== 'all' ? 'Filtered Deals' : 'Total Deals'}
              </p>
              <p className="text-lg font-semibold text-gray-900">{filteredDeals.length}</p>
              {timeFilter !== 'all' && (
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
                {new Set(filteredDeals.map(d => d.login)).size}
              </p>
              {timeFilter !== 'all' && (
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
                  {timeFilter !== 'all' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">1</span>
                  )}
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
                          checked={timeFilter === 'all'}
                          onChange={() => setTimeFilter('all')}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">All Time</span>
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
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 mb-1 block">To Date</label>
                          <input
                            type="date"
                            value={customToDate}
                            onChange={(e) => setCustomToDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
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
          ) : deals.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">⚡</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No deals found</h3>
              <p className="text-sm text-gray-500 mb-4">Trading activity will appear here</p>
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    <th
                      onClick={() => handleSort('time')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none"
                    >
                      Time {getSortIcon('time')}
                    </th>
                    <th
                      onClick={() => handleSort('dealer')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none"
                    >
                      Dealer {getSortIcon('dealer')}
                    </th>
                    <th
                      onClick={() => handleSort('login')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none"
                    >
                      Login {getSortIcon('login')}
                    </th>
                    <th
                      onClick={() => handleSort('request')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none"
                    >
                      Request {getSortIcon('request')}
                    </th>
                    <th
                      onClick={() => handleSort('answer')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none"
                    >
                      Answer {getSortIcon('answer')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedDeals.map((deal, index) => (
                    <tr key={deal.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                        {formatTime(deal.time)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                        {deal.dealer}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                        {deal.login}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {deal.request}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          {deal.answer}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination - Bottom */}
          {deals.length > 0 && itemsPerPage !== 'All' && (
            <div className="mt-3 flex items-center justify-between bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 text-sm rounded-md ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default LiveDealingPage
