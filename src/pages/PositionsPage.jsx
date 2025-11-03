import { useEffect, useRef, useState, useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useGroups } from '../contexts/GroupContext'
import websocketService from '../services/websocket'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import LoginDetailsModal from '../components/LoginDetailsModal'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'

const PositionsPage = () => {
  // Use cached data from DataContext
  const { positions: cachedPositions, fetchPositions, loading, connectionState } = useData()
  const { isAuthenticated } = useAuth()
  const { filterByActiveGroup } = useGroups()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const [selectedLogin, setSelectedLogin] = useState(null) // For login details modal
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  
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
    profitPercentage: false,
    storage: false,
    storagePercentage: false,
    volumePercentage: false,
    appliedPercentage: false,
    reason: false,
    comment: false,
    commission: false
  })

  const allColumns = [
    { key: 'position', label: 'Position' },
    { key: 'time', label: 'Time' },
    { key: 'login', label: 'Login' },
    { key: 'action', label: 'Action' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'volume', label: 'Volume' },
    { key: 'volumePercentage', label: 'Volume %' },
    { key: 'priceOpen', label: 'Price Open' },
    { key: 'priceCurrent', label: 'Price Current' },
    { key: 'sl', label: 'S/L' },
    { key: 'tp', label: 'T/P' },
    { key: 'profit', label: 'Profit' },
    { key: 'profitPercentage', label: 'Profit %' },
    { key: 'storage', label: 'Storage' },
    { key: 'storagePercentage', label: 'Storage %' },
    { key: 'appliedPercentage', label: 'Applied %' },
    { key: 'reason', label: 'Reason' },
    { key: 'comment', label: 'Comment' },
    { key: 'commission', label: 'Commission' }
  ]

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  // Column filter states
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterDropdown, setShowFilterDropdown] = useState(null)
  const filterRefs = useRef({})
  const [filterSearchQuery, setFilterSearchQuery] = useState({})
  const [showNumberFilterDropdown, setShowNumberFilterDropdown] = useState(null)
  
  // Custom filter modal states
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false)
  const [customFilterColumn, setCustomFilterColumn] = useState(null)
  const [customFilterType, setCustomFilterType] = useState('equal')
  const [customFilterValue1, setCustomFilterValue1] = useState('')
  const [customFilterValue2, setCustomFilterValue2] = useState('')
  const [customFilterOperator, setCustomFilterOperator] = useState('AND')

  // Column filter helper functions
  const getUniqueColumnValues = (columnKey) => {
    const values = new Set()
    cachedPositions.forEach(position => {
      const value = position[columnKey]
      if (value !== null && value !== undefined && value !== '') {
        values.add(value)
      }
    })
    const sortedValues = Array.from(values).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b
      }
      return String(a).localeCompare(String(b))
    })
    
    // Filter by search query if exists
    const searchQuery = filterSearchQuery[columnKey]?.toLowerCase() || ''
    if (searchQuery) {
      return sortedValues.filter(value => 
        String(value).toLowerCase().includes(searchQuery)
      )
    }
    
    return sortedValues
  }

  const toggleColumnFilter = (columnKey, value) => {
    setColumnFilters(prev => {
      const currentFilters = prev[columnKey] || []
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter(v => v !== value)
        : [...currentFilters, value]
      
      if (newFilters.length === 0) {
        const { [columnKey]: _, ...rest } = prev
        return rest
      }
      
      return { ...prev, [columnKey]: newFilters }
    })
  }

  const selectAllFilters = (columnKey) => {
    const allValues = getUniqueColumnValues(columnKey)
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: allValues
    }))
  }

  const deselectAllFilters = (columnKey) => {
    setColumnFilters(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })
  }

  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const numberFilterKey = `${columnKey}_number`
      const { [columnKey]: _, [numberFilterKey]: __, ...rest } = prev
      return rest
    })
    setFilterSearchQuery(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })
    setShowFilterDropdown(null)
  }

  const getActiveFilterCount = (columnKey) => {
    // Check for regular checkbox filters
    const checkboxCount = columnFilters[columnKey]?.length || 0
    
    // Check for number filter
    const numberFilterKey = `${columnKey}_number`
    const hasNumberFilter = columnFilters[numberFilterKey] ? 1 : 0
    
    return checkboxCount + hasNumberFilter
  }

  const isAllSelected = (columnKey) => {
    const allValues = getUniqueColumnValues(columnKey)
    const selectedValues = columnFilters[columnKey] || []
    return allValues.length > 0 && selectedValues.length === allValues.length
  }

  // Apply custom number filter
  const applyCustomNumberFilter = () => {
    if (!customFilterColumn || !customFilterValue1) return

    const filterConfig = {
      type: customFilterType,
      value1: parseFloat(customFilterValue1),
      value2: customFilterValue2 ? parseFloat(customFilterValue2) : null,
      operator: customFilterOperator
    }

    setColumnFilters(prev => ({
      ...prev,
      [`${customFilterColumn}_number`]: filterConfig
    }))

    // Close modal and dropdown
    setShowCustomFilterModal(false)
    setShowFilterDropdown(null)
    setShowNumberFilterDropdown(null)
    
    // Reset form
    setCustomFilterValue1('')
    setCustomFilterValue2('')
    setCustomFilterType('equal')
  }

  // Check if value matches number filter
  const matchesNumberFilter = (value, filterConfig) => {
    if (!filterConfig) return true
    
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return false

    const { type, value1, value2 } = filterConfig

    switch (type) {
      case 'equal':
        return numValue === value1
      case 'notEqual':
        return numValue !== value1
      case 'lessThan':
        return numValue < value1
      case 'lessThanOrEqual':
        return numValue <= value1
      case 'greaterThan':
        return numValue > value1
      case 'greaterThanOrEqual':
        return numValue >= value1
      case 'between':
        return value2 !== null && numValue >= value1 && numValue <= value2
      default:
        return true
    }
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

    let newCount = 0
    let updateCount = 0
    let deletedCount = prevPositions.length - cachedPositions.length

    cachedPositions.forEach(pos => {
      const key = getPosKey(pos)
      if (!key) return

      const prev = prevMap.get(key)
      if (!prev) {
        // New position added
        newCount++
        queueFlash(key, { type: 'add' })
      } else {
        // Check for updates
        const priceDelta = Number(pos.priceCurrent || 0) - Number(prev.priceCurrent || 0)
        const profitDelta = Number(pos.profit || 0) - Number(prev.profit || 0)

        if (Math.abs(priceDelta) > 0.00001 || Math.abs(profitDelta) > 0.01) {
          updateCount++
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
  let groupFilteredPositions = filterByActiveGroup(searchedPositions, 'login', 'positions')
  
  // Apply column filters
  Object.entries(columnFilters).forEach(([columnKey, values]) => {
    if (columnKey.endsWith('_number')) {
      // Number filter
      const actualColumnKey = columnKey.replace('_number', '')
      groupFilteredPositions = groupFilteredPositions.filter(position => {
        const positionValue = position[actualColumnKey]
        return matchesNumberFilter(positionValue, values)
      })
    } else if (values && values.length > 0) {
      // Regular checkbox filter
      groupFilteredPositions = groupFilteredPositions.filter(position => {
        const positionValue = position[columnKey]
        return values.includes(positionValue)
      })
    }
  })
  
  const sortedPositions = sortPositions(groupFilteredPositions)

  // Memoized summary statistics - based on filtered positions
  const summaryStats = useMemo(() => {
    const totalPositions = groupFilteredPositions.length
    const totalFloatingProfit = groupFilteredPositions.reduce((sum, p) => sum + (p.profit || 0), 0)
    const uniqueLogins = new Set(groupFilteredPositions.map(p => p.login)).size
    const uniqueSymbols = new Set(groupFilteredPositions.map(p => p.symbol)).size
    
    return {
      totalPositions,
      totalFloatingProfit,
      uniqueLogins,
      uniqueSymbols
    }
  }, [groupFilteredPositions])
  
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

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && filterRefs.current[showFilterDropdown]) {
        if (!filterRefs.current[showFilterDropdown].contains(event.target)) {
          setShowFilterDropdown(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown])
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  // Helper function to render table header with filter
  const renderHeaderCell = (columnKey, label, sortKey = null) => {
    const filterCount = getActiveFilterCount(columnKey)
    const actualSortKey = sortKey || columnKey
    
    return (
      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-blue-100 transition-colors select-none group">
        <div className="flex items-center gap-1 justify-between">
          <div 
            className="flex items-center gap-1 cursor-pointer flex-1"
            onClick={() => handleSort(actualSortKey)}
          >
            <span>{label}</span>
            {sortColumn === actualSortKey ? (
              <span className="text-blue-600">
                {sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            ) : (
              <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
            )}
          </div>
          
          <div className="relative" ref={el => {
            if (!filterRefs.current) filterRefs.current = {}
            filterRefs.current[columnKey] = el
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFilterDropdown(showFilterDropdown === columnKey ? null : columnKey)
              }}
              className={`p-1 rounded hover:bg-blue-200 transition-colors ${filterCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}
              title="Filter column"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {filterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>

            {showFilterDropdown === columnKey && (
              <div className="fixed bg-white border border-gray-300 rounded-lg shadow-2xl z-[9999] w-64" 
                style={{
                  top: `${filterRefs.current[columnKey]?.getBoundingClientRect().bottom + 5}px`,
                  left: `${filterRefs.current[columnKey]?.getBoundingClientRect().left}px`
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Filter Menu</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowFilterDropdown(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Sort Options */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSort(columnKey)
                      setSortDirection('asc')
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    Sort Smallest to Largest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSort(columnKey)
                      setSortDirection('desc')
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Sort Largest to Smallest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearColumnFilter(columnKey)
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Clear Filter
                  </button>
                </div>

                {/* Number Filters */}
                <div className="border-b border-gray-200">
                  <div className="px-3 py-2 relative group">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowNumberFilterDropdown(showNumberFilterDropdown === columnKey ? null : columnKey)
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      <span>Number Filters</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    
                    {/* Number Filter Dropdown - Opens to the right */}
                    {showNumberFilterDropdown === columnKey && (
                      <div 
                        className="absolute left-full top-0 ml-1 w-56 bg-white border border-gray-300 rounded shadow-lg z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-sm text-gray-600 py-1">
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('equal')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Equal...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('notEqual')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Not Equal...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('lessThan')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Less Than...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('lessThanOrEqual')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Less Than Or Equal...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('greaterThan')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Greater Than...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('greaterThanOrEqual')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Greater Than Or Equal...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('between')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Between...
                          </div>
                          <div 
                            className="hover:bg-gray-50 px-3 py-2 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCustomFilterColumn(columnKey)
                              setCustomFilterType('equal')
                              setShowCustomFilterModal(true)
                            }}
                          >
                            Custom Filter...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Box */}
                <div className="p-2 border-b border-gray-200">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filterSearchQuery[columnKey] || ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearchQuery(prev => ({
                          ...prev,
                          [columnKey]: e.target.value
                        }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg className="absolute right-2 top-2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Select All / Deselect All */}
                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                  <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isAllSelected(columnKey)}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (e.target.checked) {
                          selectAllFilters(columnKey)
                        } else {
                          deselectAllFilters(columnKey)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Select All</span>
                  </label>
                </div>

                {/* Filter List */}
                <div className="max-h-64 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {getUniqueColumnValues(columnKey).length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        No items found
                      </div>
                    ) : (
                      getUniqueColumnValues(columnKey).map(value => (
                        <label 
                          key={value} 
                          className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={(columnFilters[columnKey] || []).includes(value)}
                            onChange={(e) => {
                              e.stopPropagation()
                              toggleColumnFilter(columnKey, value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 truncate">
                            {value}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearColumnFilter(columnKey)
                    }}
                    className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowFilterDropdown(null)
                    }}
                    className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </th>
    )
  }

  if (loading.positions) return <LoadingSpinner />

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 flex flex-col overflow-hidden">
        <div className="max-w-full mx-auto w-full flex flex-col flex-1 overflow-hidden">
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
              <GroupSelector 
                moduleName="positions" 
                onCreateClick={() => {
                  setEditingGroup(null)
                  setShowGroupModal(true)
                }}
                onEditClick={(group) => {
                  setEditingGroup(group)
                  setShowGroupModal(true)
                }}
              />
              
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
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden flex flex-col flex-1">
            <div className="overflow-y-auto flex-1">
              {displayedPositions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                  <p className="text-gray-500 text-sm">No open positions</p>
                </div>
              ) : (
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0">
                    <tr>
                      {visibleColumns.time && (
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
                      )}
                      {visibleColumns.login && renderHeaderCell('login', 'Login')}
                      {visibleColumns.position && (
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
                      )}
                      {visibleColumns.symbol && renderHeaderCell('symbol', 'Symbol')}
                      {visibleColumns.action && renderHeaderCell('action', 'Action')}
                      {visibleColumns.volume && (
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
                      )}
                      {visibleColumns.volumePercentage && (
                        <th 
                          className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                          onClick={() => handleSort('volume_percentage')}
                        >
                          <div className="flex items-center gap-1">
                            Volume %
                            {sortColumn === 'volume_percentage' ? (
                              <span className="text-blue-600">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            ) : (
                              <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                            )}
                          </div>
                        </th>
                      )}
                      {visibleColumns.priceOpen && (
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
                      )}
                      {visibleColumns.priceCurrent && (
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
                      )}
                      {visibleColumns.sl && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          S/L
                        </th>
                      )}
                      {visibleColumns.tp && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          T/P
                        </th>
                      )}
                      {visibleColumns.profit && (
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
                      )}
                      {visibleColumns.profitPercentage && (
                        <th 
                          className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                          onClick={() => handleSort('profit_percentage')}
                        >
                          <div className="flex items-center gap-1">
                            Profit %
                            {sortColumn === 'profit_percentage' ? (
                              <span className="text-blue-600">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            ) : (
                              <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                            )}
                          </div>
                        </th>
                      )}
                      {visibleColumns.storage && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Storage
                        </th>
                      )}
                      {visibleColumns.storagePercentage && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Storage %
                        </th>
                      )}
                      {visibleColumns.appliedPercentage && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Applied %
                        </th>
                      )}
                      {visibleColumns.reason && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Reason
                        </th>
                      )}
                      {visibleColumns.comment && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Comment
                        </th>
                      )}
                      {visibleColumns.commission && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Commission
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {displayedPositions.map((p) => {
                      const rowClass = 'hover:bg-blue-50'
                      return (
                        <tr key={p.position} className={`${rowClass} transition-all duration-300`}>
                          {visibleColumns.time && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatTime(p.timeUpdate || p.timeCreate)}</td>
                          )}
                          {visibleColumns.login && (
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
                          )}
                          {visibleColumns.position && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.position}</td>
                          )}
                          {visibleColumns.symbol && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.symbol}</td>
                          )}
                          {visibleColumns.action && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.action}</td>
                          )}
                          {visibleColumns.volume && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.volume, 2)}</td>
                          )}
                          {visibleColumns.volumePercentage && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {(p.volume_percentage != null && p.volume_percentage !== '') ? `${formatNumber(p.volume_percentage * 100, 2)}%` : '-'}
                            </td>
                          )}
                          {visibleColumns.priceOpen && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.priceOpen, 5)}</td>
                          )}
                          {visibleColumns.priceCurrent && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {formatNumber(p.priceCurrent, 5)}
                            </td>
                          )}
                          {visibleColumns.sl && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.priceSL, 5)}</td>
                          )}
                          {visibleColumns.tp && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.priceTP, 5)}</td>
                          )}
                          {visibleColumns.profit && (
                            <td className="px-3 py-2 text-sm whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded transition-all duration-300 ${
                                (p.profit || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {formatNumber(p.profit, 2)}
                              </span>
                            </td>
                          )}
                          {visibleColumns.profitPercentage && (
                            <td className="px-3 py-2 text-sm whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                (p.profit_percentage || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {(p.profit_percentage != null && p.profit_percentage !== '') ? `${formatNumber(p.profit_percentage, 2)}%` : '-'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.storage && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.storage, 2)}</td>
                          )}
                          {visibleColumns.storagePercentage && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {(p.storage_percentage != null && p.storage_percentage !== '') ? `${formatNumber(p.storage_percentage, 2)}%` : '-'}
                            </td>
                          )}
                          {visibleColumns.appliedPercentage && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                              {(p.applied_percentage != null && p.applied_percentage !== '') ? `${formatNumber(p.applied_percentage, 2)}%` : '-'}
                            </td>
                          )}
                          {visibleColumns.reason && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                p.reason === 'DEALER' ? 'bg-blue-100 text-blue-800' :
                                p.reason === 'EXPERT' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {p.reason || '-'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.comment && (
                            <td className="px-3 py-2 text-sm text-gray-900 max-w-xs truncate" title={p.comment}>
                              {p.comment || '-'}
                            </td>
                          )}
                          {visibleColumns.commission && (
                            <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.commission, 2)}</td>
                          )}
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
      
      {/* Group Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false)
          setEditingGroup(null)
        }}
        availableItems={cachedPositions}
        loginField="login"
        displayField="symbol"
        secondaryField="position"
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

      {/* Custom Filter Modal */}
      {showCustomFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Custom Filter</h3>
              <button
                onClick={() => {
                  setShowCustomFilterModal(false)
                  setCustomFilterValue1('')
                  setCustomFilterValue2('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Show rows where:</p>
                <p className="text-sm text-gray-600 mb-3">{customFilterColumn}</p>
              </div>

              {/* Filter Type Dropdown */}
              <div>
                <select
                  value={customFilterType}
                  onChange={(e) => setCustomFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                >
                  <option value="equal">Equal</option>
                  <option value="notEqual">Not Equal</option>
                  <option value="lessThan">Less Than</option>
                  <option value="lessThanOrEqual">Less Than Or Equal</option>
                  <option value="greaterThan">Greater Than</option>
                  <option value="greaterThanOrEqual">Greater Than Or Equal</option>
                  <option value="between">Between</option>
                </select>
              </div>

              {/* Value Input */}
              <div>
                <input
                  type="number"
                  value={customFilterValue1}
                  onChange={(e) => setCustomFilterValue1(e.target.value)}
                  placeholder="Enter the value"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                />
              </div>

              {/* Second Value for Between */}
              {customFilterType === 'between' && (
                <>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={customFilterOperator === 'AND'}
                        onChange={() => setCustomFilterOperator('AND')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">AND</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={customFilterOperator === 'OR'}
                        onChange={() => setCustomFilterOperator('OR')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">OR</span>
                    </label>
                  </div>

                  <div>
                    <input
                      type="number"
                      value={customFilterValue2}
                      onChange={(e) => setCustomFilterValue2(e.target.value)}
                      placeholder="Enter the value"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCustomFilterModal(false)
                  setCustomFilterValue1('')
                  setCustomFilterValue2('')
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomNumberFilter}
                disabled={!customFilterValue1}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PositionsPage
