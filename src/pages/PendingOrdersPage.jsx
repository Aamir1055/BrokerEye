import { useEffect, useRef, useState } from 'react'
import { useData } from '../contexts/DataContext'
import { useGroups } from '../contexts/GroupContext'
import { useIB } from '../contexts/IBContext'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'

const PendingOrdersPage = () => {
  // Use cached data from DataContext
  const { orders: cachedOrders, positions: cachedPositions, fetchOrders, loading, connectionState } = useData()
  const { filterByActiveGroup } = useGroups()
  const { filterByActiveIB } = useIB()
  
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const v = localStorage.getItem('sidebarOpen')
      return v ? JSON.parse(v) : false
    } catch {
      return false
    }
  })
  const [error, setError] = useState('')
  const [selectedLogin, setSelectedLogin] = useState(null) // For login details modal
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  
  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef(null)
  const [visibleColumns, setVisibleColumns] = useState({
    order: true,
    time: true,
    login: true,
    type: true,
    symbol: true,
    volume: true,
    priceOrder: true,
    priceCurrent: true,
    sl: false,
    tp: false,
    state: true
  })

  const allColumns = [
    { key: 'order', label: 'Order' },
    { key: 'time', label: 'Time' },
    { key: 'login', label: 'Login' },
    { key: 'type', label: 'Type' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'volume', label: 'Volume' },
    { key: 'priceOrder', label: 'Price Order' },
    { key: 'priceCurrent', label: 'Price Current' },
    { key: 'sl', label: 'S/L' },
    { key: 'tp', label: 'T/P' },
    { key: 'state', label: 'State' }
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

  // Define string columns that should show text filters instead of number filters
  const stringColumns = ['login', 'symbol', 'type', 'state']
  const isStringColumn = (key) => stringColumns.includes(key)

  // Column filter helper functions
  const getUniqueColumnValues = (columnKey) => {
    const values = new Set()
    cachedOrders.forEach(order => {
      const value = order[columnKey]
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
  
  const hasInitialLoad = useRef(false)
  // Transient UI flashes for updated orders
  const [flashes, setFlashes] = useState({})
  const flashTimeouts = useRef(new Map())

  const queueFlash = (id, data = {}) => {
    if (!id) return
    const key = String(id)
    const prev = flashTimeouts.current.get(key)
    if (prev) clearTimeout(prev)
    setFlashes((p) => ({ ...p, [key]: { ts: Date.now(), ...data } }))
    const to = setTimeout(() => {
      setFlashes((p) => {
        const n = { ...p }
        delete n[key]
        return n
      })
      flashTimeouts.current.delete(key)
    }, 1500)
    flashTimeouts.current.set(key, to)
  }
  
  // Close suggestions when clicking outside
  useEffect(() => {
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

  // Helper to get order id
  const getOrderId = (order) => {
    const id = order?.order ?? order?.ticket ?? order?.id
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
    const totalCount = cachedOrders.length
    
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
  const searchOrders = (ordersToSearch) => {
    if (!searchQuery.trim()) {
      return ordersToSearch
    }
    
    const query = searchQuery.toLowerCase().trim()
    return ordersToSearch.filter(order => {
      const login = String(order.login || '').toLowerCase()
      const symbol = String(order.symbol || '').toLowerCase()
      const orderId = String(order.order || order.ticket || '').toLowerCase()
      
      return login.includes(query) || symbol.includes(query) || orderId.includes(query)
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
  const sortOrders = (ordersToSort) => {
    if (!sortColumn) return ordersToSort
    
    const sorted = [...ordersToSort].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number (including volume, prices, etc.)
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
  
  const searchedOrders = searchOrders(cachedOrders)
  
  // Apply group filter if active
  let groupFilteredOrders = filterByActiveGroup(searchedOrders, 'login', 'pendingorders')
  
  // Apply IB filter if active
  let ibFilteredOrders = filterByActiveIB(groupFilteredOrders, 'login')
  
  // Apply column filters
  Object.entries(columnFilters).forEach(([columnKey, values]) => {
    if (columnKey.endsWith('_number')) {
      // Number filter
      const actualColumnKey = columnKey.replace('_number', '')
      ibFilteredOrders = ibFilteredOrders.filter(order => {
        const orderValue = order[actualColumnKey]
        return matchesNumberFilter(orderValue, values)
      })
    } else if (values && values.length > 0) {
      // Regular checkbox filter
      ibFilteredOrders = ibFilteredOrders.filter(order => {
        const orderValue = order[columnKey]
        return values.includes(orderValue)
      })
    }
  })
  
  const sortedOrders = sortOrders(ibFilteredOrders)
  
  // Get search suggestions
  const getSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      return []
    }
    
    const query = searchQuery.toLowerCase().trim()
    const suggestions = new Set()
    
    sortedOrders.forEach(order => {
      const login = String(order.login || '')
      const symbol = String(order.symbol || '')
      const orderId = String(order.order || order.ticket || '')
      
      if (login.toLowerCase().includes(query)) {
        suggestions.add(`Login: ${login}`)
      }
      if (symbol.toLowerCase().includes(query) && symbol) {
        suggestions.add(`Symbol: ${symbol}`)
      }
      if (orderId.toLowerCase().includes(query)) {
        suggestions.add(`Order: ${orderId}`)
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
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedOrders.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedOrders.length : startIndex + itemsPerPage
  const displayedOrders = sortedOrders.slice(startIndex, endIndex)
  
  // Reset to page 1 when items per page changes
  useEffect(() => {
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
      <th className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider hover:bg-blue-700/70 transition-all select-none group">
        <div className="flex items-center gap-1 justify-between">
          <div 
            className="flex items-center gap-1 cursor-pointer flex-1"
            onClick={() => handleSort(actualSortKey)}
          >
            <span>{label}</span>
            {sortColumn === actualSortKey ? (
              <svg
                className={`w-3 h-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
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
          
          <div className="relative" ref={el => {
            if (!filterRefs.current) filterRefs.current = {}
            filterRefs.current[columnKey] = el
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFilterDropdown(showFilterDropdown === columnKey ? null : columnKey)
              }}
              className={`p-1 rounded hover:bg-blue-800/50 transition-colors ${filterCount > 0 ? 'text-yellow-400' : 'text-white/70'}`}
              title="Filter column"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {filterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-blue-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>

            {showFilterDropdown === columnKey && (
              <div className="fixed bg-white border border-gray-300 rounded shadow-2xl z-[9999] w-48" 
                style={{
                  top: `${filterRefs.current[columnKey]?.getBoundingClientRect().bottom + 5}px`,
                  left: (() => {
                    const rect = filterRefs.current[columnKey]?.getBoundingClientRect()
                    if (!rect) return '0px'
                    // Check if dropdown would go off-screen on the right
                    const dropdownWidth = 192 // 48 * 4 (w-48 in pixels)
                    const wouldOverflow = rect.left + dropdownWidth > window.innerWidth
                    // If would overflow, align to the right edge of the button
                    return wouldOverflow 
                      ? `${rect.right - dropdownWidth}px`
                      : `${rect.left}px`
                  })()
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-1.5 py-0.5 border-b border-gray-200 bg-gray-50 rounded-t">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold text-gray-700">Filter Menu</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowFilterDropdown(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Quick Clear Filter */}
                <div className="border-b border-slate-200 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearColumnFilter(columnKey)
                    }}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-semibold hover:bg-slate-50 flex items-center gap-2 text-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Filter
                  </button>
                </div>

                {/* Sort Options */}
                <div className="border-b border-slate-200 py-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSort(columnKey)
                      setSortDirection('asc')
                    }}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    Sort Smallest to Largest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSort(columnKey)
                      setSortDirection('desc')
                    }}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Sort Largest to Smallest
                  </button>
                </div>

                {/* Number Filters (only for numeric columns) */}
                {!isStringColumn(columnKey) && (
                <div className="border-b border-slate-200 py-1" style={{ overflow: 'visible' }}>
                  <div className="px-2 py-1 relative group text-[11px]" style={{ overflow: 'visible' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowNumberFilterDropdown(showNumberFilterDropdown === columnKey ? null : columnKey)
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 transition-all"
                    >
                      <span>Number Filters</span>
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {showNumberFilterDropdown === columnKey && (
                      <div 
                        className="absolute top-0 w-48 bg-white border-2 border-slate-300 rounded-lg shadow-xl"
                        style={{
                          left: 'calc(100% + 8px)',
                          zIndex: 10000000
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[11px] text-slate-700 py-1">
                          <div 
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                            className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors"
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
                )}

                {/* Text Filters (only for string columns) */}
                {isStringColumn(columnKey) && (
                  <div className="border-b border-slate-200 py-1" style={{ overflow: 'visible' }}>
                    <div className="px-2 py-1 relative group text-[11px]" style={{ overflow: 'visible' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowNumberFilterDropdown(showNumberFilterDropdown === columnKey ? null : columnKey)
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 transition-all"
                      >
                        <span>Text Filters</span>
                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {showNumberFilterDropdown === columnKey && (
                        <div 
                          className="absolute top-0 w-56 bg-white border-2 border-slate-300 rounded-lg shadow-xl"
                          style={{ left: 'calc(100% + 8px)', zIndex: 10000000 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-[11px] text-slate-700 py-1">
                            <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomFilterColumn(columnKey); setCustomFilterType('equal'); setShowCustomFilterModal(true) }}>Equal...</div>
                            <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomFilterColumn(columnKey); setCustomFilterType('notEqual'); setShowCustomFilterModal(true) }}>Not Equal...</div>
                            <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomFilterColumn(columnKey); setCustomFilterType('startsWith'); setShowCustomFilterModal(true) }}>Starts With...</div>
                            <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomFilterColumn(columnKey); setCustomFilterType('endsWith'); setShowCustomFilterModal(true) }}>Ends With...</div>
                            <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomFilterColumn(columnKey); setCustomFilterType('contains'); setShowCustomFilterModal(true) }}>Contains...</div>
                            <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomFilterColumn(columnKey); setCustomFilterType('doesNotContain'); setShowCustomFilterModal(true) }}>Does Not Contain...</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Search Box */}
                <div className="p-2 border-b border-slate-200">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search values..."
                      value={filterSearchQuery[columnKey] || ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearchQuery(prev => ({
                          ...prev,
                          [columnKey]: e.target.value
                        }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full pl-8 pr-3 py-1.5 text-[11px] font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-700 placeholder:text-slate-400"
                    />
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Select All / Deselect All */}
                <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50">
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
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-[11px] font-medium text-slate-700">Select All</span>
                  </label>
                </div>

                {/* Filter List */}
                <div className="max-h-40 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {getUniqueColumnValues(columnKey).length === 0 ? (
                      <div className="px-3 py-2 text-center text-[11px] text-slate-500">
                        No items found
                      </div>
                    ) : (
                      getUniqueColumnValues(columnKey).map(value => (
                        <label 
                          key={value} 
                          className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded cursor-pointer transition-colors"
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
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                          />
                          <span className="text-[11px] text-slate-700 truncate">
                            {value}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 rounded-b flex items-center justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearColumnFilter(columnKey)
                    }}
                    className="px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowFilterDropdown(null)
                    }}
                    className="px-3 py-1.5 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
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

  if (loading.orders) return <LoadingSpinner />

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => { setSidebarOpen(false); try { localStorage.setItem('sidebarOpen','false') } catch {} }}
        onToggle={() => setSidebarOpen(v => { const n = !v; try { localStorage.setItem('sidebarOpen', JSON.stringify(n)) } catch {}; return n })}
      />

      <main className={`flex-1 p-3 sm:p-4 lg:p-6 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'} overflow-y-auto relative`}>
        <div className="max-w-full mx-auto relative z-0">
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Pending Orders</h1>
                <p className="text-xs text-gray-500 mt-0.5">Live pending orders (ignoring market BUY/SELL)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Groups Dropdown */}
              <GroupSelector 
                moduleName="pendingorders" 
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
                onClick={fetchOrders}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                title="Refresh orders"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 relative z-0">
            <div className="bg-white rounded shadow-sm border border-blue-200 p-2">
              <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0">Total Pending Orders</p>
              <p className="text-sm font-bold text-gray-900">{cachedOrders.length}</p>
            </div>
            <div className="bg-white rounded shadow-sm border border-purple-200 p-2">
              <p className="text-[10px] font-semibold text-purple-600 uppercase mb-0">Unique Logins</p>
              <p className="text-sm font-bold text-gray-900">{new Set(cachedOrders.map(o=>o.login)).size}</p>
            </div>
            <div className="bg-white rounded shadow-sm border border-indigo-200 p-2">
              <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-0">Symbols</p>
              <p className="text-sm font-bold text-gray-900">{new Set(cachedOrders.map(o=>o.symbol)).size}</p>
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
                  className="px-3 py-2 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition-all inline-flex items-center gap-2 text-sm font-medium text-gray-700 shadow-sm"
                >
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    placeholder="Search login, symbol, order..."
                    className="pl-10 pr-10 py-2 text-sm border border-indigo-200 rounded-lg bg-white text-gray-700 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-64 shadow-sm transition-all"
                  />
                  <svg 
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" 
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
                Showing {startIndex + 1} - {Math.min(endIndex, sortedOrders.length)} of {sortedOrders.length}
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div className="flex-1">
              {displayedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                  <p className="text-gray-500 text-sm">No pending orders</p>
                </div>
              ) : (
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-blue-600 sticky top-0 shadow-md" style={{ zIndex: 10 }}>
                    <tr>
                      {renderHeaderCell('timeSetup', 'Setup', 'timeSetup')}
                      {renderHeaderCell('login', 'Login')}
                      {renderHeaderCell('order', 'Order')}
                      {renderHeaderCell('symbol', 'Symbol')}
                      {renderHeaderCell('type', 'Type')}
                      {renderHeaderCell('state', 'State')}
                      {renderHeaderCell('volume', 'Volume')}
                      {renderHeaderCell('priceOrder', 'Price')}
                      {renderHeaderCell('priceTrigger', 'Trigger')}
                      {renderHeaderCell('priceSL', 'SL', 'sl')}
                      {renderHeaderCell('priceTP', 'TP', 'tp')}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {displayedOrders.map((o, index) => {
                      const id = getOrderId(o)
                      const flash = id ? flashes[id] : undefined
                      const priceDelta = flash?.priceDelta
                      const slDelta = flash?.slDelta
                      const tpDelta = flash?.tpDelta
                      return (
                        <tr key={id ?? index} className={`hover:bg-blue-50 transition-colors`}>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{formatTime(o.timeSetup || o.timeUpdate || o.timeCreate || o.updated_at)}</td>
                          <td 
                            className="px-2 py-1.5 text-[13px] text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedLogin(o.login)
                            }}
                            title="Click to view login details"
                          >
                            {o.login}
                          </td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{id}</td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{o.symbol}</td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{o.type ?? '-'}</td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{o.state ?? '-'}</td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{formatNumber(o.volumeCurrent ?? o.volume ?? o.volumeInitial, 2)}</td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {formatNumber(o.priceOrder ?? o.price ?? o.priceOpen ?? o.priceOpenExact ?? o.open_price, 5)}
                              {priceDelta !== undefined && priceDelta !== 0 ? (
                                <span className={`ml-1 text-[11px] font-medium ${priceDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {priceDelta > 0 ? '▲' : '▼'} {Math.abs(priceDelta).toFixed(5)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{formatNumber(o.priceTrigger ?? o.trigger ?? 0, 5)}</td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {formatNumber(o.priceSL ?? o.sl ?? o.stop_loss, 5)}
                              {slDelta !== undefined && slDelta !== 0 ? (
                                <span className={`ml-1 text-[11px] font-medium ${slDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {slDelta > 0 ? '▲' : '▼'} {Math.abs(slDelta).toFixed(5)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {formatNumber(o.priceTP ?? o.tp ?? o.take_profit, 5)}
                              {tpDelta !== undefined && tpDelta !== 0 ? (
                                <span className={`ml-1 text-[11px] font-medium ${tpDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {tpDelta > 0 ? '▲' : '▼'} {Math.abs(tpDelta).toFixed(5)}
                                </span>
                              ) : null}
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

          {/* Pagination Controls - Bottom removed as per request */}

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
        availableItems={cachedOrders}
        loginField="login"
        displayField="symbol"
        secondaryField="order"
        editGroup={editingGroup}
      />

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
                  <option value="startsWith">Starts With</option>
                  <option value="endsWith">Ends With</option>
                  <option value="contains">Contains</option>
                  <option value="doesNotContain">Does Not Contain</option>
                </select>
              </div>

              {/* Value Input */}
              <div>
                <input
                  type={['startsWith', 'endsWith', 'contains', 'doesNotContain'].includes(customFilterType) ? 'text' : 'number'}
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

      {/* Client Positions Modal */}
      {selectedLogin && (
        <ClientPositionsModal
          client={{ login: selectedLogin }}
          onClose={() => setSelectedLogin(null)}
          onClientUpdate={() => {}}
          allPositionsCache={cachedPositions}
          onCacheUpdate={() => {}}
        />
      )}
    </div>
  )
}

export default PendingOrdersPage
