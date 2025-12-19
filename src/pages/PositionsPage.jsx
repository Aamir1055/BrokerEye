import { useEffect, useRef, useState, useMemo, Fragment, useDeferredValue } from 'react'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { useGroups } from '../contexts/GroupContext'
import { useIB } from '../contexts/IBContext'
import websocketService from '../services/websocket'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'
import IBSelector from '../components/IBSelector'
import PositionModule from '../components/PositionModule'

const PositionsPage = () => {
  // Mobile detection - initialize with actual window width to prevent flash
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 768
    }
    return false
  })

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Use cached data from DataContext
  const { positions: cachedPositions, orders: cachedOrders, fetchPositions, loading, connectionState } = useData()
  const { isAuthenticated } = useAuth()
  const { filterByActiveGroup, activeGroupFilters } = useGroups()
  const { filterByActiveIB, selectedIB, ibMT5Accounts } = useIB()
  
  // Track if component is mounted to prevent updates after unmount
  const isMountedRef = useRef(true)
  
  // Critical: Set unmounted flag ASAP to unblock route transitions
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const v = localStorage.getItem('sidebarOpen')
      return v ? JSON.parse(v) : false
    } catch {
      return false
    }
  })
  const [netShowColumnSelector, setNetShowColumnSelector] = useState(false)
  // Include all position module columns + NET-specific aggregations (some will render '-')
  const [netVisibleColumns, setNetVisibleColumns] = useState({
    // NET-specific columns only
    symbol: true,
    netType: true,
    netVolume: true,
    avgPrice: true,
    totalProfit: true,
    totalStorage: false,
    totalCommission: false,
    loginCount: true,
    totalPositions: true,
    variantCount: false
  })
  const toggleNetColumn = (col) => setNetVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))
  // NET Position sorting
  const [netSortColumn, setNetSortColumn] = useState(null)
  const [netSortDirection, setNetSortDirection] = useState('asc')
  // Suggestion-based search for NET view
  const [netSearchQuery, setNetSearchQuery] = useState('')
  const [netShowSuggestions, setNetShowSuggestions] = useState(false)
  const netSearchRef = useRef(null)
  const netCardFilterRef = useRef(null)
  // Card filter for NET summary cards
  const [netCardFilterOpen, setNetCardFilterOpen] = useState(false)
  const [netCardsVisible, setNetCardsVisible] = useState({
    netSymbols: true,
    totalNetVolume: true,
    totalNetPL: true,
    totalLogins: true
  })
  // NET positions column selector ref
  const netColumnSelectorRef = useRef(null)
  // Client NET controls and visibility
  const [clientNetShowColumnSelector, setClientNetShowColumnSelector] = useState(false)
  const clientNetColumnSelectorRef = useRef(null)
  const [clientNetVisibleColumns, setClientNetVisibleColumns] = useState({
    login: true,
    symbol: true,
    netType: true,
    netVolume: true,
    avgPrice: true,
    totalProfit: true,
    totalPositions: true
  })
  const toggleClientNetColumn = (col) => setClientNetVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }))
  const [clientNetCardFilterOpen, setClientNetCardFilterOpen] = useState(false)
  const [clientNetCardsVisible, setClientNetCardsVisible] = useState({
    clientNetRows: true,
    totalNetVolume: true,
    totalNetPL: true,
    totalLogins: true
  })
  // Client NET sorting
  const [clientNetSortColumn, setClientNetSortColumn] = useState(null)
  const [clientNetSortDirection, setClientNetSortDirection] = useState('asc')
  // Client NET search
  const [clientNetSearchQuery, setClientNetSearchQuery] = useState('')
  const [clientNetShowSuggestions, setClientNetShowSuggestions] = useState(false)
  const clientNetSearchRef = useRef(null)
  const clientNetCardFilterRef = useRef(null)
  
  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef(null)
  const [showDisplayMenu, setShowDisplayMenu] = useState(false)
  const displayMenuRef = useRef(null)
  const displayButtonRef = useRef(null)
  const [displayMode, setDisplayMode] = useState('value') // 'value', 'percentage', or 'both'
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    position: false,
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
    { key: 'login', label: 'Login', sticky: true },
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

  // Map base metric keys to their percentage field names from API
  const percentageFieldMap = {
    volume: 'volume_percentage',
    profit: 'profit_percentage',
    storage: 'storage_percentage'
  }

  const isMetricColumn = (key) => Object.prototype.hasOwnProperty.call(percentageFieldMap, key)

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }
  
  const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    const num = Number(value)
    if (isNaN(num)) return '-'
    return num.toFixed(2)
  }

  // Get effective visible columns based on display mode
  const getEffectiveVisibleColumns = () => {
    const effective = { ...visibleColumns }
    
    if (displayMode === 'value') {
      // Without Percentage: Hide all percentage columns
      effective.volumePercentage = false
      effective.profitPercentage = false
      effective.storagePercentage = false
    } else if (displayMode === 'percentage') {
      // Show My Percentage: Hide value columns, show only percentage columns
      effective.volume = false
      effective.profit = false
      effective.storage = false
      // Show percentage columns
      effective.volumePercentage = true
      effective.profitPercentage = true
      effective.storagePercentage = true
    } else if (displayMode === 'both') {
      // Both: Show value and percentage columns side by side
      effective.volume = true
      effective.volumePercentage = true
      effective.profit = true
      effective.profitPercentage = true
      effective.storage = true
      effective.storagePercentage = true
    }
    
    return effective
  }

  // Define string columns that should not show number filters
  const stringColumns = ['symbol', 'action', 'reason', 'comment']
  const isStringColumn = (key) => stringColumns.includes(key)

  // Column filter states
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterDropdown, setShowFilterDropdown] = useState(null)
  const filterRefs = useRef({})
  const [filterSearchQuery, setFilterSearchQuery] = useState({})
  const [showNumberFilterDropdown, setShowNumberFilterDropdown] = useState(null)
  
  // Sorting states for ALL positions view
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Search state for ALL positions view
  const [searchQuery, setSearchQuery] = useState('')
  
  // Pagination states for ALL positions view
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(() => isMobile ? 12 : 25)
  
  // NET positions toggle and grouping
  const [showNetPositions, setShowNetPositions] = useState(false)
  const [groupByBaseSymbol, setGroupByBaseSymbol] = useState(false)
  const [expandedNetKeys, setExpandedNetKeys] = useState(new Set())
  
  // NET positions pagination
  const [netCurrentPage, setNetCurrentPage] = useState(1)
  const [netItemsPerPage, setNetItemsPerPage] = useState(() => isMobile ? 12 : 25)
  
  // Client NET toggle
  const [showClientNet, setShowClientNet] = useState(false)
  
  // Group modal states
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  
  // Client positions modal state
  const [selectedLogin, setSelectedLogin] = useState(null)
  
  // Search ref for ALL positions view
  const searchRef = useRef(null)
  
  // Search suggestions state for ALL positions view
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  // Flash timeouts for row highlighting
  const flashTimeouts = useRef(new Map())
  const [flashes, setFlashes] = useState({})
  
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
    const isTimeColumn = columnKey === 'timeUpdate'
    const originalTimestamps = new Map() // Store original timestamps for sorting
    
    cachedPositions.forEach(position => {
      let value = position[columnKey]
      
      // Format timeUpdate (epoch) to dd/mm/yyyy hh:mm:ss for display in filter
      if (isTimeColumn && value) {
        const formatted = formatTime(value)
        // Only add if formatting was successful (not '-')
        if (formatted && formatted !== '-') {
          originalTimestamps.set(formatted, value) // Map formatted -> original timestamp
          value = formatted
        }
      }
      
      if (value !== null && value !== undefined && value !== '' && value !== '-') {
        values.add(value)
      }
    })
    
    const sortedValues = Array.from(values).sort((a, b) => {
      // For time column, sort by original timestamp (chronological order)
      if (isTimeColumn && originalTimestamps.has(a) && originalTimestamps.has(b)) {
        return originalTimestamps.get(b) - originalTimestamps.get(a) // Newest first
      }
      
      // For numeric values
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b
      }
      
      // For string values
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

    const isTextFilter = ['startsWith', 'endsWith', 'contains', 'doesNotContain'].includes(customFilterType)
    
    const filterConfig = {
      type: customFilterType,
      value1: isTextFilter ? customFilterValue1 : parseFloat(customFilterValue1),
      value2: customFilterValue2 ? (isTextFilter ? customFilterValue2 : parseFloat(customFilterValue2)) : null,
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

  // Check if value matches number or text filter
  const matchesNumberFilter = (value, filterConfig) => {
    if (!filterConfig) return true
    
    const { type, value1, value2 } = filterConfig

    // Handle text filters
    if (['startsWith', 'endsWith', 'contains', 'doesNotContain'].includes(type)) {
      const strValue = String(value || '').toLowerCase()
      const searchValue = String(value1 || '').toLowerCase()
      
      switch (type) {
        case 'startsWith':
          return strValue.startsWith(searchValue)
        case 'endsWith':
          return strValue.endsWith(searchValue)
        case 'contains':
          return strValue.includes(searchValue)
        case 'doesNotContain':
          return !strValue.includes(searchValue)
        default:
          return true
      }
    }

    // Handle number filters
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return false

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
      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false
      
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

    // Re-enable refresh button when positions update
    if (isRefreshing && (newCount > 0 || updateCount > 0 || deletedCount > 0)) {
      setIsRefreshing(false)
    }

    prevPositionsRef.current = cachedPositions
  }, [cachedPositions, isRefreshing])
  
  // Close suggestions when clicking outside
  useEffect(() => { if (!isAuthenticated) return;
    const handleClickOutside = (event) => {
      if (!isMountedRef.current) return
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
      if (displayMenuRef.current && !displayMenuRef.current.contains(event.target) &&
          displayButtonRef.current && !displayButtonRef.current.contains(event.target)) {
        setShowDisplayMenu(false)
      }
      if (netSearchRef.current && !netSearchRef.current.contains(event.target)) {
        setNetShowSuggestions(false)
      }
      if (clientNetSearchRef.current && !clientNetSearchRef.current.contains(event.target)) {
        setClientNetShowSuggestions(false)
      }
      if (netCardFilterRef.current && !netCardFilterRef.current.contains(event.target)) {
        setNetCardFilterOpen(false)
      }
      if (clientNetCardFilterRef.current && !clientNetCardFilterRef.current.contains(event.target)) {
        setClientNetCardFilterOpen(false)
      }
      if (netColumnSelectorRef.current && !netColumnSelectorRef.current.contains(event.target)) {
        setNetShowColumnSelector(false)
      }
      if (clientNetColumnSelectorRef.current && !clientNetColumnSelectorRef.current.contains(event.target)) {
        setClientNetShowColumnSelector(false)
      }
    }
    const handleKeyDown = (event) => {
      if (!isMountedRef.current) return
      if (event.key === 'Escape') {
        if (showDisplayMenu) setShowDisplayMenu(false)
        if (showColumnSelector) setShowColumnSelector(false)
        if (netShowSuggestions) setNetShowSuggestions(false)
        if (clientNetShowSuggestions) setClientNetShowSuggestions(false)
        if (netCardFilterOpen) setNetCardFilterOpen(false)
        if (clientNetCardFilterOpen) setClientNetCardFilterOpen(false)
        if (netShowColumnSelector) setNetShowColumnSelector(false)
        if (clientNetShowColumnSelector) setClientNetShowColumnSelector(false)
      }
    }

    if (showDisplayMenu || showColumnSelector || netShowSuggestions || clientNetShowSuggestions || netCardFilterOpen || clientNetCardFilterOpen || netShowColumnSelector || clientNetShowColumnSelector) {
      document.addEventListener('mousedown', handleClickOutside, true)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside, true)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [showDisplayMenu, showColumnSelector, netShowSuggestions, clientNetShowSuggestions, netCardFilterOpen, clientNetCardFilterOpen, netShowColumnSelector, clientNetShowColumnSelector, isAuthenticated])

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

  // Get card icon path based on card title
  const getCardIcon = (cardTitle) => {
    const iconMap = {
      'Total Positions': '/Desktop cards icons/Total Clients.svg',
      'Floating Profit': '/Desktop cards icons/Floating.svg',
      'Floating Profit %': '/Desktop cards icons/Floating.svg',
      'Unique Logins': '/Desktop cards icons/Total Clients.svg',
      'Symbols': '/Desktop cards icons/Total Clients.svg',
      // NET Position cards
      'NET Symbols': '/Desktop cards icons/Total Clients.svg',
      'Total NET Volume': '/Desktop cards icons/Total Balance.svg',
      'Total NET P/L': '/Desktop cards icons/PNL.svg',
      'Total Logins': '/Desktop cards icons/Total Clients.svg',
      // Client NET cards
      'Client NET Rows': '/Desktop cards icons/Total Clients.svg',
    }
    return iconMap[cardTitle] || '/Desktop cards icons/Total Clients.svg'
  }

  // Helper function to adjust value for USC symbols (divide by 100)
  const adjustValueForSymbol = (value, symbol) => {
    if (!symbol || value === null || value === undefined) return value
    const symbolStr = String(symbol).toUpperCase()
    if (symbolStr.includes('USC')) {
      return Number(value) / 100
    }
    return value
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

  // Normalize action label and chip classes to match Live Dealing
  const getActionLabel = (action) => {
    if (action === 0 || action === '0') return 'Buy'
    if (action === 1 || action === '1') return 'Sell'
    const s = String(action || '').toLowerCase()
    if (s.includes('buy')) return 'Buy'
    if (s.includes('sell')) return 'Sell'
    return String(action || '-')
  }
  const getActionChipClasses = (action) => {
    const s = String(action ?? '').toLowerCase()
    const isBuy = action === 0 || action === '0' || s.includes('buy')
    return isBuy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  // Calculate NET positions for all clients with reversed type display
  // Robust to multiple action encodings: 0/1, 'Buy'/'Sell', 'BUY'/'SELL', 'buy'/'sell'
  const calculateGlobalNetPositions = (positions) => {
    if (!positions || positions.length === 0) return []

    const symbolMap = new Map()
    const getBaseSymbol = (s) => {
      if (!s || typeof s !== 'string') return s
      // Split on first dot or hyphen to collapse variants like XAUUSD.f, XAUUSD-z, etc.
      const parts = s.split(/[\.\-]/)
      return parts[0] || s
    }

    positions.forEach(pos => {
      const symbol = pos.symbol
      if (!symbol) return
      const key = groupByBaseSymbol ? getBaseSymbol(symbol) : symbol

      if (!symbolMap.has(key)) {
        symbolMap.set(key, {
          key, // grouping key (base or exact)
          buyPositions: [],
          sellPositions: [],
          logins: new Set(),
          variantMap: new Map() // exactSymbol -> { buyPositions:[], sellPositions:[] }
        })
      }

      const group = symbolMap.get(key)
      group.logins.add(pos.login)

      // If symbol ends with 'c' or 'C' (cent symbols), scale monetary fields by 1/100
      const isCent = /[cC]$/.test(symbol)
      const adj = isCent
        ? {
            ...pos,
            profit: (pos.profit || 0) / 100,
            storage: (pos.storage || 0) / 100,
            commission: (pos.commission || 0) / 100
          }
        : pos

      // Normalize action to handle various formats from API/WS
      const rawAction = adj.action
      let actionNorm = null
      if (rawAction === 0 || rawAction === '0') actionNorm = 'buy'
      else if (rawAction === 1 || rawAction === '1') actionNorm = 'sell'
      else if (typeof rawAction === 'string') actionNorm = rawAction.toLowerCase()

      if (actionNorm === 'buy') {
        group.buyPositions.push(adj)
      } else if (actionNorm === 'sell') {
        group.sellPositions.push(adj)
      } else {
        // Fallback: try to infer from sign conventions if available
        // If action cannot be determined, skip adding to buy/sell buckets
      }

      // Track exact symbol variants when grouping by base
      if (groupByBaseSymbol) {
        const exact = symbol
        if (!group.variantMap.has(exact)) {
          group.variantMap.set(exact, { buyPositions: [], sellPositions: [] })
        }
        const v = group.variantMap.get(exact)
        if (actionNorm === 'buy') v.buyPositions.push(adj)
        else if (actionNorm === 'sell') v.sellPositions.push(adj)
      }
    })

    const netPositionsData = []

    symbolMap.forEach(group => {
      const buyVolume = group.buyPositions.reduce((sum, p) => sum + (p.volume || 0), 0)
      const sellVolume = group.sellPositions.reduce((sum, p) => sum + (p.volume || 0), 0)
      const netVolume = buyVolume - sellVolume

      if (netVolume === 0) return

  let totalWeightedPrice = 0
  let totalVolume = 0
  let totalProfit = 0
  let totalStorage = 0
  let totalCommission = 0

      if (netVolume > 0) {
        // Net Buy - use buy positions for average
        group.buyPositions.forEach(p => {
          const vol = p.volume || 0
          const price = p.priceOpen || 0
          totalWeightedPrice += price * vol
          totalVolume += vol
          totalProfit += p.profit || 0
          totalStorage += p.storage || 0
          totalCommission += p.commission || 0
        })
      } else {
        // Net Sell - use sell positions for average
        group.sellPositions.forEach(p => {
          const vol = p.volume || 0
          const price = p.priceOpen || 0
          totalWeightedPrice += price * vol
          totalVolume += vol
          totalProfit += p.profit || 0
          totalStorage += p.storage || 0
          totalCommission += p.commission || 0
        })
      }

      const avgPrice = totalVolume > 0 ? totalWeightedPrice / totalVolume : 0
      
      // Reversed type: if net is Buy, show Sell (what action to take to close)
      const netType = netVolume > 0 ? 'Sell' : 'Buy'
      const loginCount = group.logins.size
      const totalPositions = group.buyPositions.length + group.sellPositions.length

      // Build variant breakdown when grouping by base symbol
      let variantCount = 1
      let variants = []
      if (groupByBaseSymbol) {
        variantCount = group.variantMap.size
        variants = Array.from(group.variantMap.entries()).map(([exact, data]) => {
          const vBuyVol = data.buyPositions.reduce((s, p) => s + (p.volume || 0), 0)
          const vSellVol = data.sellPositions.reduce((s, p) => s + (p.volume || 0), 0)
          const vNet = vBuyVol - vSellVol
          if (vNet === 0) return null
          let tw = 0, tv = 0, tp = 0, ts = 0, tc = 0
          const use = vNet > 0 ? data.buyPositions : data.sellPositions
          use.forEach(p => { const vol = p.volume || 0; const price = p.priceOpen || 0; tw += price * vol; tv += vol; tp += p.profit || 0; ts += p.storage || 0; tc += p.commission || 0 })
          const vAvg = tv > 0 ? tw / tv : 0
          return {
            exactSymbol: exact,
            netType: vNet > 0 ? 'Sell' : 'Buy',
            netVolume: Math.abs(vNet),
            avgPrice: vAvg,
            totalProfit: tp,
            totalStorage: ts,
            totalCommission: tc
          }
        }).filter(Boolean)
      }

      netPositionsData.push({
        symbol: group.key,
        netType,
        netVolume: Math.abs(netVolume),
        avgPrice,
        totalProfit,
        totalStorage,
        totalCommission,
        loginCount,
        totalPositions,
        variantCount,
        variants
      })
    })

    return netPositionsData.sort((a, b) => b.netVolume - a.netVolume)
  }

  // Generate pagination options; ensure common sizes always present for stable UI
  const generatePageSizeOptions = () => {
    const base = [25, 50, 100, 200, 500]
    return base
  }
  
  const pageSizeOptions = generatePageSizeOptions()
  
  // Generate NET Position page size options based on data count
  const generateNetPageSizeOptions = () => {
    const base = [25, 50, 100, 200]
    const totalCount = netFilteredPositions.length
    
    // Only include options that are less than or equal to total count
    const validOptions = base.filter(size => size < totalCount)
    
    // If total count is greater than 0 and not already in the list, add it
    if (totalCount > 0 && !base.includes(totalCount)) {
      validOptions.push(totalCount)
    } else if (totalCount > 0 && totalCount <= 200) {
      // If total is a base number, include it
      if (!validOptions.includes(totalCount)) {
        validOptions.push(totalCount)
      }
    }
    
    return validOptions.length > 0 ? validOptions.sort((a, b) => a - b) : [25]
  }
  
  // Generate Client NET page size options based on data count
  const generateClientNetPageSizeOptions = () => {
    const base = [25, 50, 100, 200]
    const totalCount = clientNetFilteredPositions.length
    
    // Only include options that are less than or equal to total count
    const validOptions = base.filter(size => size < totalCount)
    
    // If total count is greater than 0 and not already in the list, add it
    if (totalCount > 0 && !base.includes(totalCount)) {
      validOptions.push(totalCount)
    } else if (totalCount > 0 && totalCount <= 200) {
      // If total is a base number, include it
      if (!validOptions.includes(totalCount)) {
        validOptions.push(totalCount)
      }
    }
    
    return validOptions.length > 0 ? validOptions.sort((a, b) => a - b) : [25]
  }
  
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
  
  // Defer heavy list processing so route changes remain responsive
  const deferredPositions = useDeferredValue(cachedPositions)

  // Memoize filtered and sorted positions to prevent blocking on navigation
  const { sortedPositions, ibFilteredPositions } = useMemo(() => {
    // Return empty arrays if not authenticated to avoid unnecessary processing
    if (!isAuthenticated) {
      return { sortedPositions: [], ibFilteredPositions: [] }
    }
    
    const searchedPositions = searchPositions(deferredPositions)
    
    // Apply IB filter first (cumulative order: IB -> Group)
    let ibFiltered = filterByActiveIB(searchedPositions, 'login')
    
    // Apply group filter on top of IB filter
    let groupFilteredPositions = filterByActiveGroup(ibFiltered, 'login', 'positions')
    
    // Continue with groupFilteredPositions as ibFiltered for consistency
    ibFiltered = groupFilteredPositions
    
    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, values]) => {
      if (columnKey.endsWith('_number')) {
        // Number filter
        const actualColumnKey = columnKey.replace('_number', '')
        ibFiltered = ibFiltered.filter(position => {
          const positionValue = position[actualColumnKey]
          return matchesNumberFilter(positionValue, values)
        })
      } else if (values && values.length > 0) {
        // Regular checkbox filter
        ibFiltered = ibFiltered.filter(position => {
          let positionValue = position[columnKey]
          
          // For timeUpdate, format to match displayed format in filter
          if (columnKey === 'timeUpdate' && positionValue) {
            const formatted = formatTime(positionValue)
            if (formatted && formatted !== '-') {
              positionValue = formatted
            }
          }
          
          return values.includes(positionValue)
        })
      }
    })
    
    const sorted = sortPositions(ibFiltered)
    
    return { sortedPositions: sorted, ibFilteredPositions: ibFiltered }
  }, [deferredPositions, searchQuery, columnFilters, sortColumn, sortDirection, isAuthenticated, filterByActiveGroup, activeGroupFilters, filterByActiveIB, selectedIB, ibMT5Accounts])

  // Memoized summary statistics - based on filtered positions
  const summaryStats = useMemo(() => {
    const totalPositions = ibFilteredPositions.length
    const totalFloatingProfit = ibFilteredPositions.reduce((sum, p) => sum + (p.profit || 0), 0)
    const totalFloatingProfitPercentage = ibFilteredPositions.reduce((sum, p) => sum + (p.profit_percentage || 0), 0)
    const uniqueLogins = new Set(ibFilteredPositions.map(p => p.login)).size
    const uniqueSymbols = new Set(ibFilteredPositions.map(p => p.symbol)).size
    
    return {
      totalPositions,
      totalFloatingProfit,
      totalFloatingProfitPercentage,
      uniqueLogins,
      uniqueSymbols
    }
  }, [ibFilteredPositions])
  
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
  const totalPages = Math.ceil(sortedPositions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const displayedPositions = sortedPositions.slice(startIndex, endIndex)
  
  // Reset to page 1 when items per page changes
  useEffect(() => { if (!isAuthenticated) return;
    setCurrentPage(1)
  }, [itemsPerPage])

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isMountedRef.current) return
      if (showFilterDropdown && filterRefs.current[showFilterDropdown]) {
        if (!filterRefs.current[showFilterDropdown].contains(event.target)) {
          setShowFilterDropdown(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown])
  
  // Calculate NET positions using useMemo - use cachedPositions for all data
  const netPositionsData = useMemo(() => {
    if (!showNetPositions) return []
    return calculateGlobalNetPositions(deferredPositions)
  }, [showNetPositions, deferredPositions, groupByBaseSymbol])

  // NET suggestions
  const getNetSuggestions = () => {
    if (!netSearchQuery.trim()) return []
    const q = netSearchQuery.toLowerCase().trim()
    const s = new Set()
    netPositionsData.forEach(row => {
      if (String(row.symbol || '').toLowerCase().includes(q)) s.add(`Symbol: ${row.symbol}`)
      if (String(row.netType || '').toLowerCase().includes(q)) s.add(`NET Type: ${row.netType}`)
    })
    return Array.from(s).slice(0, 10)
  }
  const handleNetSuggestionClick = (suggestion) => {
    const value = suggestion.split(': ')[1]
    setNetSearchQuery(value)
    setNetShowSuggestions(false)
  }
  const handleNetSearchKeyDown = (e) => { if (e.key === 'Enter') setNetShowSuggestions(false) }

  // NET Position sorting handler
  const handleNetSort = (columnKey) => {
    if (netSortColumn === columnKey) {
      setNetSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setNetSortColumn(columnKey)
      setNetSortDirection('asc')
    }
  }

  const netFilteredPositions = useMemo(() => {
    let filtered = netPositionsData
    
    // Apply search filter
    if (netSearchQuery.trim()) {
      const q = netSearchQuery.toLowerCase().trim()
      filtered = filtered.filter(row =>
        String(row.symbol || '').toLowerCase().includes(q) || String(row.netType || '').toLowerCase().includes(q)
      )
    }
    
    // Apply sorting
    if (netSortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[netSortColumn]
        const bVal = b[netSortColumn]
        
        // Handle null/undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        
        // Numeric comparison
        const aNum = Number(aVal)
        const bNum = Number(bVal)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return netSortDirection === 'asc' ? aNum - bNum : bNum - aNum
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        return netSortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
      })
    }
    
    return filtered
  }, [netSearchQuery, netPositionsData, netSortColumn, netSortDirection])

  // Pagination logic specific to NET module
  const netTotalPages = netItemsPerPage === 'All' ? 1 : Math.ceil(netFilteredPositions.length / netItemsPerPage)
  const netStartIndex = netItemsPerPage === 'All' ? 0 : (netCurrentPage - 1) * netItemsPerPage
  const netEndIndex = netItemsPerPage === 'All' ? netFilteredPositions.length : netStartIndex + netItemsPerPage
  const netDisplayedPositions = netFilteredPositions.slice(netStartIndex, netEndIndex)
  useEffect(() => { if (!isAuthenticated) return; setNetCurrentPage(1) }, [netItemsPerPage])
  const handleNetPageChange = (p) => { setNetCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const handleNetItemsPerPageChange = (v) => {
    const next = v === 'All' ? 'All' : parseInt(v)
    setNetItemsPerPage(next)
    try { localStorage.setItem('net_items_per_page', String(next)) } catch {}
    setNetCurrentPage(1)
  }

  // Calculate Client NET positions (group first by login then by symbol)
  const clientNetPositionsData = useMemo(() => {
    if (!showClientNet) return []
    if (!cachedPositions || cachedPositions.length === 0) return []

    // Map: login -> symbolKey -> aggregation buckets
    const loginMap = new Map()
    const getBaseSymbol = (s) => {
      if (!s || typeof s !== 'string') return s
      const parts = s.split(/[\.\-]/)
      return parts[0] || s
    }

    cachedPositions.forEach(pos => {
      const login = pos.login
      const symbol = pos.symbol
      if (login == null || !symbol) return
      if (!loginMap.has(login)) loginMap.set(login, new Map())
      const symbolKey = groupByBaseSymbol ? getBaseSymbol(symbol) : symbol
      const symMap = loginMap.get(login)
      if (!symMap.has(symbolKey)) {
        symMap.set(symbolKey, {
          buyPositions: [],
          sellPositions: [],
          variantMap: new Map() // exact -> {buyPositions:[], sellPositions:[]}
        })
      }
      const bucket = symMap.get(symbolKey)

      // Cent scaling logic reused (symbols ending with c/C)
      const isCent = /[cC]$/.test(symbol)
      const adj = isCent ? { ...pos, profit: (pos.profit||0)/100, storage:(pos.storage||0)/100, commission:(pos.commission||0)/100 } : pos

      let actionNorm = null
      const raw = adj.action
      if (raw === 0 || raw === '0') actionNorm = 'buy'
      else if (raw === 1 || raw === '1') actionNorm = 'sell'
      else if (typeof raw === 'string') actionNorm = raw.toLowerCase()

      if (actionNorm === 'buy') bucket.buyPositions.push(adj)
      else if (actionNorm === 'sell') bucket.sellPositions.push(adj)

      if (groupByBaseSymbol) {
        const exact = symbol
        if (!bucket.variantMap.has(exact)) bucket.variantMap.set(exact, { buyPositions: [], sellPositions: [] })
        const v = bucket.variantMap.get(exact)
        if (actionNorm === 'buy') v.buyPositions.push(adj)
        else if (actionNorm === 'sell') v.sellPositions.push(adj)
      }
    })

    const rows = []
    loginMap.forEach((symMap, login) => {
      symMap.forEach((bucket, key) => {
        const buyVol = bucket.buyPositions.reduce((s,p)=>s+(p.volume||0),0)
        const sellVol = bucket.sellPositions.reduce((s,p)=>s+(p.volume||0),0)
        const netVol = buyVol - sellVol
        if (netVol === 0) return
        let tw=0,tv=0,tp=0
        const use = netVol>0 ? bucket.buyPositions : bucket.sellPositions
        use.forEach(p=>{const v=p.volume||0; const pr=p.priceOpen||0; tw+=pr*v; tv+=v; tp+=p.profit||0})
        const avg = tv>0? tw/tv : 0
        const netType = netVol>0? 'Buy':'Sell' // fixed: when more buy volume, show Buy
        let variantCount=1, variants=[]
        if (groupByBaseSymbol){
          variantCount = bucket.variantMap.size
          variants = Array.from(bucket.variantMap.entries()).map(([exact,data]) => {
            const bv = data.buyPositions.reduce((s,p)=>s+(p.volume||0),0)
            const sv = data.sellPositions.reduce((s,p)=>s+(p.volume||0),0)
            const nv = bv - sv
            if (nv===0) return null
            let tw2=0,tv2=0,tp2=0
            const use2 = nv>0? data.buyPositions : data.sellPositions
            use2.forEach(p=>{const v=p.volume||0; const pr=p.priceOpen||0; tw2+=pr*v; tv2+=v; tp2+=p.profit||0})
            const avg2 = tv2>0? tw2/tv2:0
            return { exactSymbol: exact, netType: nv>0? 'Buy':'Sell', netVolume: Math.abs(nv), avgPrice: avg2, totalProfit: tp2 }
          }).filter(Boolean)
        }
  // Add totalPositions count (buy + sell) so Client NET Positions column is populated
  const totalPositions = bucket.buyPositions.length + bucket.sellPositions.length
  rows.push({ login, symbol: key, netType, netVolume: Math.abs(netVol), avgPrice: avg, totalProfit: tp, totalPositions, variantCount, variants })
      })
    })
    // Sort by login then volume desc for stability
    return rows.sort((a,b)=> a.login === b.login ? b.netVolume - a.netVolume : String(a.login).localeCompare(String(b.login)))
  }, [showClientNet, cachedPositions, groupByBaseSymbol])

  // Client NET pagination
  const [clientNetCurrentPage, setClientNetCurrentPage] = useState(1)
  const [clientNetItemsPerPage, setClientNetItemsPerPage] = useState(() => {
    try {
      const saved = localStorage.getItem('client_net_items_per_page')
      if (saved) return saved === 'All' ? 'All' : parseInt(saved)
      return 100
    } catch {
      return 100
    }
  })
  // Client NET search suggestions and filtering
  const getClientNetSuggestions = () => {
    if (!clientNetSearchQuery.trim()) return []
    const q = clientNetSearchQuery.toLowerCase().trim()
    const s = new Set()
    clientNetPositionsData.forEach(row => {
      if (String(row.login || '').toLowerCase().includes(q)) s.add(`Login: ${row.login}`)
      if (String(row.symbol || '').toLowerCase().includes(q)) s.add(`Symbol: ${row.symbol}`)
      if (String(row.netType || '').toLowerCase().includes(q)) s.add(`NET Type: ${row.netType}`)
    })
    return Array.from(s).slice(0, 10)
  }
  const handleClientNetSuggestionClick = (suggestion) => {
    const value = suggestion.split(': ')[1]
    setClientNetSearchQuery(value)
    setClientNetShowSuggestions(false)
  }
  const handleClientNetSearchKeyDown = (e) => { if (e.key === 'Enter') setClientNetShowSuggestions(false) }

  // Client NET sorting handler
  const handleClientNetSort = (columnKey) => {
    if (clientNetSortColumn === columnKey) {
      setClientNetSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setClientNetSortColumn(columnKey)
      setClientNetSortDirection('asc')
    }
  }

  const clientNetFilteredPositions = useMemo(() => {
    let filtered = clientNetPositionsData
    
    // Apply search filter
    if (clientNetSearchQuery.trim()) {
      const q = clientNetSearchQuery.toLowerCase().trim()
      filtered = filtered.filter(row =>
        String(row.login || '').toLowerCase().includes(q) ||
        String(row.symbol || '').toLowerCase().includes(q) ||
        String(row.netType || '').toLowerCase().includes(q)
      )
    }
    
    // Apply sorting
    if (clientNetSortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[clientNetSortColumn]
        const bVal = b[clientNetSortColumn]
        
        // Handle null/undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        
        // Numeric comparison
        const aNum = Number(aVal)
        const bNum = Number(bVal)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return clientNetSortDirection === 'asc' ? aNum - bNum : bNum - aNum
        }
        
        // String comparison
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        return clientNetSortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
      })
    }
    
    return filtered
  }, [clientNetSearchQuery, clientNetPositionsData, clientNetSortColumn, clientNetSortDirection])

  const clientNetTotalPages = clientNetItemsPerPage === 'All' ? 1 : Math.ceil(clientNetFilteredPositions.length / clientNetItemsPerPage)
  const clientNetStartIndex = clientNetItemsPerPage === 'All' ? 0 : (clientNetCurrentPage - 1) * clientNetItemsPerPage
  const clientNetEndIndex = clientNetItemsPerPage === 'All' ? clientNetFilteredPositions.length : clientNetStartIndex + clientNetItemsPerPage
  const clientNetDisplayedPositions = clientNetFilteredPositions.slice(clientNetStartIndex, clientNetEndIndex)
  useEffect(() => { if (!isAuthenticated) return; setClientNetCurrentPage(1) }, [clientNetItemsPerPage])
  const handleClientNetPageChange = (p) => { setClientNetCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const handleClientNetItemsPerPageChange = (v) => {
    const next = v === 'All' ? 'All' : parseInt(v)
    setClientNetItemsPerPage(next)
    try { localStorage.setItem('client_net_items_per_page', String(next)) } catch {}
    setClientNetCurrentPage(1)
  }

  // CSV helpers and export handlers
  const toCSV = (rows, headers) => {
    if (!rows || rows.length === 0) return headers.map(h => h.label).join(',')
    const esc = (v) => {
      if (v === null || v === undefined) return ''
      let s = String(v)
      s = s.replace(/"/g, '""')
      if (/[",\n]/.test(s)) s = '"' + s + '"'
      return s
    }
    const headerRow = headers.map(h => h.label).join(',')
    const body = rows.map(r => headers.map(h => esc(h.accessor ? h.accessor(r) : r[h.key])).join(',')).join('\n')
    return headerRow + '\n' + body
  }

  const downloadFile = (filename, content, mime = 'text/csv;charset=utf-8') => {
    try {
      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('CSV download failed:', e)
    }
  }

  const handleExportPositions = () => {
    const effectiveCols = getEffectiveVisibleColumns()
    const order = [
      'time','login','position','symbol','action','volume','volumePercentage','priceOpen','priceCurrent','sl','tp','profit','profitPercentage','storage','storagePercentage','appliedPercentage','reason','comment','commission'
    ]
    const labelMap = {
      time: 'Time',
      login: 'Login',
      position: 'Position',
      symbol: 'Symbol',
      action: 'Action',
      volume: 'Volume',
      volumePercentage: 'Volume %',
      priceOpen: 'Open',
      priceCurrent: 'Current',
      sl: 'S/L',
      tp: 'T/P',
      profit: 'Profit',
      profitPercentage: 'Profit %',
      storage: 'Storage',
      storagePercentage: 'Storage %',
      appliedPercentage: 'Applied %',
      reason: 'Reason',
      comment: 'Comment',
      commission: 'Commission'
    }
    const accessors = {
      time: (p) => formatTime(p.timeUpdate || p.timeCreate),
      login: (p) => p.login,
      position: (p) => p.position,
      symbol: (p) => p.symbol,
      action: (p) => p.action,
      volume: (p) => p.volume,
      volumePercentage: (p) => p.volume_percentage,
      priceOpen: (p) => p.priceOpen,
      priceCurrent: (p) => p.priceCurrent,
      sl: (p) => p.priceSL,
      tp: (p) => p.priceTP,
      profit: (p) => p.profit,
      profitPercentage: (p) => p.profit_percentage,
      storage: (p) => p.storage,
      storagePercentage: (p) => p.storage_percentage,
      appliedPercentage: (p) => p.applied_percentage,
      reason: (p) => p.reason,
      comment: (p) => p.comment,
      commission: (p) => p.commission
    }
    const headers = order
      .filter(k => effectiveCols[k])
      .map(k => ({ key: k, label: labelMap[k], accessor: accessors[k] }))
    const csv = toCSV(sortedPositions, headers)
    downloadFile(`positions_${Date.now()}.csv`, csv)
  }

  const handleExportNetPositions = () => {
    const headers = [
      { key: 'symbol', label: 'Symbol' },
      { key: 'netType', label: 'NET Type' },
      { key: 'netVolume', label: 'NET Volume' },
      { key: 'avgPrice', label: 'Avg Price' },
      { key: 'totalProfit', label: 'Total Profit' },
      { key: 'loginCount', label: 'Logins' },
      { key: 'totalPositions', label: 'Positions' }
    ]
    const csv = toCSV(netFilteredPositions, headers)
    downloadFile(`net_positions_${Date.now()}.csv`, csv)
  }

  // NET table dynamic columns: order, labels, and cell renderers
  const netColumnOrder = [
    'symbol','netType','netVolume','avgPrice','totalProfit','totalStorage','totalCommission','loginCount','totalPositions','variantCount'
  ]
  const netColumnLabels = {
    symbol: 'Symbol',
    netType: 'NET Type',
    netVolume: 'NET Volume',
    avgPrice: 'Avg Price',
    totalProfit: 'Total Profit',
    totalStorage: 'Total Storage',
    totalCommission: 'Total Commission',
    loginCount: 'Logins',
    totalPositions: 'Positions',
    variantCount: 'Variant Count'
  }
  const renderNetCell = (key, netPos) => {
    switch (key) {
      case 'symbol':
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-sm font-medium text-gray-900">{netPos.symbol}</span>
            {groupByBaseSymbol && netPos.variantCount > 1 && (
              <>
                <span className="text-[11px] text-gray-500">(+{netPos.variantCount - 1} variants)</span>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() => {
                    const next = new Set(expandedNetKeys)
                    if (next.has(netPos.symbol)) next.delete(netPos.symbol); else next.add(netPos.symbol)
                    setExpandedNetKeys(next)
                  }}
                >
                  {expandedNetKeys.has(netPos.symbol) ? 'Hide variants' : 'Show variants'}
                </button>
              </>
            )}
          </div>
        )
      case 'netType':
        return (
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${netPos.netType === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{netPos.netType}</span>
        )
      case 'netVolume':
        return formatNumber(netPos.netVolume, 2)
      case 'avgPrice':
        return formatNumber(netPos.avgPrice, 5)
      case 'totalProfit':
      case 'profit': {
        const val = key === 'profit' ? netPos.totalProfit : netPos.totalProfit
        return (
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${val >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{formatNumber(val, 2)}</span>
        )
      }
      case 'totalStorage':
      case 'storage':
        return formatNumber(netPos.totalStorage ?? '-', 2)
      case 'totalCommission':
      case 'commission':
        return formatNumber(netPos.totalCommission ?? '-', 2)
      case 'loginCount':
        return netPos.loginCount
      case 'totalPositions':
        return netPos.totalPositions
      case 'variantCount':
        return netPos.variantCount
      default:
        return String(netPos[key] ?? '-')
    }
  }

  const handleExportClientNetPositions = () => {
    const headers = [
      { key: 'login', label: 'Login' },
      { key: 'symbol', label: 'Symbol' },
      { key: 'netType', label: 'NET Type' },
      { key: 'netVolume', label: 'NET Volume' },
      { key: 'avgPrice', label: 'Avg Price' },
      { key: 'totalProfit', label: 'Total Profit' }
    ]
    const csv = toCSV(clientNetPositionsData, headers)
    downloadFile(`client_net_${Date.now()}.csv`, csv)
  }
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleItemsPerPageChange = (value) => {
    const numValue = parseInt(value)
    setItemsPerPage(numValue)
    try { localStorage.setItem('positions_items_per_page', String(numValue)) } catch {}
    setCurrentPage(1)
  }

  // Helper function to render table header with filter and single-click sorting
  const renderHeaderCell = (columnKey, label, sortKey = null) => {
    const filterCount = getActiveFilterCount(columnKey)
    const actualSortKey = sortKey || columnKey
    
    return (
      <th className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider transition-all select-none group">
        <div className="flex items-center gap-1 justify-between">
          <div 
            className="flex items-center gap-1 cursor-pointer flex-1 text-white"
            onClick={() => handleSort(actualSortKey)}
          >
            <span className="text-white">{label}</span>
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

                {/* Quick Clear Filter (top like Syncfusion) */}
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

  // Only show local loading inside cards/tables; keep the page chrome interactive
  const isInitialPositionsLoading = loading.positions && (!cachedPositions || cachedPositions.length === 0)

  // Early return for mobile - render mobile component
  if (isMobile) {
    return (
      <div className="w-full min-h-screen bg-neutral-900/5">
        <PositionModule />
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => { setSidebarOpen(false); try { localStorage.setItem('sidebarOpen', JSON.stringify(false)) } catch {} }}
        onToggle={() => setSidebarOpen(v => { const n = !v; try { localStorage.setItem('sidebarOpen', JSON.stringify(n)) } catch {}; return n })}
      />

      <main className={`flex-1 p-4 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'} flex flex-col overflow-hidden bg-[#F8FAFC]`}>
        <div className="max-w-full mx-auto w-full flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="mb-4">
          {/* Header with title and buttons on same line */}
          <div className="flex items-center justify-between mb-6">
            {/* Title Section */}
            <div>
              <h1 className="text-2xl font-bold text-[#1F2937]">Positions</h1>
              <p className="text-sm text-[#6B7280] mt-0.5">Live open positions across all accounts</p>
            </div>

            {/* Action Buttons - All on right side */}
            <div className="flex items-center gap-2">
              {/* IB Filter Button */}
              <IBSelector />
              
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
              
              {/* NET Position Toggle */}
              <button
                onClick={() => { setShowNetPositions((v)=>{const nv=!v; if (nv) setShowClientNet(false); return nv}); }}
                className={`h-8 px-2.5 rounded-lg border shadow-sm transition-colors inline-flex items-center gap-1.5 text-xs font-medium ${
                  showNetPositions 
                    ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                    : 'bg-white text-[#374151] border-[#E5E7EB] hover:bg-gray-50'
                }`}
                title="Toggle NET Position View"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                NET Position
              </button>

              {/* Client NET Toggle */}
              <button
                onClick={() => { setShowClientNet((v)=>{const nv=!v; if (nv) setShowNetPositions(false); return nv}); }}
                className={`h-8 px-2.5 rounded-lg border shadow-sm transition-colors inline-flex items-center gap-1.5 text-xs font-medium ${
                  showClientNet 
                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' 
                    : 'bg-white text-[#374151] border-[#E5E7EB] hover:bg-gray-50'
                }`}
                title="Toggle Client NET View"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-5m0 5l-5-5M7 4h10a2 2 0 012 2v6H5V6a2 2 0 012-2zm0 0V2m0 2v2" />
                </svg>
                Client Net
              </button>

              {/* Percentage View Dropdown */}
              <div className="relative">
                <button
                  ref={displayButtonRef}
                  onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                  className="h-8 px-2.5 rounded-lg border border-[#E5E7EB] bg-white hover:bg-gray-50 shadow-sm transition-colors inline-flex items-center gap-1.5 text-xs font-medium text-[#374151]"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  %
                </button>
                {showDisplayMenu && (
                  <div
                    ref={displayMenuRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-2 z-50 w-56"
                  >
                    <div className="px-3 py-2 border-b border-[#F3F4F6]">
                      <p className="text-xs font-semibold text-[#1F2937]">Display Mode</p>
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      <label className="flex items-center gap-2 text-sm text-[#374151] hover:bg-gray-50 p-2 rounded cursor-pointer transition-colors">
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
                      <label className="flex items-center gap-2 text-sm text-[#374151] hover:bg-gray-50 p-2 rounded cursor-pointer transition-colors">
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
                      <label className="flex items-center gap-2 text-sm text-[#374151] hover:bg-gray-50 p-2 rounded cursor-pointer transition-colors">
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

              {/* Export CSV */}
              <button
                onClick={handleExportPositions}
                className="h-8 w-8 rounded-lg bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
                title="Export current positions to CSV"
              >
                <svg className="w-4 h-4 text-[#374151]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-3-3m3 3l3-3M4 20h16"/>
                </svg>
              </button>
              
              <button
                onClick={() => {
                  if (isRefreshing) return
                  console.log('[Positions] Requesting fresh position snapshot from WebSocket...')
                  setIsRefreshing(true)
                  websocketService.send({
                    type: 'GET_POSITIONS',
                    action: 'snapshot'
                  })
                  // Auto re-enable after 3 seconds as fallback
                  setTimeout(() => {
                    setIsRefreshing(false)
                  }, 3000)
                }}
                disabled={isRefreshing}
                className={`h-8 w-8 rounded-lg border shadow-sm flex items-center justify-center transition-all ${
                  isRefreshing 
                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50' 
                    : 'bg-white border-[#E5E7EB] hover:bg-gray-50 cursor-pointer'
                }`}
                title={isRefreshing ? "Refreshing..." : "Refresh positions from WebSocket"}
              >
                <svg 
                  className={`w-4 h-4 text-[#374151] ${isRefreshing ? 'animate-spin' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats Summary - Client2 Face Card Design */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total Positions</span>
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                  <img 
                    src={getCardIcon('Total Positions')} 
                    alt="Total Positions"
                    style={{ width: '100%', height: '100%' }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              </div>
              {isInitialPositionsLoading ? (
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                  <span>{summaryStats.totalPositions}</span>
                  <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">POS</span>
                </div>
              )}
            </div>
            
            {/* Total Floating Profit - shown in 'value' mode or 'both' mode */}
            {(displayMode === 'value' || displayMode === 'both') && (
              <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Floating Profit</span>
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                    <img 
                      src={getCardIcon('Floating Profit')} 
                      alt="Floating Profit"
                      style={{ width: '100%', height: '100%' }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
                {isInitialPositionsLoading ? (
                  <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <div className={`text-sm md:text-base font-bold flex items-center gap-1.5 leading-none ${
                    summaryStats.totalFloatingProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}>
                    {summaryStats.totalFloatingProfit >= 0 && (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polygon points="5,0 10,10 0,10" fill="#16A34A"/>
                      </svg>
                    )}
                    {summaryStats.totalFloatingProfit < 0 && (
                      <svg width="10" height="10" viewBox="0 0 10 10" style={{transform: 'rotate(180deg)'}}>
                        <polygon points="5,0 10,10 0,10" fill="#DC2626"/>
                      </svg>
                    )}
                    <span>{formatNumber(Math.abs(summaryStats.totalFloatingProfit))}</span>
                    <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">USD</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Total Floating Profit Percentage - shown in 'percentage' mode or 'both' mode */}
            {(displayMode === 'percentage' || displayMode === 'both') && (
              <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">Floating Profit %</span>
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="white" strokeWidth="1.2" fill="none"/>
                      <rect x="5.5" y="5.5" width="7" height="7" rx="1" fill="white" stroke="white" strokeWidth="1.2"/>
                    </svg>
                  </div>
                </div>
                {isInitialPositionsLoading ? (
                  <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <div className={`text-lg font-bold flex items-center gap-2 ${
                    summaryStats.totalFloatingProfitPercentage >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}>
                    {summaryStats.totalFloatingProfitPercentage >= 0 && (
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <polygon points="5,0 10,10 0,10" fill="#16A34A"/>
                      </svg>
                    )}
                    {summaryStats.totalFloatingProfitPercentage < 0 && (
                      <svg width="10" height="10" viewBox="0 0 10 10" style={{transform: 'rotate(180deg)'}}>
                        <polygon points="5,0 10,10 0,10" fill="#DC2626"/>
                      </svg>
                    )}
                    <span>{Math.abs(summaryStats.totalFloatingProfitPercentage).toFixed(2)}%</span>
                  </div>
                )}\n              </div>
            )}
            
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Unique Logins</span>
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                  <img 
                    src={getCardIcon('Unique Logins')} 
                    alt="Unique Logins"
                    style={{ width: '100%', height: '100%' }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              </div>
              {isInitialPositionsLoading ? (
                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                  <span>{summaryStats.uniqueLogins}</span>
                  <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">ACCT</span>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Symbols</span>
                <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                  <img 
                    src={getCardIcon('Symbols')} 
                    alt="Symbols"
                    style={{ width: '100%', height: '100%' }}
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              </div>
              {isInitialPositionsLoading ? (
                <div className="h-6 w-10 bg-gray-200 rounded animate-pulse" />
              ) : (
                <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                  <span>{summaryStats.uniqueSymbols}</span>
                  <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">SYM</span>
                </div>
              )}
            </div>
          </div>

          {/* NET Position View */}
          {showNetPositions ? (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* NET Position Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3">
                {netCardsVisible.netSymbols && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">NET Symbols</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('NET Symbols')} 
                          alt="NET Symbols"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                      <span>{netFilteredPositions.length}</span>
                      <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">SYM</span>
                    </div>
                  </div>
                )}
                {netCardsVisible.totalNetVolume && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total NET Volume</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Total NET Volume')} 
                          alt="Total NET Volume"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                      <span>{formatNumber(netFilteredPositions.reduce((s,p)=>s+p.netVolume,0),2)}</span>
                      <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">VOL</span>
                    </div>
                  </div>
                )}
                {netCardsVisible.totalNetPL && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total NET P/L</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Total NET P/L')} 
                          alt="Total NET P/L"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className={`text-sm md:text-base font-bold flex items-center gap-1.5 leading-none ${
                      netFilteredPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                    }`}>
                      {netFilteredPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 && (
                        <svg width="8" height="8" viewBox="0 0 10 10" className="md:w-[10px] md:h-[10px]">
                          <polygon points="5,0 10,10 0,10" fill="#16A34A"/>
                        </svg>
                      )}
                      {netFilteredPositions.reduce((s,p)=>s+p.totalProfit,0) < 0 && (
                        <svg width="8" height="8" viewBox="0 0 10 10" style={{transform: 'rotate(180deg)'}} className="md:w-[10px] md:h-[10px]">
                          <polygon points="5,0 10,10 0,10" fill="#DC2626"/>
                        </svg>
                      )}
                      <span>{formatNumber(Math.abs(netFilteredPositions.reduce((s,p)=>s+p.totalProfit,0)),2)}</span>
                      <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">USD</span>
                    </div>
                  </div>
                )}
                {netCardsVisible.totalLogins && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total Logins</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Total Logins')} 
                          alt="Total Logins"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                      <span>{netFilteredPositions.reduce((s,p)=>s+p.loginCount,0)}</span>
                      <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">ACCT</span>
                    </div>
                  </div>
                )}
                {/* Removed grouping toggle card per new layout */}
              </div>

              {/* NET Position Table */}
              <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden flex flex-col" style={{ maxHeight: '60vh' }}>
                {/* NET module controls */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-shrink-0 flex items-center px-4 py-3">
                  <div className="flex flex-row items-center justify-between gap-3 w-full">
                    <div className="flex items-center flex-wrap gap-3">
                      {/* NET search on the left */}
                      <div className="relative" ref={netSearchRef}>
                        <input
                          type="text"
                          value={netSearchQuery}
                          onChange={(e) => { setNetSearchQuery(e.target.value); setNetShowSuggestions(true); setNetCurrentPage(1) }}
                          onFocus={() => setNetShowSuggestions(true)}
                          onKeyDown={handleNetSearchKeyDown}
                          placeholder="Search symbol or NET type..."
                          className="pl-9 pr-9 py-3.5 text-xs border border-indigo-200 rounded-lg bg-white text-gray-700 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-85 shadow-sm transition-all"
                        />
                        <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {netSearchQuery && (
                          <button onClick={() => { setNetSearchQuery(''); setNetShowSuggestions(false) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                        {netShowSuggestions && getNetSuggestions().length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto">
                            {getNetSuggestions().map((s,i)=>(
                              <button key={i} onClick={() => handleNetSuggestionClick(s)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">{s}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Card Filter */}
                      <div className="relative" ref={netCardFilterRef}>
                        <button onClick={()=>setNetCardFilterOpen(v=>!v)} className="px-2 py-1.5 text-xs rounded-lg border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center gap-1.5 text-gray-700 font-medium shadow-sm" title="Toggle summary cards">
                          <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                          Card Filter
                        </button>
                        {netCardFilterOpen && (
                          <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-48">
                            <p className="text-[10px] font-semibold text-gray-600 mb-1">Summary Cards</p>
                            {Object.entries(netCardsVisible).map(([k,v]) => (
                              <label key={k} className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-blue-50 cursor-pointer">
                                <input type="checkbox" checked={v} onChange={()=>setNetCardsVisible(prev=>({...prev,[k]:!prev[k]}))} className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <span className="text-[11px] text-gray-700">{k==='netSymbols'?'NET Symbols':k==='totalNetVolume'?'Total NET Volume':k==='totalNetPL'?'Total NET P/L':'Total Logins'}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Export - icon only */}
                      <button onClick={handleExportNetPositions} className="p-2 rounded-lg border border-green-200 bg-white hover:bg-green-50 hover:border-green-300 transition-all text-gray-700 shadow-sm" title="Export NET positions to CSV">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-3-3m3 3l3-3M4 20h16"/></svg>
                      </button>
                      
                      {/* Group Base Symbols toggle */}
                      <button
                        onClick={() => setGroupByBaseSymbol(v => !v)}
                        className={`px-2 py-1.5 text-xs rounded-lg border inline-flex items-center gap-1.5 font-medium shadow-sm transition-all ${groupByBaseSymbol ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700' : 'bg-white text-gray-700 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300'}`}
                        title="Toggle grouping by base symbol"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 10h10M10 14h7M13 18h4"/></svg>
                        Group Base Symbols
                      </button>
                      
                      {/* Columns selector - icon only */}
                      <div className="relative" ref={netColumnSelectorRef}>
                        <button onClick={()=>setNetShowColumnSelector(v=>!v)} className="p-2 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition-all text-gray-700 shadow-sm" title="Show/Hide NET columns">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                        </button>
                        {netShowColumnSelector && (
                          <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-56 max-h-72 overflow-y-auto">
                            <p className="text-[10px] font-semibold text-gray-600 mb-1">NET Columns</p>
                            {Object.keys(netVisibleColumns).map(k => (
                              <label key={k} className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-blue-50 cursor-pointer">
                                <input type="checkbox" checked={netVisibleColumns[k]} onChange={()=>toggleNetColumn(k)} className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                                <span className="text-[11px] text-gray-700">{netColumnLabels[k] || k}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Pagination controls with button styling */}
                      <div className="flex items-center gap-2">
                          <button
                            onClick={()=>handleNetPageChange(netCurrentPage-1)}
                            disabled={netCurrentPage===1}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              netCurrentPage === 1
                                ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                                : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                            }`}
                            aria-label="Previous page"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <div className="px-3 py-1.5 text-sm font-medium text-[#374151]">
                            <span className="text-[#1F2937] font-semibold">{netCurrentPage}</span>
                            <span className="text-[#9CA3AF] mx-1">/</span>
                            <span className="text-[#6B7280]">{netTotalPages}</span>
                          </div>
                          <button
                            onClick={()=>handleNetPageChange(netCurrentPage+1)}
                            disabled={netCurrentPage===netTotalPages}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                              netCurrentPage === netTotalPages
                                ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                                : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                            }`}
                            aria-label="Next page"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-auto flex-1" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#9ca3af #e5e7eb',
                  overflowY: 'scroll',
                  overflowX: 'auto'
                }}>
                  <style>{`
                    .overflow-auto::-webkit-scrollbar {
                      width: 14px;
                      height: 14px;
                    }
                    .overflow-auto::-webkit-scrollbar-track {
                      background: #e5e7eb;
                      border-radius: 0;
                    }
                    .overflow-auto::-webkit-scrollbar-thumb {
                      background: #6b7280;
                      border-radius: 4px;
                      border: 2px solid #e5e7eb;
                    }
                    .overflow-auto::-webkit-scrollbar-thumb:hover {
                      background: #4b5563;
                    }
                    .overflow-auto::-webkit-scrollbar-thumb:active {
                      background: #374151;
                    }
                  `}</style>
                  {netDisplayedPositions.length === 0 && !isInitialPositionsLoading ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                      </svg>
                      <p className="text-gray-500 text-sm">No NET positions available</p>
                    </div>
                  ) : (
                    <table className="w-full divide-y divide-gray-200" style={{ minWidth: '1200px' }}>
                      <thead className="bg-blue-600 sticky top-0 shadow-md" style={{ zIndex: 10 }}>
                        <tr>
                          {netVisibleColumns.symbol && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('symbol')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Symbol</span>
                                {netSortColumn === 'symbol' ? (
                                  <svg
                                    className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`}
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
                            </th>
                          )}
                          {netVisibleColumns.netType && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('netType')}
                            >
                              <div className="flex items-center gap-1">
                                <span>NET Type</span>
                                {netSortColumn === 'netType' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.netVolume && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('netVolume')}
                            >
                              <div className="flex items-center gap-1">
                                <span>NET Volume</span>
                                {netSortColumn === 'netVolume' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.avgPrice && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('avgPrice')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Avg Price</span>
                                {netSortColumn === 'avgPrice' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.totalProfit && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('totalProfit')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Total Profit</span>
                                {netSortColumn === 'totalProfit' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.totalStorage && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('totalStorage')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Total Storage</span>
                                {netSortColumn === 'totalStorage' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.totalCommission && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('totalCommission')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Total Commission</span>
                                {netSortColumn === 'totalCommission' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.loginCount && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('loginCount')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Logins</span>
                                {netSortColumn === 'loginCount' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.totalPositions && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('totalPositions')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Positions</span>
                                {netSortColumn === 'totalPositions' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                          {netVisibleColumns.variantCount && (
                            <th 
                              className="px-2 py-2 text-left text-[11px] font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-blue-700/70 transition-all select-none group"
                              onClick={() => handleNetSort('variantCount')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Variant Count</span>
                                {netSortColumn === 'variantCount' ? (
                                  <svg className={`w-3 h-3 transition-transform ${netSortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                  </svg>
                                )}
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>

                      {/* YouTube-style Loading Progress Bar */}
                      {isInitialPositionsLoading && (
                        <thead className="sticky z-40" style={{ top: '48px' }}>
                          <tr>
                            <th colSpan={Object.values(netVisibleColumns).filter(v => v).length} className="p-0" style={{ height: '3px' }}>
                              <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                                <style>{`
                                  @keyframes shimmerSlide {
                                    0% { transform: translateX(-100%); }
                                    100% { transform: translateX(400%); }
                                  }
                                  .shimmer-loading-bar {
                                    width: 30%;
                                    height: 100%;
                                    background: #2563eb;
                                    animation: shimmerSlide 0.9s linear infinite;
                                  }
                                `}</style>
                                <div className="shimmer-loading-bar absolute top-0 left-0 h-full" />
                              </div>
                            </th>
                          </tr>
                        </thead>
                      )}

                      <tbody className="bg-white divide-y divide-gray-100">
                        {netDisplayedPositions.map((netPos, idx) => (
                          <Fragment key={netPos.symbol || idx}>
                          <tr className="hover:bg-blue-50 transition-all duration-300">
                            {netVisibleColumns.symbol && (
                              <td className="px-2 py-1.5 text-[13px] font-medium text-gray-900 whitespace-nowrap">
                                {netPos.symbol}
                                {groupByBaseSymbol && netPos.variantCount > 1 && (
                                  <span className="ml-2 text-[11px] text-gray-500">(+{netPos.variantCount - 1} variants)</span>
                                )}
                              </td>
                            )}
                            {netVisibleColumns.netType && (
                              <td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${netPos.netType === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{netPos.netType}</span>
                              </td>
                            )}
                            {netVisibleColumns.netVolume && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(netPos.netVolume, 2)}</td>
                            )}
                            {netVisibleColumns.avgPrice && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(netPos.avgPrice, 5)}</td>
                            )}
                            {netVisibleColumns.totalProfit && (
                              <td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded ${netPos.totalProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{formatNumber(netPos.totalProfit, 2)}</span>
                              </td>
                            )}
                            {netVisibleColumns.totalStorage && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(netPos.totalStorage ?? 0, 2)}</td>
                            )}
                            {netVisibleColumns.totalCommission && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(netPos.totalCommission ?? 0, 2)}</td>
                            )}
                            {netVisibleColumns.loginCount && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{netPos.loginCount}</td>
                            )}
                            {netVisibleColumns.totalPositions && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">
                                {netPos.totalPositions}
                                {groupByBaseSymbol && netPos.variantCount > 1 && netVisibleColumns.symbol && (
                                  <button
                                    className="ml-3 text-xs text-blue-600 hover:underline"
                                    onClick={() => {
                                      const next = new Set(expandedNetKeys)
                                      if (next.has(netPos.symbol)) next.delete(netPos.symbol); else next.add(netPos.symbol)
                                      setExpandedNetKeys(next)
                                    }}
                                  >
                                    {expandedNetKeys.has(netPos.symbol) ? 'Hide variants' : 'Show variants'}
                                  </button>
                                )}
                              </td>
                            )}
                            {netVisibleColumns.variantCount && (
                              <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{netPos.variantCount || 1}</td>
                            )}
                          </tr>
                          {groupByBaseSymbol && expandedNetKeys.has(netPos.symbol) && netPos.variants && netPos.variants.length > 0 && (
                            <tr className="bg-gray-50">
                              <td colSpan={Object.values(netVisibleColumns).filter(Boolean).length} className="px-3 py-2">
                                <div className="text-[12px] text-gray-700 font-medium mb-1">Variants</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {netPos.variants.map((v, i) => (
                                    <div key={i} className="border border-gray-200 rounded p-2 bg-white">
                                      <div className="flex items-center justify-between">
                                        <div className="font-semibold text-gray-900">{v.exactSymbol}</div>
                                        <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${v.netType === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{v.netType}</span>
                                      </div>
                                      <div className="mt-1 text-[12px] text-gray-600 flex gap-4">
                                        <div>NET Vol: <span className="font-semibold text-gray-900">{formatNumber(v.netVolume, 2)}</span></div>
                                        <div>Avg: <span className="font-semibold text-gray-900">{formatNumber(v.avgPrice, 5)}</span></div>
                                        <div>P/L: <span className={`font-semibold ${v.totalProfit>=0?'text-green-700':'text-red-700'}`}>{formatNumber(v.totalProfit, 2)}</span></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          ) : showClientNet ? (
            <div className="space-y-4 flex flex-col flex-1 overflow-hidden">
              {/* Client NET Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 mb-6">
                {clientNetCardsVisible.clientNetRows && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Client NET Rows</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Client NET Rows')} 
                          alt="Client NET Rows"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                      <span>{clientNetFilteredPositions.length}</span>
                    </div>
                  </div>
                )}
                {clientNetCardsVisible.totalNetVolume && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total NET Volume</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Total NET Volume')} 
                          alt="Total NET Volume"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                      <span>{formatNumber(clientNetFilteredPositions.reduce((sum, p) => sum + p.netVolume, 0), 2)}</span>
                    </div>
                  </div>
                )}
                {clientNetCardsVisible.totalNetPL && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total NET P/L</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Total NET P/L')} 
                          alt="Total NET P/L"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className={`text-sm md:text-base font-bold flex items-center gap-1.5 leading-none ${
                      clientNetFilteredPositions.reduce((sum, p) => sum + p.totalProfit, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <span>
                        {clientNetFilteredPositions.reduce((sum, p) => sum + p.totalProfit, 0) >= 0 ? '▲ ' : '▼ '}
                        {formatNumber(Math.abs(clientNetFilteredPositions.reduce((sum, p) => sum + p.totalProfit, 0)), 2)}
                      </span>
                    </div>
                  </div>
                )}
                {clientNetCardsVisible.totalLogins && (
                  <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-1.5">
                      <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total Logins</span>
                      <div className="w-4 h-4 md:w-5 md:h-5 rounded-md flex items-center justify-center flex-shrink-0">
                        <img 
                          src={getCardIcon('Total Logins')} 
                          alt="Total Logins"
                          style={{ width: '100%', height: '100%' }}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      </div>
                    </div>
                    <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                      <span>{new Set(clientNetFilteredPositions.map(r=>r.login)).size}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Client NET Table */}
              <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden flex flex-col" style={{ maxHeight: '60vh' }}>
                {/* Controls: search and pagination left; actions right */}
                <div className="p-3 border-b border-blue-100 bg-gradient-to-r from-white to-blue-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: search */}
                  <div className="flex items-center flex-wrap gap-3">
                    {/* Client NET search at extreme left */}
                    <div className="relative" ref={clientNetSearchRef}>
                      <input
                        type="text"
                        value={clientNetSearchQuery}
                        onChange={(e)=>{ setClientNetSearchQuery(e.target.value); setClientNetShowSuggestions(true); setClientNetCurrentPage(1) }}
                        onFocus={()=>setClientNetShowSuggestions(true)}
                        onKeyDown={handleClientNetSearchKeyDown}
                        placeholder="Search login, symbol or NET type..."
                        className="pl-9 pr-9 py-1.5 text-xs border border-indigo-200 rounded-lg bg-white text-gray-700 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-56 shadow-sm transition-all"
                      />
                      <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      {clientNetSearchQuery && (
                        <button onClick={()=>{ setClientNetSearchQuery(''); setClientNetShowSuggestions(false) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                      {clientNetShowSuggestions && getClientNetSuggestions().length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto">
                          {getClientNetSuggestions().map((s,i)=>(
                            <button key={i} onClick={()=>handleClientNetSuggestionClick(s)} className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">{s}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Card Filter next to search */}
                    <div className="relative" ref={clientNetCardFilterRef}>
                      <button onClick={()=>setClientNetCardFilterOpen(v=>!v)} className="px-2 py-1.5 text-xs rounded-lg border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center gap-1.5 text-gray-700 font-medium shadow-sm" title="Toggle summary cards">
                        <svg className="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                        Card Filter
                      </button>
                      {clientNetCardFilterOpen && (
                        <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-48">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">Summary Cards</p>
                          {Object.entries(clientNetCardsVisible).map(([k,v]) => (
                            <label key={k} className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-blue-50 cursor-pointer">
                              <input type="checkbox" checked={v} onChange={()=>setClientNetCardsVisible(prev=>({...prev,[k]:!prev[k]}))} className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                              <span className="text-[11px] text-gray-700">{
                                k==='clientNetRows'?'Client NET Rows':
                                k==='totalNetVolume'?'Total NET Volume':
                                k==='totalNetPL'?'Total NET P/L':'Total Logins'
                              }</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Export CSV button */}
                    <button onClick={handleExportClientNetPositions} className="p-2 rounded-lg border border-green-200 bg-white hover:bg-green-50 hover:border-green-300 transition-all text-gray-700 shadow-sm" title="Export Client NET to CSV">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-3-3m3 3l3-3M4 20h16"/></svg>
                    </button>
                    
                    {/* Groups button */}
                    <button
                      onClick={() => setGroupByBaseSymbol(v => !v)}
                      className={`px-2 py-1.5 text-xs rounded-lg border inline-flex items-center gap-1.5 ${groupByBaseSymbol ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} shadow-sm font-medium`}
                      title="Toggle grouping by base symbol"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 10h10M10 14h7M13 18h4"/></svg>
                      Groups base Symbols
                    </button>
                    
                    {/* Columns selector */}
                    <div className="relative" ref={clientNetColumnSelectorRef}>
                      <button onClick={()=>setClientNetShowColumnSelector(v=>!v)} className="p-2 rounded-lg border border-purple-200 bg-white hover:bg-purple-50 hover:border-purple-300 transition-all text-gray-700 shadow-sm" title="Show/Hide Client NET columns">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                      </button>
                      {clientNetShowColumnSelector && (
                        <div className="absolute left-0 top-full mt-2 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-56 max-h-72 overflow-y-auto">
                          <p className="text-[10px] font-semibold text-gray-600 mb-1">Client NET Columns</p>
                          {Object.keys(clientNetVisibleColumns).map(k => (
                            <label key={k} className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-blue-50 cursor-pointer">
                              <input type="checkbox" checked={clientNetVisibleColumns[k]} onChange={()=>toggleClientNetColumn(k)} className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                              <span className="text-[11px] text-gray-700 capitalize">{
                                k==='netType'?'NET Type':
                                k==='netVolume'?'NET Volume':
                                k==='avgPrice'?'Avg Price':
                                k==='totalProfit'?'Total Profit':
                                k==='totalPositions'?'Positions':
                                k
                              }</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Right: pagination */}
                  <div className="flex items-center gap-2">
                      <button
                        onClick={()=>handleClientNetPageChange(clientNetCurrentPage-1)}
                        disabled={clientNetCurrentPage===1}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          clientNetCurrentPage === 1
                            ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                            : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                        }`}
                        aria-label="Previous page"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>

                      <div className="px-3 py-1.5 text-sm font-medium text-[#374151]">
                        <span className="text-[#1F2937] font-semibold">{clientNetCurrentPage}</span>
                        <span className="text-[#9CA3AF] mx-1">/</span>
                        <span className="text-[#6B7280]">{clientNetTotalPages}</span>
                      </div>

                      <button
                        onClick={()=>handleClientNetPageChange(clientNetCurrentPage+1)}
                        disabled={clientNetCurrentPage===clientNetTotalPages}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          clientNetCurrentPage === clientNetTotalPages
                            ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                            : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                        }`}
                        aria-label="Next page"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                </div>
                <div className="overflow-auto flex-1" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#9ca3af #e5e7eb',
                  overflowY: 'scroll',
                  overflowX: 'auto'
                }}>
                  <style>{`
                    .overflow-auto::-webkit-scrollbar {
                      width: 14px;
                      height: 14px;
                    }
                    .overflow-auto::-webkit-scrollbar-track {
                      background: #e5e7eb;
                      border-radius: 0;
                    }
                    .overflow-auto::-webkit-scrollbar-thumb {
                      background: #6b7280;
                      border-radius: 4px;
                      border: 2px solid #e5e7eb;
                      min-height: 200px;
                    }
                    .overflow-auto::-webkit-scrollbar-thumb:hover {
                      background: #4b5563;
                    }
                    .overflow-auto::-webkit-scrollbar-thumb:active {
                      background: #374151;
                    }
                  `}</style>
                  {clientNetPositionsData.length === 0 && !isInitialPositionsLoading ? (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                      </svg>
                      <p className="text-gray-500 text-sm">No Client NET data</p>
                    </div>
                  ) : (<>
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-blue-600 sticky top-0 shadow-md" style={{ zIndex: 30, backgroundColor: '#2563eb' }}>
                        <tr>
                          {clientNetVisibleColumns.login && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group sticky left-0"
                              onClick={() => handleClientNetSort('login')}
                              style={{ backgroundColor: '#2563eb', zIndex: 31 }}
                            >
                              <div className="flex items-center gap-1">
                                <span>Login</span>
                              </div>
                            </th>
                          )}
                          {clientNetVisibleColumns.symbol && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group"
                              onClick={() => handleClientNetSort('symbol')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Symbol</span>
                              </div>
                            </th>
                          )}
                          {clientNetVisibleColumns.netType && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group"
                              onClick={() => handleClientNetSort('netType')}
                            >
                              <div className="flex items-center gap-1">
                                <span>NET Type</span>
                              </div>
                            </th>
                          )}
                          {clientNetVisibleColumns.netVolume && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group"
                              onClick={() => handleClientNetSort('netVolume')}
                            >
                              <div className="flex items-center gap-1">
                                <span>NET Volume</span>
                              </div>
                            </th>
                          )}
                          {clientNetVisibleColumns.avgPrice && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group"
                              onClick={() => handleClientNetSort('avgPrice')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Avg Price</span>
                              </div>
                            </th>
                          )}
                          {clientNetVisibleColumns.totalProfit && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group"
                              onClick={() => handleClientNetSort('totalProfit')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Total Profit</span>
                              </div>
                            </th>
                          )}
                          {clientNetVisibleColumns.totalPositions && (
                            <th 
                              className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none group"
                              onClick={() => handleClientNetSort('totalPositions')}
                            >
                              <div className="flex items-center gap-1">
                                <span>Positions</span>
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>

                      {/* YouTube-style Loading Progress Bar */}
                      {isInitialPositionsLoading && (
                        <thead className="sticky z-40" style={{ top: '48px' }}>
                          <tr>
                            <th colSpan={Object.values(clientNetVisibleColumns).filter(v => v).length} className="p-0" style={{ height: '3px' }}>
                              <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                                <style>{`
                                  @keyframes shimmerSlideClient {
                                    0% { transform: translateX(-100%); }
                                    100% { transform: translateX(400%); }
                                  }
                                  .shimmer-loading-bar-client {
                                    width: 30%;
                                    height: 100%;
                                    background: #2563eb;
                                    animation: shimmerSlideClient 0.9s linear infinite;
                                  }
                                `}</style>
                                <div className="shimmer-loading-bar-client absolute top-0 left-0 h-full" />
                              </div>
                            </th>
                          </tr>
                        </thead>
                      )}

                      <tbody className="bg-white divide-y divide-gray-100">
                        {clientNetDisplayedPositions.map((row, idx) => {
                          const key = `${row.login}|${row.symbol}`
                          return (
                            <Fragment key={key}>
                              <tr className="hover:bg-blue-50 transition-all duration-300">
                                {clientNetVisibleColumns.login && (
                                  <td 
                                    className="px-2 py-1.5 text-[13px] font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap cursor-pointer hover:underline sticky left-0 z-10 bg-white"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedLogin(row.login)
                                    }}
                                    title="Click to view client details"
                                  >
                                    {row.login}
                                  </td>
                                )}
                                {clientNetVisibleColumns.symbol && (<td className="px-2 py-1.5 text-[13px] font-medium text-gray-900 whitespace-nowrap">
                                  {row.symbol}
                                  {groupByBaseSymbol && row.variantCount > 1 && (
                                    <span className="ml-2 text-[11px] text-gray-500">(+{row.variantCount - 1} variants)</span>
                                  )}
                                </td>)}
                                {clientNetVisibleColumns.netType && (<td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${row.netType === 'Buy' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{row.netType}</span>
                                </td>)}
                                {clientNetVisibleColumns.netVolume && (<td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(row.netVolume, 2)}</td>)}
                                {clientNetVisibleColumns.avgPrice && (<td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(row.avgPrice, 5)}</td>)}
                                {clientNetVisibleColumns.totalProfit && (<td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${row.totalProfit >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{formatNumber(row.totalProfit, 2)}</span>
                                </td>)}
                                {clientNetVisibleColumns.totalPositions && (<td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">
                                  {row.totalPositions ?? '-'}
                                  {groupByBaseSymbol && row.variantCount > 1 && (
                                    <button
                                      className="ml-3 text-xs text-blue-600 hover:underline"
                                      onClick={() => {
                                        const next = new Set(expandedNetKeys)
                                        const ek = `client|${key}`
                                        if (next.has(ek)) next.delete(ek); else next.add(ek)
                                        setExpandedNetKeys(next)
                                      }}
                                    >
                                      {expandedNetKeys.has(`client|${key}`) ? 'Hide variants' : 'Show variants'}
                                    </button>
                                  )}
                                </td>)}
                              </tr>
                              {groupByBaseSymbol && expandedNetKeys.has(`client|${key}`) && row.variants && row.variants.length > 0 && (
                                <tr className="bg-gray-50">
                                  <td colSpan={Object.values(clientNetVisibleColumns).filter(Boolean).length} className="px-3 py-2">
                                    <div className="text-[12px] text-gray-700 font-medium mb-1">Variants</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {row.variants.map((v, i) => (
                                        <div key={i} className="border border-gray-200 rounded p-2 bg-white">
                                          <div className="flex items-center justify-between">
                                            <div className="font-semibold text-gray-900">{v.exactSymbol}</div>
                                            <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${v.netType === 'Buy' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{v.netType}</span>
                                          </div>
                                          <div className="mt-1 text-[12px] text-gray-600 flex gap-4">
                                            <div>NET Vol: <span className="font-semibold text-gray-900">{formatNumber(v.netVolume, 2)}</span></div>
                                            <div>Avg: <span className="font-semibold text-gray-900">{formatNumber(v.avgPrice, 5)}</span></div>
                                            <div>P/L: <span className={`font-semibold ${v.totalProfit>=0?'text-green-700':'text-red-700'}`}>{formatNumber(v.totalProfit, 2)}</span></div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                    {/* Add bottom padding to keep scrollbar visible */}
                    <div style={{ height: '20px' }}></div>
                  </>)}
                </div>
              </div>
            </div>
          ) : <>
          {/* Search and Controls Bar */}
          <div className="mb-4 bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Left: Search and Columns */}
              <div className="flex items-center gap-2 flex-1">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md" ref={searchRef}>
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 18 18">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
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
                    placeholder="Search"
                    className="w-full h-10 pl-10 pr-10 text-sm border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
                      title="Clear search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Suggestions Dropdown - rendered when visible; show message if empty */}
                  {showSuggestions ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-50 max-h-60 overflow-y-auto">
                      {getSuggestions().length === 0 && (
                        <div className="px-3 py-2 text-sm text-[#6B7280]">No suggestions</div>
                      )}
                      {getSuggestions().length > 0 && (
                        <div>
                          {getSuggestions().map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-blue-50 transition-colors"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                
                {/* Columns Button (icon only) */}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="h-10 w-10 rounded-lg bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
                    title="Show/Hide Columns"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="3" width="4" height="10" rx="1" stroke="#4B5563" strokeWidth="1.2"/>
                      <rect x="8" y="3" width="6" height="10" rx="1" stroke="#4B5563" strokeWidth="1.2"/>
                    </svg>
                  </button>
                  {showColumnSelector && (
                    <div
                      ref={columnSelectorRef}
                      className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-2 z-50 w-56"
                      style={{ maxHeight: '400px', overflowY: 'auto' }}
                    >
                      <div className="px-3 py-2 border-b border-[#F3F4F6]">
                        <p className="text-xs font-semibold text-[#1F2937] uppercase">Show/Hide Columns</p>
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
                          <span className="ml-2 text-sm text-[#374151]">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Pagination */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    currentPage === 1
                      ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                      : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div className="px-3 py-1.5 text-sm font-medium text-[#374151]">
                  <span className="text-[#1F2937] font-semibold">{currentPage}</span>
                  <span className="text-[#9CA3AF] mx-1">/</span>
                  <span className="text-[#6B7280]">{totalPages}</span>
                </div>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    currentPage === totalPages
                      ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                      : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="overflow-y-scroll overflow-x-auto flex-1" style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: '#CBD5E0 #F7FAFC',
              maxHeight: '60vh'
            }}>
              <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-blue-600 sticky top-0 shadow-md" style={{ zIndex: 10 }}>
                    <tr>
                      {(() => {
                        const effectiveCols = getEffectiveVisibleColumns()
                        return (
                          <>
                      {effectiveCols.time && renderHeaderCell('timeUpdate', 'Time', 'timeUpdate')}
                      {effectiveCols.login && renderHeaderCell('login', 'Login')}
                      {effectiveCols.position && renderHeaderCell('position', 'Position')}
                      {effectiveCols.symbol && renderHeaderCell('symbol', 'Symbol')}
                      {effectiveCols.action && renderHeaderCell('action', 'Action')}
                      {effectiveCols.volume && renderHeaderCell('volume', 'Volume')}
                      {effectiveCols.volumePercentage && renderHeaderCell('volume_percentage', 'Volume %')}
                      {effectiveCols.priceOpen && renderHeaderCell('priceOpen', 'Open')}
                      {effectiveCols.priceCurrent && renderHeaderCell('priceCurrent', 'Current')}
                      {effectiveCols.sl && renderHeaderCell('priceSL', 'S/L')}
                      {effectiveCols.tp && renderHeaderCell('priceTP', 'T/P')}
                      {effectiveCols.profit && renderHeaderCell('profit', 'Profit')}
                      {effectiveCols.profitPercentage && renderHeaderCell('profit_percentage', 'Profit %')}
                      {effectiveCols.storage && renderHeaderCell('storage', 'Storage')}
                      {effectiveCols.storagePercentage && renderHeaderCell('storage_percentage', 'Storage %')}
                      {effectiveCols.appliedPercentage && renderHeaderCell('applied_percentage', 'Applied %')}
                      {effectiveCols.reason && renderHeaderCell('reason', 'Reason')}
                      {effectiveCols.comment && renderHeaderCell('comment', 'Comment')}
                      {effectiveCols.commission && renderHeaderCell('commission', 'Commission')}
                          </>
                        )
                      })()}
                    </tr>
                  </thead>

                  {/* YouTube-style Loading Progress Bar */}
                  {isInitialPositionsLoading && (
                    <thead className="sticky z-40" style={{ top: '48px' }}>
                      <tr>
                        <th colSpan={Object.values(getEffectiveVisibleColumns()).filter(v => v).length} className="p-0" style={{ height: '3px' }}>
                          <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                            <style>{`
                              @keyframes shimmerSlidePos {
                                0% { transform: translateX(-100%); }
                                100% { transform: translateX(400%); }
                              }
                              .shimmer-loading-bar-pos {
                                width: 30%;
                                height: 100%;
                                background: #2563eb;
                                animation: shimmerSlidePos 0.9s linear infinite;
                              }
                            `}</style>
                            <div className="shimmer-loading-bar-pos absolute top-0 left-0 h-full" />
                          </div>
                        </th>
                      </tr>
                    </thead>
                  )}

                  <tbody className="bg-white divide-y divide-gray-100">
                    {displayedPositions.length === 0 && !isInitialPositionsLoading ? (
                      <tr>
                        <td colSpan={Object.values(getEffectiveVisibleColumns()).filter(v => v).length} className="px-4 py-12 text-center text-gray-500">
                          No open positions
                        </td>
                      </tr>
                    ) : displayedPositions.map((p) => {
                      const effectiveCols = getEffectiveVisibleColumns()
                      const rowClass = 'hover:bg-blue-50'
                      return (
                        <tr key={p.position} className={`${rowClass} transition-all duration-300`}>
                          {effectiveCols.time && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{formatTime(p.timeUpdate || p.timeCreate)}</td>
                          )}
                          {effectiveCols.login && (
                            <td 
                              className="px-2 py-1.5 text-[13px] text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedLogin(p.login)
                              }}
                              title="Click to view login details"
                            >
                              {p.login}
                            </td>
                          )}
                          {effectiveCols.position && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{p.position}</td>
                          )}
                          {effectiveCols.symbol && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">{p.symbol}</td>
                          )}
                          {effectiveCols.action && (
                            <td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${getActionChipClasses(p.action)}`}>
                                {getActionLabel(p.action)}
                              </span>
                            </td>
                          )}
                          {effectiveCols.volume && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(adjustValueForSymbol(p.volume, p.symbol), 2)}</td>
                          )}
                          {effectiveCols.volumePercentage && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">
                              {(p.volume_percentage != null && p.volume_percentage !== '') ? `${formatNumber(p.volume_percentage, 2)}%` : '-'}
                            </td>
                          )}
                          {effectiveCols.priceOpen && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(p.priceOpen, 5)}</td>
                          )}
                          {effectiveCols.priceCurrent && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">
                              {formatNumber(p.priceCurrent, 5)}
                            </td>
                          )}
                          {effectiveCols.sl && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(p.priceSL, 5)}</td>
                          )}
                          {effectiveCols.tp && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(p.priceTP, 5)}</td>
                          )}
                          {effectiveCols.profit && (
                            <td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded transition-all duration-300 ${
                                (p.profit || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {formatNumber(adjustValueForSymbol(p.profit, p.symbol), 2)}
                              </span>
                            </td>
                          )}
                          {effectiveCols.profitPercentage && (
                            <td className="px-2 py-1.5 text-[13px] whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                                (p.profit_percentage || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {(p.profit_percentage != null && p.profit_percentage !== '') ? `${formatNumber(p.profit_percentage, 2)}%` : '-'}
                              </span>
                            </td>
                          )}
                          {effectiveCols.storage && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(adjustValueForSymbol(p.storage, p.symbol), 2)}</td>
                          )}
                          {effectiveCols.storagePercentage && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">
                              {(p.storage_percentage != null && p.storage_percentage !== '') ? `${formatNumber(p.storage_percentage, 2)}%` : '-'}
                            </td>
                          )}
                          {effectiveCols.appliedPercentage && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">
                              {(p.applied_percentage != null && p.applied_percentage !== '') ? `${formatNumber(p.applied_percentage, 2)}%` : '-'}
                            </td>
                          )}
                          {effectiveCols.reason && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                p.reason === 'DEALER' ? 'bg-blue-100 text-blue-800' :
                                p.reason === 'EXPERT' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {p.reason || '-'}
                              </span>
                            </td>
                          )}
                          {effectiveCols.comment && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 max-w-xs truncate" title={p.comment}>
                              {p.comment || '-'}
                            </td>
                          )}
                          {effectiveCols.commission && (
                            <td className="px-2 py-1.5 text-[13px] text-gray-900 whitespace-nowrap tabular-nums">{formatNumber(adjustValueForSymbol(p.commission, p.symbol), 2)}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
            </div>
          </div>
          </>
          }
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
          allOrdersCache={cachedOrders}
          onCacheUpdate={() => {}}
        />
      )}
    </div>
  )
}

export default PositionsPage
