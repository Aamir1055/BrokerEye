import { useState, useEffect, useRef } from 'react'
import { brokerAPI } from '../services/api'
import websocketService from '../services/websocket'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import WebSocketIndicator from '../components/WebSocketIndicator'

const ClientsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const columnSelectorRef = useRef(null)
  const filterMenuRef = useRef(null)
  
  // Filter states
  const [filterByPositions, setFilterByPositions] = useState(false)
  const [filterByDeals, setFilterByDeals] = useState(false)
  const [positions, setPositions] = useState([])
  const [deals, setDeals] = useState([])
  
  // Cache for all positions
  const [allPositionsCache, setAllPositionsCache] = useState(null)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  
  // Column widths state (percentage based)
  const [columnWidths, setColumnWidths] = useState({})
  const [resizing, setResizing] = useState(null)
  const tableRef = useRef(null)
  const hasInitialLoad = useRef(false)
  const fallbackPollingInterval = useRef(null)
  const [wsConnectionState, setWsConnectionState] = useState('disconnected')

  // Default visible columns (matching the screenshot)
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    name: true,
    group: true,
    country: true,
    clientID: true,
    balance: true,
    equity: true,
    profit: true,
    // Hidden by default
    lastName: false,
    email: false,
    phone: false,
    credit: false,
    margin: false,
    marginFree: false,
    marginLevel: false,
    leverage: false,
    floating: false,
    currency: false,
    registration: false,
    lastAccess: false,
    rights: false
  })

  const allColumns = [
    { key: 'login', label: 'Login' },
    { key: 'name', label: 'Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'group', label: 'Group' },
    { key: 'country', label: 'Country' },
    { key: 'clientID', label: 'Client ID' },
    { key: 'balance', label: 'Balance' },
    { key: 'credit', label: 'Credit' },
    { key: 'equity', label: 'Equity' },
    { key: 'margin', label: 'Margin' },
    { key: 'marginFree', label: 'Margin Free' },
    { key: 'marginLevel', label: 'Margin Level' },
    { key: 'leverage', label: 'Leverage' },
    { key: 'profit', label: 'Floating Profit' },
    { key: 'floating', label: 'Floating' },
    { key: 'currency', label: 'Currency' },
    { key: 'registration', label: 'Registration' },
    { key: 'lastAccess', label: 'Last Access' },
    { key: 'rights', label: 'Rights' }
  ]

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      fetchClients()
      
      // Connect to WebSocket
      websocketService.connect()
    }

    // Subscribe to WebSocket messages for real-time updates
    const unsubscribeClients = websocketService.subscribe('clients', (data) => {
      console.log('[WebSocket] Received clients update:', data)
      
      try {
        // Validate data structure
        if (!data || typeof data !== 'object') {
          console.warn('[WebSocket] Invalid message format - not an object')
          return
        }
        
        // Check for clients data in the message
        const newClients = data.data?.clients || data.clients
        
        if (!newClients) {
          console.warn('[WebSocket] No clients data in message:', data)
          return
        }
        
        if (!Array.isArray(newClients)) {
          console.warn('[WebSocket] Clients data is not an array:', newClients)
          return
        }
        
        console.log('[WebSocket] Updating clients state with', newClients.length, 'clients')
        
        // Smart merge: Update existing clients or replace all
        setClients(prevClients => {
          // If it's a full update or first load, replace all
          if (data.type === 'full' || prevClients.length === 0) {
            return newClients
          }
          
          // For incremental updates, merge by login ID
          if (data.type === 'update' && newClients.length < 100) {
            const clientMap = new Map(prevClients.map(c => [c.login, c]))
            
            // Update or add new clients
            newClients.forEach(client => {
              if (client.login) {
                clientMap.set(client.login, client)
              }
            })
            
            return Array.from(clientMap.values())
          }
          
          // Default: replace all
          return newClients
        })
      } catch (error) {
        console.error('[WebSocket] Error processing clients update:', error)
      }
    })

    const unsubscribePositions = websocketService.subscribe('positions', (data) => {
      console.log('[WebSocket] Received positions update:', data)
      
      try {
        const newPositions = data.data?.positions || data.positions
        
        if (newPositions && Array.isArray(newPositions)) {
          console.log('[WebSocket] Updating positions with', newPositions.length, 'positions')
          setPositions(newPositions)
          setAllPositionsCache(newPositions)
        } else {
          console.warn('[WebSocket] Invalid positions data:', data)
        }
      } catch (error) {
        console.error('[WebSocket] Error processing positions update:', error)
      }
    })
    
    // Subscribe to individual account updates (ACCOUNT_UPDATED event)
    const unsubscribeAccountUpdate = websocketService.subscribe('ACCOUNT_UPDATED', (message) => {
      console.log('[WebSocket] Received ACCOUNT_UPDATED event:', message)
      
      try {
        const updatedAccount = message.data
        const accountLogin = message.login || updatedAccount?.login
        
        if (!updatedAccount || !accountLogin) {
          console.warn('[WebSocket] Invalid ACCOUNT_UPDATED data:', message)
          return
        }
        
        console.log(`[WebSocket] Updating client ${accountLogin} with new data`)
        
        // Update the specific client in the array
        setClients(prevClients => {
          const clientIndex = prevClients.findIndex(c => c.login === accountLogin)
          
          if (clientIndex === -1) {
            // New client, add to array
            console.log(`[WebSocket] Adding new client ${accountLogin}`)
            return [...prevClients, updatedAccount]
          }
          
          // Update existing client
          const newClients = [...prevClients]
          newClients[clientIndex] = {
            ...newClients[clientIndex],
            ...updatedAccount
          }
          
          return newClients
        })
      } catch (error) {
        console.error('[WebSocket] Error processing ACCOUNT_UPDATED:', error)
      }
    })

    // Monitor WebSocket connection state
    const unsubscribeConnectionState = websocketService.onConnectionStateChange((state) => {
      console.log('[WebSocket] Connection state changed:', state)
      setWsConnectionState(state)
      
      // Start fallback polling if WebSocket disconnected
      if (state === 'disconnected' || state === 'failed') {
        startFallbackPolling()
      } else if (state === 'connected') {
        stopFallbackPolling()
      }
    })

    return () => {
      unsubscribeClients()
      unsubscribePositions()
      unsubscribeAccountUpdate()
      unsubscribeConnectionState()
      stopFallbackPolling()
      // Keep WebSocket connected for other pages
      // websocketService.disconnect()
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle column resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing || !tableRef.current) return
      
      const tableWidth = tableRef.current.offsetWidth
      const minWidth = 80 // minimum column width in pixels
      const minWidthPercent = (minWidth / tableWidth) * 100
      
      const deltaX = e.clientX - resizing.startX
      const newWidth = Math.max(minWidthPercent, resizing.startWidth + (deltaX / tableWidth) * 100)
      
      setColumnWidths(prev => ({
        ...prev,
        [resizing.columnKey]: newWidth
      }))
    }

    const handleMouseUp = () => {
      setResizing(null)
    }

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])

  const handleResizeStart = (e, columnKey, currentWidth) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing({
      columnKey,
      startX: e.clientX,
      startWidth: currentWidth
    })
  }

  const fetchClients = async () => {
    try {
      setLoading(true)
      const response = await brokerAPI.getClients()
      setClients(response.data?.clients || [])
      
      // Fetch and cache all positions once (only if not already cached)
      if (!allPositionsCache) {
        console.log('Fetching and caching ALL positions on page load')
        const positionsResponse = await brokerAPI.getPositions()
        const allPositions = positionsResponse.data?.positions || []
        setPositions(allPositions)
        setAllPositionsCache(allPositions)
      } else {
        console.log('Using cached positions for filtering')
        setPositions(allPositionsCache)
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      setError('Failed to load clients data')
    } finally {
      setLoading(false)
    }
  }


  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }
  
  // Get filtered clients based on filter settings
  const getFilteredClients = () => {
    let filtered = [...clients]
    
    if (filterByPositions) {
      // Filter clients who have at least one position
      const clientsWithPositions = new Set(positions.map(p => p.login))
      filtered = filtered.filter(c => clientsWithPositions.has(c.login))
    }
    
    if (filterByDeals) {
      // For deals, we check if client has floating/profit values indicating trading activity
      filtered = filtered.filter(c => 
        (c.floating && Math.abs(c.floating) > 0) || 
        (c.profit && Math.abs(c.profit) > 0)
      )
    }
    
    return filtered
  }
  
  // Sorting function with type detection
  const sortClients = (clientsToSort) => {
    if (!sortColumn) return clientsToSort
    
    const sorted = [...clientsToSort].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number (including balance, equity, profit, etc.)
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum) && typeof aVal !== 'string') {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      // Check if it's a date/timestamp (registration, lastAccess)
      if ((sortColumn === 'registration' || sortColumn === 'lastAccess') && !isNaN(aVal) && !isNaN(bVal)) {
        const aTime = Number(aVal)
        const bTime = Number(bVal)
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
      }
      
      // Default to string comparison (alphabetical)
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })
    
    return sorted
  }
  
  const filteredClients = sortClients(getFilteredClients())
  
  // Handle column header click for sorting
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }
  
  // Generate dynamic pagination options based on data count
  const generatePageSizeOptions = () => {
    const options = ['All']
    const totalCount = filteredClients.length
    
    // Generate options incrementing by 50, up to total count
    for (let i = 50; i < totalCount; i += 50) {
      options.push(i)
    }
    
    // Always show total count as an option if it's not already included
    if (totalCount > 0 && totalCount % 50 !== 0 && !options.includes(totalCount)) {
      options.push(totalCount)
    }
    
    return options
  }
  
  const pageSizeOptions = generatePageSizeOptions()
  
  // Pagination logic
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(filteredClients.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? filteredClients.length : startIndex + itemsPerPage
  const displayedClients = filteredClients.slice(startIndex, endIndex)
  
  // Reset to page 1 when filters or items per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterByPositions, filterByDeals, itemsPerPage])
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }
  
  // Fallback polling when WebSocket is disconnected
  const startFallbackPolling = () => {
    // Don't start if already polling
    if (fallbackPollingInterval.current) return
    
    console.log('[Fallback] Starting HTTP polling (WebSocket unavailable)')
    
    // Poll every 5 seconds
    fallbackPollingInterval.current = setInterval(() => {
      console.log('[Fallback] Polling for updates...')
      fetchClients().catch(err => {
        console.error('[Fallback] Polling failed:', err)
      })
    }, 5000)
  }
  
  const stopFallbackPolling = () => {
    if (fallbackPollingInterval.current) {
      console.log('[Fallback] Stopping HTTP polling (WebSocket connected)')
      clearInterval(fallbackPollingInterval.current)
      fallbackPollingInterval.current = null
    }
  }

  const formatValue = (key, value) => {
    if (value === null || value === undefined || value === '') return '-'
    
    if (['balance', 'credit', 'equity', 'margin', 'marginFree', 'profit', 'floating'].includes(key)) {
      return parseFloat(value).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })
    }
    
    if (key === 'marginLevel') {
      return value > 0 ? `${parseFloat(value).toFixed(2)}%` : '-'
    }
    
    if (['registration', 'lastAccess'].includes(key)) {
      return new Date(value * 1000).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    }
    
    return value
  }

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-x-hidden">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Clients</h1>
                <p className="text-xs text-gray-500 mt-0.5">Manage and view all client accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
              <button
                onClick={fetchClients}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                  {(filterByPositions || filterByDeals) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      {(filterByPositions ? 1 : 0) + (filterByDeals ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilterMenu && (
                  <div
                    ref={filterMenuRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-56"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Filter Clients</p>
                    </div>
                    <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={filterByPositions}
                        onChange={() => setFilterByPositions(!filterByPositions)}
                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                      />
                      <span className="ml-2 text-sm text-gray-700">Has Open Positions</span>
                    </label>
                    <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={filterByDeals}
                        onChange={() => setFilterByDeals(!filterByDeals)}
                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                      />
                      <span className="ml-2 text-sm text-gray-700">Has Trading Activity</span>
                    </label>
                  </div>
                )}
              </div>
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
            </div>
          </div>

          {error && (
            <div className="mb-3 bg-red-50 border-l-4 border-red-500 rounded-r p-3 shadow-sm">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Total Clients</p>
              <p className="text-base font-semibold text-gray-900">{filteredClients.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Total Balance</p>
              <p className="text-base font-semibold text-gray-900">
                {filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 p-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Total Credit</p>
              <p className="text-base font-semibold text-green-600">
                {filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Total Equity</p>
              <p className="text-base font-semibold text-gray-900">
                {filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-2">
              <p className="text-[10px] text-gray-500 mb-0.5">PNL</p>
              <p className={`text-base font-semibold ${(filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0) - filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0) - filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
              <p className="text-[10px] text-gray-500 mb-0.5">Total Floating Profit</p>
              <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="mb-3 flex items-center justify-between bg-white rounded-lg shadow-sm border border-blue-100 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value === 'All' ? 'All' : parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600">entries</span>
            </div>
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} - {Math.min(endIndex, filteredClients.length)} of {filteredClients.length}
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div>
              <table ref={tableRef} className="w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {allColumns.filter(col => visibleColumns[col.key]).map(col => {
                      const visibleCols = allColumns.filter(c => visibleColumns[c.key])
                      const defaultWidth = 100 / visibleCols.length
                      const width = columnWidths[col.key] || defaultWidth
                      
                      return (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider relative group cursor-pointer hover:bg-blue-100 transition-colors"
                          style={{ width: `${width}%` }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center gap-1 truncate" title={col.label}>
                            <span>{col.label}</span>
                            {sortColumn === col.key && (
                              <svg 
                                className={`w-3 h-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                            {sortColumn !== col.key && (
                              <svg 
                                className="w-3 h-3 opacity-0 group-hover:opacity-30" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            )}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-black opacity-30 hover:opacity-60"
                            onMouseDown={(e) => handleResizeStart(e, col.key, width)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              opacity: resizing?.columnKey === col.key ? 0.8 : undefined
                            }}
                          />
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {displayedClients.map((client, idx) => (
                    <tr 
                      key={client.login}
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      {allColumns.filter(col => visibleColumns[col.key]).map(col => {
                        const visibleCols = allColumns.filter(c => visibleColumns[c.key])
                        const defaultWidth = 100 / visibleCols.length
                        const width = columnWidths[col.key] || defaultWidth
                        
                        return (
                          <td
                            key={col.key}
                            className="px-3 py-2 text-sm text-gray-900"
                            style={{ width: `${width}%` }}
                          >
                            <div className="truncate" title={formatValue(col.key, client[col.key])}>
                              {formatValue(col.key, client[col.key])}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls - Bottom */}
          {itemsPerPage !== 'All' && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                }`}
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="px-3 py-2 text-sm rounded-lg bg-white text-gray-700 hover:bg-blue-50 border border-gray-300"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="px-2 py-2 text-gray-500">...</span>}
                  </>
                )}
                
                {/* Page numbers around current page */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage || 
                           page === currentPage - 1 || 
                           page === currentPage + 1 ||
                           (currentPage <= 2 && page <= 3) ||
                           (currentPage >= totalPages - 1 && page >= totalPages - 2)
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                
                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 py-2 text-gray-500">...</span>}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="px-3 py-2 text-sm rounded-lg bg-white text-gray-700 hover:bg-blue-50 border border-gray-300"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                }`}
              >
                Next
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Client Positions Modal */}
      {selectedClient && (
        <ClientPositionsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onClientUpdate={fetchClients}
          allPositionsCache={allPositionsCache}
          onCacheUpdate={(newAllPositions) => {
            setAllPositionsCache(newAllPositions)
          }}
        />
      )}
    </div>
  )
}

export default ClientsPage
