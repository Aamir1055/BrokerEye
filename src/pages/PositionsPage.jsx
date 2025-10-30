import { useEffect, useRef, useState, useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import websocketService from '../services/websocket'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import LoginDetailsModal from '../components/LoginDetailsModal'

const PositionsPage = () => {
  // Use cached data from DataContext
  const { positions: cachedPositions, fetchPositions, loading, connectionState } = useData()
  const { isAuthenticated } = useAuth()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const [selectedLogin, setSelectedLogin] = useState(null) // For login details modal
  // Transient UI flash map: { [positionId]: { ts, type: 'add'|'update'|'pnl', priceDelta?, profitDelta? } }
  const [flashes, setFlashes] = useState({})
  const flashTimeouts = useRef(new Map())
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  
  // Position Groups state
  const [positionGroups, setPositionGroups] = useState(() => {
    // Load groups from localStorage on initial render
    try {
      const saved = localStorage.getItem('positionGroups')
      const groups = saved ? JSON.parse(saved) : []
      console.log('Loading position groups from localStorage:', groups.length, 'groups found')
      return groups
    } catch (error) {
      console.error('Failed to load position groups:', error)
      return []
    }
  })
  const [selectedPositions, setSelectedPositions] = useState([]) // Array of position IDs for group creation
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [activeGroupFilter, setActiveGroupFilter] = useState(null) // null or group name
  const [groupSearchQuery, setGroupSearchQuery] = useState('') // Separate search for group modal
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false)
  
  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef(null)
  const [visibleColumns, setVisibleColumns] = useState({
    position: true,
    time: true,
    login: true,
    action: true,
    symbol: true,
    volume: true,
    priceOpen: true,
    priceCurrent: true,
    sl: false,
    tp: false,
    profit: true,
    storage: false,
    commission: false
  })

  const allColumns = [
    { key: 'position', label: 'Position' },
    { key: 'time', label: 'Time' },
    { key: 'login', label: 'Login' },
    { key: 'action', label: 'Action' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'volume', label: 'Volume' },
    { key: 'priceOpen', label: 'Price Open' },
    { key: 'priceCurrent', label: 'Price Current' },
    { key: 'sl', label: 'S/L' },
    { key: 'tp', label: 'T/P' },
    { key: 'profit', label: 'Profit' },
    { key: 'storage', label: 'Storage' },
    { key: 'commission', label: 'Commission' }
  ]

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  // Helper to queue a transient highlight for a given position id
  const queueFlash = (id, data = {}) => {
    if (!id) return
    const key = String(id)

    
    // Clear previous timeout if any
    const prevTo = flashTimeouts.current.get(key)
    if (prevTo) clearTimeout(prevTo)

    setFlashes((prev) => ({
      ...prev,
      [key]: {
        ts: Date.now(),
        ...data,
      },
    }))

    const to = setTimeout(() => {
      setFlashes((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      flashTimeouts.current.delete(key)
    }, 1500)
    flashTimeouts.current.set(key, to)
  }
  const hasInitialLoad = useRef(false)
  const prevPositionsRef = useRef([])

    useEffect(() => {
    if (!isAuthenticated) {
      console.log('[Positions] ⚠️ Not authenticated, skipping fetch')
      return
    }
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      console.log('[Positions] 🚀 Initial load - fetching positions')
      fetchPositions()
    }

    return () => {
      // Clear any pending flash timeouts
      try {
        flashTimeouts.current.forEach((to) => clearTimeout(to))
        flashTimeouts.current.clear()
      } catch {}
    }
  },  [isAuthenticated])

  // Track position changes for flash indicators (WebSocket updates)
  useEffect(() => { if (!isAuthenticated) return;
    if (!hasInitialLoad.current || cachedPositions.length === 0) {
      prevPositionsRef.current = cachedPositions
      return
    }

    const prevPositions = prevPositionsRef.current
    const prevMap = new Map(prevPositions.map(p => [getPosKey(p), p]))

    cachedPositions.forEach(pos => {
      const key = getPosKey(pos)
      if (!key) return

      const prev = prevMap.get(key)
      if (!prev) {
        // New position added
        queueFlash(key, { type: 'add' })
      } else {
        // Check for updates
        const priceDelta = Number(pos.priceCurrent || 0) - Number(prev.priceCurrent || 0)
        const profitDelta = Number(pos.profit || 0) - Number(prev.profit || 0)

        if (Math.abs(priceDelta) > 0.00001 || Math.abs(profitDelta) > 0.01) {
          queueFlash(key, { type: 'update', priceDelta, profitDelta })
        }
      }
    })

    prevPositionsRef.current = cachedPositions
  }, [cachedPositions])
  
  // Close suggestions when clicking outside
  useEffect(() => { if (!isAuthenticated) return;
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
    }
    
    if (showSuggestions || showColumnSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions, showColumnSelector])

  // Save position groups to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('positionGroups', JSON.stringify(positionGroups))
      console.log('Saved position groups to localStorage:', positionGroups.length, 'groups')
    } catch (error) {
      console.error('Failed to save position groups:', error)
    }
  }, [positionGroups])

  // Memoized summary statistics - automatically updates when cachedPositions changes
  const summaryStats = useMemo(() => {
    const totalPositions = cachedPositions.length
    const totalFloatingProfit = cachedPositions.reduce((sum, p) => sum + (p.profit || 0), 0)
    const uniqueLogins = new Set(cachedPositions.map(p => p.login)).size
    const uniqueSymbols = new Set(cachedPositions.map(p => p.symbol)).size
    
    console.log('[Positions] 📊 Summary stats recalculated:', {
      totalPositions,
      totalFloatingProfit: totalFloatingProfit.toFixed(2),
      uniqueLogins,
      uniqueSymbols
    })
    
    return {
      totalPositions,
      totalFloatingProfit,
      uniqueLogins,
      uniqueSymbols
    }
  }, [cachedPositions])

  // Helper to get position key/id
  const getPosKey = (obj) => {
    const id = obj?.position
    return id !== undefined && id !== null ? String(id) : undefined
  }

  const formatNumber = (n, digits = 2) => {
    const num = Number(n)
    if (Number.isNaN(num)) return '-'
    return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }

  const formatTime = (ts) => {
    if (!ts) return '-'
    try {
      const d = new Date(ts * 1000)
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      const seconds = String(d.getSeconds()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
    } catch {
      return '-'
    }
  }

  // Generate dynamic pagination options based on data count
  const generatePageSizeOptions = () => {
    const options = ['All']
    const totalCount = cachedPositions.length
    
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
  
  // Search function
  const searchPositions = (positionsToSearch) => {
    if (!searchQuery.trim()) {
      return positionsToSearch
    }
    
    const query = searchQuery.toLowerCase().trim()
    return positionsToSearch.filter(position => {
      const login = String(position.login || '').toLowerCase()
      const symbol = String(position.symbol || '').toLowerCase()
      const positionId = String(position.position || '').toLowerCase()
      
      return login.includes(query) || symbol.includes(query) || positionId.includes(query)
    })
  }
  
  const handleSuggestionClick = (suggestion) => {
    const value = suggestion.split(': ')[1]
    setSearchQuery(value)
    setShowSuggestions(false)
  }
  
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false)
    }
  }
  
  // Group modal search helpers
  const getGroupSuggestions = (sorted) => {
    // If no search query, show all positions (limited to first 50 for performance)
    if (!groupSearchQuery || typeof groupSearchQuery !== 'string' || !groupSearchQuery.trim()) {
      return sorted.slice(0, 50)
    }
    
    const q = groupSearchQuery.toLowerCase().trim()
    const matchedPositions = []
    sorted.forEach(p => {
      const position = String(p.position || '')
      const login = String(p.login || '')
      const symbol = String(p.symbol || '')
      if (position.toLowerCase().includes(q) || login.toLowerCase().includes(q) || 
          symbol.toLowerCase().includes(q)) {
        matchedPositions.push(p)
      }
    })
    return matchedPositions.slice(0, 50)
  }
  
  const togglePositionSelection = (positionId) => {
    setSelectedPositions(prev => 
      prev.includes(positionId) ? prev.filter(id => id !== positionId) : [...prev, positionId]
    )
  }
  
  const createGroupFromSelected = () => {
    if (!newGroupName.trim()) {
      return
    }
    if (selectedPositions.length === 0) {
      return
    }
    const newGroup = {
      name: newGroupName.trim(),
      positionIds: [...selectedPositions]
    }
    
    setPositionGroups(prev => {
      const updatedGroups = [...prev, newGroup]
      console.log('Position group created:', newGroup)
      console.log('Total groups:', updatedGroups.length)
      return updatedGroups
    })
    
    setNewGroupName('')
    setSelectedPositions([])
    setShowCreateGroupModal(false)
    setGroupSearchQuery('')
    setShowGroupSuggestions(false)
  }
  
  // Sorting function with type detection
  const sortPositions = (positionsToSort) => {
    if (!sortColumn) return positionsToSort
    
    const sorted = [...positionsToSort].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number (including volume, prices, profit, etc.)
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      // Default to string comparison (for login, symbol, action, etc.)
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
  
  const searchedPositions = searchPositions(cachedPositions)
  
  // Apply group filter if active
  const groupFilteredPositions = activeGroupFilter 
    ? searchedPositions.filter(p => {
        const group = positionGroups.find(g => g.name === activeGroupFilter)
        return group && group.positionIds.includes(p.position)
      })
    : searchedPositions
  
  const sortedPositions = sortPositions(groupFilteredPositions)
  
  // Get search suggestions
  const getSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      return []
    }
    
    const query = searchQuery.toLowerCase().trim()
    const suggestions = new Set()
    
    sortedPositions.forEach(position => {
      const login = String(position.login || '')
      const symbol = String(position.symbol || '')
      const positionId = String(position.position || '')
      
      if (login.toLowerCase().includes(query)) {
        suggestions.add(`Login: ${login}`)
      }
      if (symbol.toLowerCase().includes(query) && symbol) {
        suggestions.add(`Symbol: ${symbol}`)
      }
      if (positionId.toLowerCase().includes(query)) {
        suggestions.add(`Position: ${positionId}`)
      }
    })
    
    return Array.from(suggestions).slice(0, 10)
  }
  
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
  
  // Pagination logic
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedPositions.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedPositions.length : startIndex + itemsPerPage
  const displayedPositions = sortedPositions.slice(startIndex, endIndex)
  
  // Reset to page 1 when items per page changes
  useEffect(() => { if (!isAuthenticated) return;
    setCurrentPage(1)
  }, [itemsPerPage])
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  if (loading.positions) return <LoadingSpinner />

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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Positions</h1>
                <p className="text-xs text-gray-500 mt-0.5">Live open positions across accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Groups Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowGroupsModal(!showGroupsModal)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Groups
                  {positionGroups.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      {positionGroups.length}
                    </span>
                  )}
                  {activeGroupFilter && (
                    <span className="ml-1 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded-full">
                      Active
                    </span>
                  )}
                </button>
                {showGroupsModal && (
                  <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-64">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Position Groups</p>
                      <button
                        onClick={() => {
                          setShowCreateGroupModal(true)
                          setShowGroupsModal(false)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + New
                      </button>
                    </div>
                    {positionGroups.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        No groups created yet
                      </div>
                    ) : (
                      <div className="py-1 max-h-80 overflow-y-auto">
                        <button
                          onClick={() => {
                            setActiveGroupFilter(null)
                            setShowGroupsModal(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            activeGroupFilter === null 
                              ? 'bg-blue-50 text-blue-700 font-medium' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          All Positions
                        </button>
                        {positionGroups.map((group, idx) => (
                          <div key={idx} className="flex items-center hover:bg-gray-50">
                            <button
                              onClick={() => {
                                setActiveGroupFilter(group.name)
                                setShowGroupsModal(false)
                              }}
                              className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${
                                activeGroupFilter === group.name 
                                  ? 'bg-blue-50 text-blue-700 font-medium' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {group.name}
                              <span className="ml-2 text-xs text-gray-500">
                                ({group.positionIds.length})
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete group "${group.name}"?`)) {
                                  setPositionGroups(positionGroups.filter((_, i) => i !== idx))
                                  if (activeGroupFilter === group.name) {
                                    setActiveGroupFilter(null)
                                  }
                                }
                              }}
                              className="px-2 py-2 text-red-600 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <WebSocketIndicator />
              <button
                onClick={() => {
                  console.log('[Positions] Requesting fresh position snapshot from WebSocket...')
                  websocketService.send({
                    type: 'GET_POSITIONS',
                    action: 'snapshot'
                  })
                }}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                title="Refresh positions from WebSocket"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Positions</p>
              <p className="text-lg font-semibold text-gray-900">{summaryStats.totalPositions}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Floating Profit</p>
              <p className={`text-lg font-semibold flex items-center gap-1 ${summaryStats.totalFloatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {summaryStats.totalFloatingProfit >= 0 ? '▲' : '▼'}
                {formatNumber(Math.abs(summaryStats.totalFloatingProfit))}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Unique Logins</p>
              <p className="text-lg font-semibold text-gray-900">{summaryStats.uniqueLogins}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Symbols</p>
              <p className="text-lg font-semibold text-gray-900">{summaryStats.uniqueSymbols}</p>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-lg shadow-sm border border-blue-100 p-3">
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
                    placeholder="Search login, symbol, position..."
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
                Showing {startIndex + 1} - {Math.min(endIndex, sortedPositions.length)} of {sortedPositions.length}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div className="overflow-x-auto">
              {displayedPositions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                  <p className="text-gray-500 text-sm">No positions found</p>
                  <p className="text-gray-400 text-xs mt-1">Live updates will appear here</p>
                </div>
              ) : (
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0">
                    <tr>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('timeUpdate')}
                      >
                        <div className="flex items-center gap-1">
                          Updated
                          {sortColumn === 'timeUpdate' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('login')}
                      >
                        <div className="flex items-center gap-1">
                          Login
                          {sortColumn === 'login' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('position')}
                      >
                        <div className="flex items-center gap-1">
                          Position
                          {sortColumn === 'position' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('symbol')}
                      >
                        <div className="flex items-center gap-1">
                          Symbol
                          {sortColumn === 'symbol' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('action')}
                      >
                        <div className="flex items-center gap-1">
                          Action
                          {sortColumn === 'action' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('volume')}
                      >
                        <div className="flex items-center gap-1">
                          Volume
                          {sortColumn === 'volume' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('priceOpen')}
                      >
                        <div className="flex items-center gap-1">
                          Open
                          {sortColumn === 'priceOpen' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('priceCurrent')}
                      >
                        <div className="flex items-center gap-1">
                          Current
                          {sortColumn === 'priceCurrent' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('profit')}
                      >
                        <div className="flex items-center gap-1">
                          Profit
                          {sortColumn === 'profit' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {displayedPositions.map((p) => {
                      // Remove flash highlights and animations; keep simple hover style
                      const rowClass = 'hover:bg-blue-50'
                      return (
                        <tr key={p.position} className={`${rowClass} transition-all duration-300`}>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatTime(p.timeUpdate || p.timeCreate)}</td>
                          <td 
                            className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedLogin(p.login)
                            }}
                            title="Click to view login details"
                          >
                            {p.login}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.position}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.symbol}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.action}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.volume, 2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.priceOpen, 5)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>
                                {formatNumber(p.priceCurrent, 5)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded transition-all duration-300 ${
                                (p.profit || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {formatNumber(p.profit, 2)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Connection status helper */}
          <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">
              <strong>Status:</strong> {connectionState === 'connected' ? 'Live via WebSocket' : connectionState}
            </p>
          </div>
        </div>
      </main>
      
      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Position Group</h3>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search and Select Positions
                </label>
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Search by position, login, symbol..."
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 mb-2"
                />
                
                {/* Position List - Always Visible */}
                <div className="bg-white rounded-md border border-gray-200">
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                    <p className="text-xs font-semibold text-blue-700">
                      {selectedPositions.length} position(s) selected • Showing {getGroupSuggestions(cachedPositions).length} positions
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {getGroupSuggestions(cachedPositions).length > 0 ? (
                      getGroupSuggestions(cachedPositions).map((position, idx) => (
                        <label key={idx} className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                          <input
                            type="checkbox"
                            checked={selectedPositions.includes(position.position)}
                            onChange={() => togglePositionSelection(position.position)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">
                            <span className="font-medium">{position.position}</span> - {position.login} ({position.symbol})
                          </span>
                        </label>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No positions found
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {selectedPositions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Positions ({selectedPositions.length}):
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded">
                    {selectedPositions.map((posId, idx) => {
                      const position = cachedPositions.find(p => p.position === posId)
                      return (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {position ? `${position.position} - ${position.symbol}` : posId}
                          <button
                            onClick={() => togglePositionSelection(posId)}
                            className="text-blue-900 hover:text-blue-700"
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateGroupModal(false)
                  setNewGroupName('')
                  setSelectedPositions([])
                  setGroupSearchQuery('')
                  setShowGroupSuggestions(false)
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createGroupFromSelected}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

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

export default PositionsPage
