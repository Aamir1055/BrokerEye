import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useData } from '../contexts/DataContext'
import { useGroups } from '../contexts/GroupContext'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import WebSocketIndicator from '../components/WebSocketIndicator'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'

const ClientsPage = () => {
  const { clients: cachedClients, positions: cachedPositions, clientStats, latestServerTimestamp, fetchClients, fetchPositions, loading, connectionState } = useData()
  const { filterByActiveGroup, activeGroupFilters } = useGroups()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showDisplayMenu, setShowDisplayMenu] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [systemTime, setSystemTime] = useState(Date.now())
  const [appTime, setAppTime] = useState(null)
  const columnSelectorRef = useRef(null)
  const filterMenuRef = useRef(null)
  const displayMenuRef = useRef(null)
  const hasInitialLoad = useRef(false)
  
  // Use cached data
  const clients = cachedClients
  const positions = cachedPositions
  // Removed isLoading to prevent full-page loading spinner on refresh
  
  // Filter states
  const [filterByPositions, setFilterByPositions] = useState(false)
  const [filterByCredit, setFilterByCredit] = useState(false)
  // Display mode for values vs percentages
  // 'value' | 'percentage' | 'both'
  const [displayMode, setDisplayMode] = useState('value')
  // Show face cards toggle - default is true (on)
  const [showFaceCards, setShowFaceCards] = useState(true)
  
  // Face card drag and drop - Default order for 13 cards (including new Total Deposit)
  const defaultFaceCardOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  const [faceCardOrder, setFaceCardOrder] = useState(() => {
    const saved = localStorage.getItem('clientsFaceCardOrder')
    return saved ? JSON.parse(saved) : defaultFaceCardOrder
  })
  const [draggedFaceCard, setDraggedFaceCard] = useState(null)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'

  // Search states
  const [searchInput, setSearchInput] = useState('') // Immediate input value
  const [searchQuery, setSearchQuery] = useState('') // Debounced search value
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])
  
  // Column filter states
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterDropdown, setShowFilterDropdown] = useState(null)
  const [filterPosition, setFilterPosition] = useState(null)
  const filterRefs = useRef({})
  const filterPanelRef = useRef(null)
  const [filterSearchQuery, setFilterSearchQuery] = useState({})
  const [showNumberFilterDropdown, setShowNumberFilterDropdown] = useState(null)
  const [showTextFilterDropdown, setShowTextFilterDropdown] = useState(null)
  
  // Custom filter modal states
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false)
  const [customFilterColumn, setCustomFilterColumn] = useState(null)
  const [customFilterType, setCustomFilterType] = useState('equal')
  const [customFilterValue1, setCustomFilterValue1] = useState('')
  const [customFilterValue2, setCustomFilterValue2] = useState('')
  const [customFilterOperator, setCustomFilterOperator] = useState('AND')

  // Text filter modal states
  const [showCustomTextFilterModal, setShowCustomTextFilterModal] = useState(false)
  const [customTextFilterColumn, setCustomTextFilterColumn] = useState(null)
  const [customTextFilterType, setCustomTextFilterType] = useState('contains')
  const [customTextFilterValue, setCustomTextFilterValue] = useState('')
  const [customTextFilterCaseSensitive, setCustomTextFilterCaseSensitive] = useState(false)
  
  const tableRef = useRef(null)

  // Column resizing states
  const [columnWidths, setColumnWidths] = useState({})
  const [resizingColumn, setResizingColumn] = useState(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeRightStartWidth = useRef(0)
  const resizeRAF = useRef(null)
  const headerRefs = useRef({})
  const measureCanvasRef = useRef(null)
  const resizeRightNeighborKey = useRef(null)

  // Page zoom states
  const [zoomLevel, setZoomLevel] = useState(100)

  // Default visible columns - load from localStorage or use defaults
  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem('clientsPageVisibleColumns')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved columns:', e)
      }
    }
    return {
      login: true,
      name: true,
      group: true,
      country: true,
      clientID: true,
      balance: true,
      equity: true,
      profit: true,
      // Hidden by default
      pnl: false,
      lastName: false,
      middleName: false,
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
    rights: false,
    applied_percentage: false,
    applied_percentage_is_custom: false,
    assets: false,
    blockedCommission: false,
    blockedProfit: false,
    city: false,
    address: false,
    zipCode: false,
    state: false,
    company: false,
    comment: false,
    color: false,
    agent: false,
    leadCampaign: false,
    leadSource: false,
    liabilities: false,
    marginInitial: false,
    marginMaintenance: false,
    marginLeverage: false,
    soActivation: false,
    soEquity: false,
    soLevel: false,
    soMargin: false,
    soTime: false,
    status: false,
    storage: false,
    mqid: false,
    language: false,
    currencyDigits: false,
    rightsMask: false,
    accountLastUpdate: false,
    userLastUpdate: false,
    lastUpdate: false,
    dailyDeposit: false,
    dailyWithdrawal: false,
    lifetimePnL: false,
    dailyPnL: false,
    thisMonthPnL: false,
    thisWeekPnL: false
    }
  }

  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns)

  const allColumns = [
    { key: 'login', label: 'Login' },
    { key: 'name', label: 'Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'middleName', label: 'Middle Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'group', label: 'Group' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'address', label: 'Address' },
    { key: 'zipCode', label: 'Zip Code' },
    { key: 'clientID', label: 'Client ID' },
    { key: 'balance', label: 'Balance' },
    { key: 'credit', label: 'Credit' },
    { key: 'equity', label: 'Equity' },
    { key: 'margin', label: 'Margin' },
    { key: 'marginFree', label: 'Margin Free' },
    { key: 'marginLevel', label: 'Margin Level' },
    { key: 'marginInitial', label: 'Margin Initial' },
    { key: 'marginMaintenance', label: 'Margin Maintenance' },
    { key: 'marginLeverage', label: 'Margin Leverage' },
    { key: 'leverage', label: 'Leverage' },
    { key: 'profit', label: 'Floating Profit' },
    { key: 'pnl', label: 'PNL' },
    { key: 'floating', label: 'Floating' },
    { key: 'currency', label: 'Currency' },
    { key: 'currencyDigits', label: 'Currency Digits' },
    { key: 'applied_percentage', label: 'Applied %' },
    { key: 'applied_percentage_is_custom', label: 'Custom %' },
    { key: 'assets', label: 'Assets' },
    { key: 'liabilities', label: 'Liabilities' },
    { key: 'blockedCommission', label: 'Blocked Commission' },
    { key: 'blockedProfit', label: 'Blocked Profit' },
    { key: 'storage', label: 'Storage' },
    { key: 'company', label: 'Company' },
    { key: 'comment', label: 'Comment' },
    { key: 'color', label: 'Color' },
    { key: 'agent', label: 'Agent' },
    { key: 'leadCampaign', label: 'Lead Campaign' },
    { key: 'leadSource', label: 'Lead Source' },
    { key: 'soActivation', label: 'SO Activation' },
    { key: 'soEquity', label: 'SO Equity' },
    { key: 'soLevel', label: 'SO Level' },
    { key: 'soMargin', label: 'SO Margin' },
    { key: 'soTime', label: 'SO Time' },
    { key: 'status', label: 'Status' },
    { key: 'mqid', label: 'MQID' },
    { key: 'language', label: 'Language' },
    { key: 'registration', label: 'Registration' },
    { key: 'lastAccess', label: 'Last Access' },
    { key: 'lastUpdate', label: 'Last Update' },
    { key: 'accountLastUpdate', label: 'Account Last Update' },
    { key: 'userLastUpdate', label: 'User Last Update' },
    { key: 'rights', label: 'Rights' },
    { key: 'rightsMask', label: 'Rights Mask' },
    { key: 'dailyDeposit', label: 'Daily Deposit' },
    { key: 'dailyWithdrawal', label: 'Daily Withdrawal' },
    { key: 'lifetimePnL', label: 'Lifetime PnL' },
    { key: 'dailyPnL', label: 'Daily PnL' },
    { key: 'thisMonthPnL', label: 'This Month PnL' },
    { key: 'thisWeekPnL', label: 'This Week PnL' }
  ]

  // Map base metric keys to their percentage field names from API
  const percentageFieldMap = {
    balance: 'balance_percentage',
    credit: 'credit_percentage',
    equity: 'equity_percentage',
    marginFree: 'marginFree_percentage',
    margin: 'margin_percentage',
    profit: 'profit_percentage',
    storage: 'storage_percentage',
    pnl: 'pnl_percentage',
    lifetimePnL: 'lifetimePnL_percentage',
    dailyPnL: 'dailyPnL_percentage',
    thisMonthPnL: 'thisMonthPnL_percentage',
    thisWeekPnL: 'thisWeekPnL_percentage'
  }

  const isMetricColumn = (key) => Object.prototype.hasOwnProperty.call(percentageFieldMap, key)

  // Define string/text columns (no number filters)
  const stringColumns = [
    'name', 'lastName', 'middleName', 'email', 'phone', 'group', 
    'country', 'city', 'state', 'address', 'zipCode', 'currency',
    'company', 'comment', 'color', 'leadCampaign', 'leadSource',
    'status', 'mqid', 'language', 'rights', 'rightsMask'
  ]

  const isStringColumn = (key) => stringColumns.includes(key)

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('clientsPageVisibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      // Fetch data from context (will use cache if available)
      fetchClients().catch(err => console.error('Failed to load clients:', err))
      fetchPositions().catch(err => console.error('Failed to load positions:', err))
    }
  }, [fetchClients, fetchPositions])

  // Update system time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemTime(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Note: WebSocket is handled by DataContext, we get updates via clients array changes

  // Track the latest timestamp from DataContext (server batch timestamp)
  useEffect(() => {
    if (latestServerTimestamp) {
      setAppTime(latestServerTimestamp)
    } else if (clients && clients.length > 0) {
      // Fallback: scan clients for timestamp if context doesn't have it yet
      let maxTimestamp = 0
      for (let i = 0; i < Math.min(clients.length, 50); i++) {
        const ts = clients[i]?.serverTimestamp
        if (ts && ts > maxTimestamp) {
          maxTimestamp = ts
        }
      }
      if (maxTimestamp > 0) {
        setAppTime(maxTimestamp)
      }
    }
  }, [latestServerTimestamp, clients])

  // Performance monitor - log lag warnings (throttled)
  const lastLagWarning = useRef(0)
  const hasReceivedFirstUpdate = useRef(false)
  const firstUpdateTime = useRef(0)
  useEffect(() => {
    if (systemTime && appTime) {
      // Mark that we've received a RECENT update (within last 30 seconds)
      const ageOfData = Date.now() - appTime
      if (appTime > 0 && ageOfData < 30000) {
        if (!hasReceivedFirstUpdate.current) {
          hasReceivedFirstUpdate.current = true
          firstUpdateTime.current = Date.now()
        }
      }
      
      // Only check lag after we've been running for at least 30 seconds
      const timeRunning = Date.now() - firstUpdateTime.current
      if (timeRunning < 30000) {
        return // Skip lag warnings during initial warm-up period
      }
      
      const lagSeconds = Math.abs(Math.floor(systemTime / 1000) - Math.floor(appTime / 1000))
      // Only log if we've received updates and only once every 10 seconds
      if (hasReceivedFirstUpdate.current && lagSeconds > 10 && Date.now() - lastLagWarning.current > 10000) {
        console.warn(`[ClientsPage] ⚠️ HIGH LAG: ${lagSeconds}s - Check if WebSocket is receiving updates`)
        lastLagWarning.current = Date.now()
      }
    }
  }, [systemTime, appTime])

  // Handle manual refresh - force fetch without full page reload
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchClients(true), // Force refresh bypassing cache
        fetchPositions(true) // Also refresh positions for face cards
      ])
    } catch (err) {
      console.error('Failed to refresh data:', err)
    } finally {
      setIsRefreshing(false)
    }
  }, [fetchClients, fetchPositions])

  // Column resize handlers with RAF for smooth performance
  const handleResizeStart = useCallback((e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    resizeStartX.current = e.clientX
    // Measure the actual current width of the header cell for accurate resizing
    const measured = headerRefs.current?.[columnKey]?.getBoundingClientRect()?.width
    resizeStartWidth.current = (typeof measured === 'number' && measured > 0)
      ? measured
      : (columnWidths[columnKey] || 150) // Fallback to last set width or 150px

    // Determine immediate right neighbor (Excel-like resize)
    const currentEl = headerRefs.current?.[columnKey]
    const nextEl = currentEl?.nextElementSibling || null
    let neighborKey = null
    if (nextEl) {
      for (const k in headerRefs.current) {
        if (headerRefs.current[k] === nextEl) { neighborKey = k; break }
      }
    }
    resizeRightNeighborKey.current = neighborKey
    if (neighborKey) {
      const nMeasured = headerRefs.current?.[neighborKey]?.getBoundingClientRect()?.width
      resizeRightStartWidth.current = (typeof nMeasured === 'number' && nMeasured > 0) ? nMeasured : (columnWidths[neighborKey] || 150)
    } else {
      resizeRightStartWidth.current = 0
    }
  }, [columnWidths])

  const handleResizeMove = useCallback((e) => {
    if (!resizingColumn) return
    // Use requestAnimationFrame for smooth rendering
    if (resizeRAF.current) {
      cancelAnimationFrame(resizeRAF.current)
    }
    resizeRAF.current = requestAnimationFrame(() => {
      const diff = e.clientX - resizeStartX.current
      // Allow both directions with min width 50px
      const leftWidth = Math.max(50, resizeStartWidth.current + diff)

      // Adjust right neighbor inversely to keep total steady (Excel-like)
      const rKey = resizeRightNeighborKey.current
      if (rKey) {
        const rightWidth = Math.max(50, resizeRightStartWidth.current - diff)
        setColumnWidths(prev => ({ ...prev, [resizingColumn]: leftWidth, [rKey]: rightWidth }))
      } else {
        setColumnWidths(prev => ({ ...prev, [resizingColumn]: leftWidth }))
      }
    })
  }, [resizingColumn])

  const handleResizeEnd = useCallback(() => {
    if (resizeRAF.current) {
      cancelAnimationFrame(resizeRAF.current)
      resizeRAF.current = null
    }
    setResizingColumn(null)
  }, [])

  useEffect(() => {
    if (resizingColumn) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      return () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingColumn, handleResizeMove, handleResizeEnd])

  // Auto-fit like Excel on double click
  const ensureCanvas = () => {
    if (!measureCanvasRef.current) {
      const c = document.createElement('canvas')
      measureCanvasRef.current = c.getContext('2d')
    }
    return measureCanvasRef.current
  }

  const measureText = (text) => {
    try {
      const ctx = ensureCanvas()
      if (!ctx) return String(text || '').length * 8
      // Match table cell font (Tailwind text-sm -> 14px)
      ctx.font = '14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial'
      return ctx.measureText(String(text ?? '')).width
    } catch {
      return String(text || '').length * 8
    }
  }

  

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 200)) // Max 200%
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50)) // Min 50%
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoomLevel(100)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
      if (displayMenuRef.current && !displayMenuRef.current.contains(event.target)) {
        setShowDisplayMenu(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  // Column filter helper functions
  const getUniqueColumnValues = (columnKey) => {
    const values = new Set()
    if (!Array.isArray(clients)) return []
    clients.forEach(client => {
      if (!client) return
      const value = client[columnKey]
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
      const textFilterKey = `${columnKey}_text`
      const { [columnKey]: _, [numberFilterKey]: __, [textFilterKey]: ___, ...rest } = prev
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
    // Check for text filter
    const textFilterKey = `${columnKey}_text`
    const hasTextFilter = columnFilters[textFilterKey] ? 1 : 0
    
    return checkboxCount + hasNumberFilter + hasTextFilter
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

  // Apply custom text filter
  const applyCustomTextFilter = () => {
    if (!customTextFilterColumn) return

    const filterConfig = {
      type: customTextFilterType, // 'equal' | 'notEqual' | 'startsWith' | 'endsWith' | 'contains' | 'doesNotContain'
      value: customTextFilterValue || '',
      caseSensitive: !!customTextFilterCaseSensitive
    }

    setColumnFilters(prev => ({
      ...prev,
      [`${customTextFilterColumn}_text`]: filterConfig
    }))

    // Close modal and dropdown
    setShowCustomTextFilterModal(false)
    setShowFilterDropdown(null)
    setShowTextFilterDropdown(null)

    // Reset form
    setCustomTextFilterValue('')
    setCustomTextFilterType('contains')
    setCustomTextFilterCaseSensitive(false)
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

  // Check if value matches text filter
  const matchesTextFilter = (value, filterConfig) => {
    if (!filterConfig) return true
    const { type, value: needle, caseSensitive } = filterConfig
    if (needle == null || needle === '') return true
    const hayRaw = value == null ? '' : String(value)
    const needleRaw = String(needle)
    const hay = caseSensitive ? hayRaw : hayRaw.toLowerCase()
    const n = caseSensitive ? needleRaw : needleRaw.toLowerCase()

    switch (type) {
      case 'equal':
        return hay === n
      case 'notEqual':
        return hay !== n
      case 'startsWith':
        return hay.startsWith(n)
      case 'endsWith':
        return hay.endsWith(n)
      case 'contains':
        return hay.includes(n)
      case 'doesNotContain':
        return !hay.includes(n)
      default:
        return true
    }
  }
  
  // Get filtered clients based on filter settings
  const getFilteredClients = useCallback(() => {
    // Safety check: ensure clients is an array
    if (!Array.isArray(clients)) return []
    
    let filtered = [...clients].filter(c => c != null)
    
    if (filterByPositions) {
      // Filter clients who have floating values
      filtered = filtered.filter(c => c && c.floating && Math.abs(c.floating) > 0)
    }
    
    if (filterByCredit) {
      // Filter clients who have credit (positive or negative, but not zero)
      filtered = filtered.filter(c => c && c.credit && c.credit !== 0)
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, values]) => {
      if (columnKey.endsWith('_number')) {
        // Number filter
        const actualColumnKey = columnKey.replace('_number', '')
        filtered = filtered.filter(client => {
          if (!client) return false
          const clientValue = client[actualColumnKey]
          return matchesNumberFilter(clientValue, values)
        })
      } else if (columnKey.endsWith('_text')) {
        // Text filter
        const actualColumnKey = columnKey.replace('_text', '')
        filtered = filtered.filter(client => {
          if (!client) return false
          const clientValue = client[actualColumnKey]
          return matchesTextFilter(clientValue, values)
        })
      } else if (values && values.length > 0) {
        // Regular checkbox filter
        filtered = filtered.filter(client => {
          if (!client) return false
          const clientValue = client[columnKey]
          return values.includes(clientValue)
        })
      }
    })
    
    return filtered
  }, [clients, filterByPositions, filterByCredit, columnFilters])
  
  // Sorting function with type detection
  const sortClients = useCallback((clientsToSort) => {
    if (!sortColumn) return clientsToSort
    
    // GUARD: Check for duplicate logins before sorting (prevents React key errors)
    const loginSet = new Set()
    const hasDuplicates = clientsToSort.some(client => {
      if (loginSet.has(client.login)) {
        return true
      }
      loginSet.add(client.login)
      return false
    })
    
    // If duplicates detected, deduplicate before sorting
    if (hasDuplicates) {
      const deduped = Array.from(
        clientsToSort.reduce((map, client) => {
          map.set(client.login, client)
          return map
        }, new Map()).values()
      )
      // Only log if significant duplicates found (more than 5% of data)
      if ((clientsToSort.length - deduped.length) > clientsToSort.length * 0.05) {
        console.warn(`[ClientsPage] ⚠️ EXCESSIVE DUPLICATES: ${clientsToSort.length - deduped.length} clients deduplicated before sort`)
      }
      clientsToSort = deduped
    }
    
    const sorted = [...clientsToSort].sort((a, b) => {
      // Determine actual field to sort by
      let sortKey = sortColumn
      let aVal
      let bVal

      // If sorting a virtual percentage display column in 'both' mode
      if (sortKey.endsWith('_percentage_display')) {
        const baseKey = sortKey.replace('_percentage_display', '')
        const percKey = percentageFieldMap[baseKey]
        aVal = percKey ? a[percKey] : undefined
        bVal = percKey ? b[percKey] : undefined
      } else if (displayMode === 'percentage' && isMetricColumn(sortKey)) {
        // In percentage mode, sort by percentage field for metric columns
        const percKey = percentageFieldMap[sortKey]
        aVal = percKey ? a[percKey] : undefined
        bVal = percKey ? b[percKey] : undefined
      } else {
        aVal = a[sortKey]
        bVal = b[sortKey]
      }
      
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
  }, [sortColumn, sortDirection, displayMode, percentageFieldMap])
  
  // Search helpers
  const searchClients = useCallback((list) => {
    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(c => {
      const login = String(c.login || '').toLowerCase()
      const name = String(c.name || '').toLowerCase()
      const email = String(c.email || '').toLowerCase()
      const phone = String(c.phone || '').toLowerCase()
      const group = String(c.group || '').toLowerCase()
      return login.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q) || group.includes(q)
    })
  }, [searchQuery])

  const getSuggestions = useCallback((sorted) => {
    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim() || searchQuery.length < 1) return []
    const q = searchQuery.toLowerCase().trim()
    const matchedClients = []
    sorted.forEach(c => {
      const login = String(c.login || '')
      const name = String(c.name || '')
      const email = String(c.email || '')
      const phone = String(c.phone || '')
      if (login.toLowerCase().includes(q) || name.toLowerCase().includes(q) || 
          email.toLowerCase().includes(q) || phone.toLowerCase().includes(q)) {
        matchedClients.push(c)
      }
    })
    return matchedClients.slice(0, 10)
  }, [searchQuery])

  const handleSuggestionClick = useCallback((client) => {
    const login = String(client.login || '')
    setSearchInput(login)
    setSearchQuery(login)
    setShowSuggestions(false)
    setCurrentPage(1)
  }, [])

  // Memoize expensive filtering operations - OPTIMIZED
  const filteredClients = useMemo(() => {
    // Skip unnecessary processing if no clients
    if (!clients || !Array.isArray(clients) || clients.length === 0) return []
    
    const filteredBase = getFilteredClients()
    if (!Array.isArray(filteredBase)) return []
    
    const searchedBase = searchClients(filteredBase)
    if (!Array.isArray(searchedBase)) return []
    
    const groupFilteredBase = filterByActiveGroup(searchedBase, 'login', 'clients')
    if (!Array.isArray(groupFilteredBase)) return []
    
    return sortClients(groupFilteredBase)
  }, [clients, getFilteredClients, searchClients, sortClients, filterByActiveGroup, activeGroupFilters])
  
  // Handle column header click for sorting with debounce protection
  const sortTimeoutRef = useRef(null)
  const handleSort = useCallback((columnKey) => {
    // Clear any pending sort operation
    if (sortTimeoutRef.current) {
      clearTimeout(sortTimeoutRef.current)
    }
    
    // Debounce rapid clicks (150ms) to prevent duplicate key errors during rapid sorting
    sortTimeoutRef.current = setTimeout(() => {
      if (sortColumn === columnKey) {
        // Toggle direction if same column
        setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
      } else {
        // New column, default to ascending
        setSortColumn(columnKey)
        setSortDirection('asc')
      }
    }, 150)
  }, [sortColumn])
  
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
  
  // Pagination logic - memoized with duplicate protection
  const { totalPages, displayedClients } = useMemo(() => {
    const total = itemsPerPage === 'All' ? 1 : Math.ceil(filteredClients.length / itemsPerPage)
    const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
    const endIndex = itemsPerPage === 'All' ? filteredClients.length : startIndex + itemsPerPage
    
    // Final guard: Ensure no duplicate keys in displayedClients before rendering
    const sliced = filteredClients.slice(startIndex, endIndex)
    const loginSet = new Set()
    const deduped = sliced.filter(client => {
      if (loginSet.has(client.login)) {
        return false
      }
      loginSet.add(client.login)
      return true
    })
    
    // Only log if excessive duplicates (>5% or >20 duplicates)
    const dupCount = sliced.length - deduped.length
    if (dupCount > 20 || (dupCount > 0 && dupCount > sliced.length * 0.05)) {
      console.warn(`[ClientsPage] ⚠️ EXCESSIVE DUPLICATES: Filtered ${dupCount} duplicate keys from ${sliced.length} displayed clients`)
    }
    
    return {
      totalPages: total,
      displayedClients: deduped
    }
  }, [filteredClients, itemsPerPage, currentPage])

  // Auto-fit like Excel on double click (placed after displayedClients to avoid TDZ)
  const handleAutoFit = useCallback((visKey, baseKey) => {
    // Compute header label width
    const colMeta = allColumns.find(c => c.key === baseKey)
    const headerLabel = (visKey && visKey.endsWith('_percentage_display')) && colMeta ? `${colMeta.label} %` : (colMeta?.label || baseKey)
    let maxW = measureText(headerLabel)

    // Sample displayed rows (up to 100) for visible text widths
    const sample = Array.isArray(displayedClients) ? displayedClients.slice(0, 100) : []
    for (let i = 0; i < sample.length; i++) {
      const client = sample[i]
      if (!client) continue
      let str
      if (visKey && visKey.endsWith('_percentage_display')) {
        // percentage
        const percKey = percentageFieldMap[baseKey]
        const val = percKey ? client[percKey] : undefined
        str = formatPercent(val)
      } else {
        str = formatValue(baseKey, client[baseKey], client)
      }
      maxW = Math.max(maxW, measureText(str))
    }

    // Add padding and small buffer for icons
    const paddingLR = 24 // px-3 left+right
    const buffer = 20
    const target = Math.max(50, Math.min(Math.ceil(maxW + paddingLR + buffer), 450))
    setColumnWidths(prev => ({ ...prev, [visKey]: target }))
  }, [displayedClients, percentageFieldMap])
  
  // Reset to page 1 when filters or items per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterByPositions, filterByCredit, itemsPerPage, searchQuery, displayMode])

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown) {
        const clickedInsideButton = filterRefs.current[showFilterDropdown]?.contains(event.target)
        const clickedInsidePanel = filterPanelRef.current?.contains(event.target)
        
        if (!clickedInsideButton && !clickedInsidePanel) {
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

  const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    const num = Number(value)
    if (isNaN(num)) return '-'
    // Header will carry the % label; values remain numeric
    return num.toFixed(2)
  }

  // Format numbers in Indian currency style (lakhs/crores)
  // Drag and drop handlers for face cards
  const handleFaceCardDragStart = (e, cardId) => {
    setDraggedFaceCard(cardId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target)
    e.target.style.opacity = '0.5'
  }

  const handleFaceCardDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedFaceCard(null)
  }

  const handleFaceCardDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleFaceCardDrop = (e, targetCardId) => {
    e.preventDefault()
    
    if (draggedFaceCard === targetCardId) return

    const newOrder = [...faceCardOrder]
    const draggedIndex = newOrder.indexOf(draggedFaceCard)
    const targetIndex = newOrder.indexOf(targetCardId)

    // Swap positions
    newOrder[draggedIndex] = targetCardId
    newOrder[targetIndex] = draggedFaceCard

    setFaceCardOrder(newOrder)
    localStorage.setItem('clientsFaceCardOrder', JSON.stringify(newOrder))
  }

  // Reset face card order to default
  const resetFaceCardOrder = () => {
    setFaceCardOrder(defaultFaceCardOrder)
    localStorage.setItem('clientsFaceCardOrder', JSON.stringify(defaultFaceCardOrder))
  }

  const formatIndianNumber = (num) => {
    const numStr = num.toString()
    const [integerPart, decimalPart] = numStr.split('.')
    
    // Handle negative numbers
    const isNegative = integerPart.startsWith('-')
    const absoluteInteger = isNegative ? integerPart.substring(1) : integerPart
    
    if (absoluteInteger.length <= 3) {
      return decimalPart ? `${integerPart}.${decimalPart}` : integerPart
    }
    
    // Indian format: last 3 digits, then groups of 2
    const lastThree = absoluteInteger.substring(absoluteInteger.length - 3)
    const otherNumbers = absoluteInteger.substring(0, absoluteInteger.length - 3)
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    const formatted = `${formattedOther},${lastThree}`
    
    const result = (isNegative ? '-' : '') + formatted
    return decimalPart ? `${result}.${decimalPart}` : result
  }

  // Get face card configuration by ID (for draggable cards)
  const getFaceCardConfig = (cardId, stats) => {
    const configs = {
      1: { id: 1, title: 'Total Clients', value: stats.totalClients, simple: true, borderColor: 'border-blue-200', textColor: 'text-blue-600' },
      2: { id: 2, title: 'Total Balance', value: formatIndianNumber(stats.totalBalance.toFixed(2)), simple: true, borderColor: 'border-indigo-200', textColor: 'text-indigo-600' },
      3: { id: 3, title: 'Total Credit', value: formatIndianNumber(stats.totalCredit.toFixed(2)), simple: true, borderColor: 'border-emerald-200', textColor: 'text-emerald-600' },
      4: { id: 4, title: 'Total Equity', value: formatIndianNumber(stats.totalEquity.toFixed(2)), simple: true, borderColor: 'border-sky-200', textColor: 'text-sky-600' },
      5: { id: 5, title: 'PNL', value: stats.totalPnl, withIcon: true, isPositive: stats.totalPnl >= 0, formattedValue: formatIndianNumber(Math.abs(stats.totalPnl).toFixed(2)) },
      6: { id: 6, title: 'Floating Profit', value: stats.totalProfit, withIcon: true, isPositive: stats.totalProfit >= 0, formattedValue: formatIndianNumber(Math.abs(stats.totalProfit).toFixed(2)), iconColor: stats.totalProfit >= 0 ? 'teal' : 'orange' },
      7: { id: 7, title: 'Total Deposit', value: formatIndianNumber(stats.totalDeposit.toFixed(2)), simple: true, borderColor: 'border-purple-200', textColor: 'text-purple-600', valueColor: 'text-purple-700' },
      8: { id: 8, title: 'Daily Deposit', value: formatIndianNumber(stats.dailyDeposit.toFixed(2)), simple: true, borderColor: 'border-green-200', textColor: 'text-green-600', valueColor: 'text-green-700' },
      9: { id: 9, title: 'Daily Withdrawal', value: formatIndianNumber(stats.dailyWithdrawal.toFixed(2)), simple: true, borderColor: 'border-red-200', textColor: 'text-red-600', valueColor: 'text-red-700' },
      10: { id: 10, title: 'Daily PnL', value: stats.dailyPnL, withArrow: true, isPositive: stats.dailyPnL >= 0, formattedValue: formatIndianNumber(Math.abs(stats.dailyPnL).toFixed(2)), borderColor: stats.dailyPnL >= 0 ? 'border-emerald-200' : 'border-rose-200', textColor: stats.dailyPnL >= 0 ? 'text-emerald-600' : 'text-rose-600', valueColor: stats.dailyPnL >= 0 ? 'text-emerald-700' : 'text-rose-700' },
      11: { id: 11, title: 'This Week PnL', value: stats.thisWeekPnL, withArrow: true, isPositive: stats.thisWeekPnL >= 0, formattedValue: formatIndianNumber(Math.abs(stats.thisWeekPnL).toFixed(2)), borderColor: stats.thisWeekPnL >= 0 ? 'border-cyan-200' : 'border-amber-200', textColor: stats.thisWeekPnL >= 0 ? 'text-cyan-600' : 'text-amber-600', valueColor: stats.thisWeekPnL >= 0 ? 'text-cyan-700' : 'text-amber-700' },
      12: { id: 12, title: 'This Month PnL', value: stats.thisMonthPnL, withArrow: true, isPositive: stats.thisMonthPnL >= 0, formattedValue: formatIndianNumber(Math.abs(stats.thisMonthPnL).toFixed(2)), borderColor: stats.thisMonthPnL >= 0 ? 'border-teal-200' : 'border-orange-200', textColor: stats.thisMonthPnL >= 0 ? 'text-teal-600' : 'text-orange-600', valueColor: stats.thisMonthPnL >= 0 ? 'text-teal-700' : 'text-orange-700' },
      13: { id: 13, title: 'Lifetime PnL', value: stats.lifetimePnL, withArrow: true, isPositive: stats.lifetimePnL >= 0, formattedValue: formatIndianNumber(Math.abs(stats.lifetimePnL).toFixed(2)), borderColor: stats.lifetimePnL >= 0 ? 'border-violet-200' : 'border-pink-200', textColor: stats.lifetimePnL >= 0 ? 'text-violet-600' : 'text-pink-600', valueColor: stats.lifetimePnL >= 0 ? 'text-violet-700' : 'text-pink-700' }
    }
    return configs[cardId]
  }

  // Memoize face card stats - ULTRA optimized
  const faceCardStats = useMemo(() => {
    const hasFilters = filterByPositions || filterByCredit || searchQuery || Object.keys(columnFilters).length > 0
    
    if (!hasFilters) {
      // No filters - use pre-calculated stats (O(1))
      return clientStats
    }
    
    // Has filters - calculate ONLY if showing face cards
    if (!showFaceCards) {
      return clientStats // Don't waste CPU if face cards are hidden
    }
    
    // Optimized single-loop calculation
    const len = filteredClients.length
    let totalBalance = 0, totalCredit = 0, totalEquity = 0, totalPnl = 0, totalProfit = 0
    let dailyDeposit = 0, dailyWithdrawal = 0, dailyPnL = 0, thisWeekPnL = 0, thisMonthPnL = 0, lifetimePnL = 0
    let totalDeposit = 0  // NEW: Cumulative sum of all daily deposits
    
    for (let i = 0; i < len; i++) {
      const c = filteredClients[i]
      totalBalance += c.balance || 0
      totalCredit += c.credit || 0
      totalEquity += c.equity || 0
      totalPnl += c.pnl || 0
      totalProfit += c.profit || 0
      dailyDeposit += c.dailyDeposit || 0  // Fixed: API uses camelCase
      dailyWithdrawal += c.dailyWithdrawal || 0  // Fixed: API uses camelCase
      dailyPnL += (c.dailyPnL || 0) * -1
      thisWeekPnL += (c.thisWeekPnL || 0) * -1
      thisMonthPnL += (c.thisMonthPnL || 0) * -1
      lifetimePnL += (c.lifetimePnL || 0) * -1
      totalDeposit += c.dailyDeposit || 0  // NEW: Sum all daily deposits for Total Deposit
    }
    
    return {
      totalClients: len,
      totalBalance, totalCredit, totalEquity, totalPnl, totalProfit,
      dailyDeposit, dailyWithdrawal, dailyPnL, thisWeekPnL, thisMonthPnL, lifetimePnL,
      totalDeposit  // NEW: Add totalDeposit to returned stats
    }
  }, [clientStats, filteredClients, filterByPositions, filterByCredit, searchQuery, columnFilters, showFaceCards])

  const formatValue = (key, value, client = null) => {
    if (value === null || value === undefined || value === '') {
      // Handle PNL calculation
      if (key === 'pnl' && client) {
        const pnl = (client.credit || 0) - (client.equity || 0)
        return pnl.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })
      }
      return '-'
    }
    
    // Numeric currency fields
    if (['balance', 'credit', 'equity', 'margin', 'marginFree', 'profit', 'floating', 'pnl', 'assets', 'liabilities', 
         'blockedCommission', 'blockedProfit', 'storage', 'marginInitial', 'marginMaintenance', 
         'soEquity', 'soMargin'].includes(key)) {
      // For PNL, calculate credit - equity
      if (key === 'pnl' && client) {
        const pnl = (client.credit || 0) - (client.equity || 0)
        const formatted = formatIndianNumber(pnl.toFixed(2))
        return formatted
      }
      const num = parseFloat(value)
      const formatted = formatIndianNumber(num.toFixed(2))
      return formatted
    }
    
    // Percentage fields
    if (key === 'marginLevel' || key === 'applied_percentage' || key === 'soLevel') {
      return value != null && value !== '' ? `${parseFloat(value).toFixed(2)}%` : '-'
    }
    
    // Integer fields
    if (['leverage', 'marginLeverage', 'agent', 'clientID', 'soActivation', 'soTime', 
         'currencyDigits', 'rightsMask', 'language'].includes(key)) {
      const formatted = formatIndianNumber(parseInt(value))
      return formatted
    }
    
    // Boolean fields
    if (key === 'applied_percentage_is_custom') {
      return value ? 'Yes' : 'No'
    }
    
    // Date/timestamp fields (Unix timestamps in seconds)
    if (['registration', 'lastAccess', 'lastUpdate', 'accountLastUpdate', 'userLastUpdate'].includes(key)) {
      return new Date(value * 1000).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // Array fields (rights)
    if (key === 'rights' && Array.isArray(value)) {
      return value.join(', ')
    }
    
    return value
  }

  // Removed full-page loading spinner to prevent page reload effect on refresh
  // Data updates will happen in place for better UX

  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Clean White Background */}
      <div className="absolute inset-0 bg-white"></div>
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-hidden relative z-10">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-700 hover:text-gray-900 p-2.5 rounded-lg hover:bg-gray-100 border border-gray-300 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Clients</h1>
                <p className="text-xs font-medium text-gray-600 mt-1">Manage and view all client accounts</p>
                {/* Timestamp Info */}
                <div className="mt-2 flex items-center gap-4 text-[10px] font-mono">
                  <div className="flex items-center gap-1" title="Current system time">
                    <span className="text-gray-500 font-semibold">System:</span>
                    <span className="text-blue-600 font-bold">{Math.floor(systemTime / 1000)}</span>
                  </div>
                  {appTime && (
                    <>
                      <div className="flex items-center gap-1" title="Latest WebSocket event timestamp from server">
                        <span className="text-gray-500 font-semibold">Event:</span>
                        <span className="text-purple-600 font-bold">{Math.floor(appTime / 1000)}</span>
                      </div>
                      <div className="flex items-center gap-1" title="Processing latency - how far behind we are">
                        <span className="text-gray-500 font-semibold">Lag:</span>
                        <span className={`font-bold ${
                          Math.abs(Math.floor(systemTime / 1000) - Math.floor(appTime / 1000)) <= 2 
                            ? 'text-green-600' 
                            : Math.abs(Math.floor(systemTime / 1000) - Math.floor(appTime / 1000)) <= 5
                              ? 'text-orange-500'
                              : 'text-red-600'
                        }`}>
                          {Math.abs(Math.floor(systemTime / 1000) - Math.floor(appTime / 1000))}s
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
              
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="text-emerald-700 hover:text-emerald-800 px-3 py-2 rounded-md hover:bg-emerald-50 border-2 border-emerald-300 hover:border-emerald-500 transition-all inline-flex items-center gap-2 text-sm font-semibold bg-white shadow-sm h-9"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                  {(filterByPositions || filterByCredit) && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-sm">
                      {(filterByPositions ? 1 : 0) + (filterByCredit ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilterMenu && (
                  <div
                    ref={filterMenuRef}
                    className="absolute right-0 top-full mt-2 bg-emerald-50 rounded-lg shadow-xl border-2 border-emerald-200 py-2 z-50 w-52"
                  >
                    <div className="px-3 py-2 border-b border-emerald-200">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Filter Options</p>
                    </div>
                    <div className="py-2">
                      <label className="flex items-center px-3 py-2 hover:bg-emerald-100 cursor-pointer transition-colors rounded-md mx-2">
                        <input
                          type="checkbox"
                          checked={filterByPositions}
                          onChange={(e) => setFilterByPositions(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 focus:ring-1"
                        />
                        <span className="ml-2 text-xs font-semibold text-gray-700">Has Floating</span>
                      </label>
                      <label className="flex items-center px-3 py-2 hover:bg-emerald-100 cursor-pointer transition-colors rounded-md mx-2">
                        <input
                          type="checkbox"
                          checked={filterByCredit}
                          onChange={(e) => setFilterByCredit(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 focus:ring-1"
                        />
                        <span className="ml-2 text-xs font-semibold text-gray-700">Has Credit</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Columns Button */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="text-amber-700 hover:text-amber-800 px-3 py-2 rounded-md hover:bg-amber-50 border-2 border-amber-300 hover:border-amber-500 transition-all inline-flex items-center gap-2 text-sm font-semibold bg-white shadow-sm h-9"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Columns
                </button>
                {showColumnSelector && (
                  <div
                    ref={columnSelectorRef}
                    className="absolute right-0 top-full mt-2 bg-amber-50 rounded-lg shadow-xl border-2 border-amber-200 py-2 z-50 w-52"
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                  >
                    <div className="px-3 py-2 border-b border-amber-200">
                      <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Show/Hide Columns</p>
                    </div>
                    {allColumns.map(col => (
                      <label
                        key={col.key}
                        className="flex items-center px-3 py-2 hover:bg-amber-100 cursor-pointer transition-colors rounded-md mx-2"
                      >
                        <input
                          type="checkbox"
                          checked={visibleColumns[col.key]}
                          onChange={() => toggleColumn(col.key)}
                          className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 focus:ring-1"
                        />
                        <span className="ml-2 text-xs font-semibold text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white border-2 border-purple-300 rounded-md px-2 shadow-sm h-9">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 50}
                  className={`p-1 rounded hover:bg-purple-100 transition-colors ${zoomLevel <= 50 ? 'opacity-40 cursor-not-allowed' : 'text-purple-600 hover:text-purple-700'}`}
                  title="Zoom Out (Min 50%)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                  </svg>
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-2 text-sm font-bold text-purple-700 hover:bg-purple-100 rounded transition-colors min-w-[45px]"
                  title="Reset Zoom to 100%"
                >
                  {zoomLevel}%
                </button>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 200}
                  className={`p-1 rounded hover:bg-purple-100 transition-colors ${zoomLevel >= 200 ? 'opacity-40 cursor-not-allowed' : 'text-purple-600 hover:text-purple-700'}`}
                  title="Zoom In (Max 200%)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </button>
              </div>
              
              {/* Groups Button */}
              <GroupSelector 
                moduleName="clients" 
                onCreateClick={() => {
                  setEditingGroup(null)
                  setShowGroupModal(true)
                }}
                onEditClick={(group) => {
                  setEditingGroup(group)
                  setShowGroupModal(true)
                }}
              />
              
              {/* Show Face Cards Toggle */}
              <button
                onClick={() => setShowFaceCards(!showFaceCards)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md border-2 transition-all shadow-sm text-sm font-semibold h-9 ${
                  showFaceCards 
                    ? 'bg-blue-50 border-blue-500 text-blue-700' 
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
                title={showFaceCards ? "Hide cards" : "Show cards"}
              >
                <span>Cards</span>
                <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors p-0.5 ${
                  showFaceCards ? 'bg-blue-600' : 'bg-gray-400'
                }`}>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showFaceCards ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>
              
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`text-blue-600 hover:text-blue-700 p-2 rounded-md border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-white transition-all shadow-sm h-9 w-9 flex items-center justify-center ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Refresh clients data"
              >
                <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 bg-red-50 border-l-4 border-red-500 rounded-r p-3 shadow-sm">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Stats Summary */}
          {showFaceCards && (
          <>
            {/* Drag and Drop Instructions */}
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="flex items-center gap-2 text-gray-600 text-xs">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span>Drag cards to reorder</span>
              </div>
              <button
                onClick={resetFaceCardOrder}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
              >
                Reset Order
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {displayMode === 'value' && (
              <>
                {faceCardOrder.map((cardId) => {
                  const card = getFaceCardConfig(cardId, faceCardStats)
                  if (!card) return null
                  
                  // Simple cards (no icons)
                  if (card.simple) {
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleFaceCardDragStart(e, card.id)}
                        onDragEnd={handleFaceCardDragEnd}
                        onDragOver={handleFaceCardDragOver}
                        onDrop={(e) => handleFaceCardDrop(e, card.id)}
                        className={`bg-white rounded shadow-sm border ${card.borderColor} p-2 cursor-move transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95`}
                      >
                        <p className={`text-[10px] font-semibold ${card.textColor} uppercase tracking-wider mb-1`}>{card.title}</p>
                        <p className={`text-sm font-bold ${card.valueColor || 'text-gray-900'}`}>
                          {card.value}
                        </p>
                      </div>
                    )
                  }
                  
                  // Cards with icon (PNL, Floating Profit)
                  if (card.withIcon) {
                    const iconColor = card.iconColor || (card.isPositive ? 'green' : 'red')
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleFaceCardDragStart(e, card.id)}
                        onDragEnd={handleFaceCardDragEnd}
                        onDragOver={handleFaceCardDragOver}
                        onDrop={(e) => handleFaceCardDrop(e, card.id)}
                        className={`bg-white rounded shadow-sm border ${card.isPositive ? `border-${iconColor}-200` : `border-${iconColor === 'green' ? 'red' : iconColor}-200`} p-2 cursor-move transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className={`text-[10px] font-semibold ${card.isPositive ? `text-${iconColor}-600` : `text-${iconColor === 'green' ? 'red' : iconColor}-600`} uppercase`}>{card.title}</p>
                          <div className={`w-6 h-6 ${card.isPositive ? `bg-${iconColor}-50 border border-${iconColor}-100` : `bg-${iconColor === 'green' ? 'red' : iconColor}-50 border border-${iconColor === 'green' ? 'red' : iconColor}-100`} rounded-lg flex items-center justify-center`}>
                            <svg className={`w-3 h-3 ${card.isPositive ? `text-${iconColor}-600` : `text-${iconColor === 'green' ? 'red' : iconColor}-600`}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                              {card.id === 5 && card.isPositive && (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              )}
                              {card.id === 5 && !card.isPositive && (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                              )}
                              {card.id === 6 && (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                              )}
                            </svg>
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${card.isPositive ? `text-${iconColor}-600` : `text-${iconColor === 'green' ? 'red' : iconColor}-600`}`}>
                          {card.isPositive ? '▲ ' : '▼ '}
                          {card.isPositive ? '' : '-'}
                          {card.formattedValue}
                        </p>
                      </div>
                    )
                  }
                  
                  // Cards with arrow (PnL cards)
                  if (card.withArrow) {
                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleFaceCardDragStart(e, card.id)}
                        onDragEnd={handleFaceCardDragEnd}
                        onDragOver={handleFaceCardDragOver}
                        onDrop={(e) => handleFaceCardDrop(e, card.id)}
                        className={`bg-white rounded shadow-sm border ${card.borderColor} p-2 cursor-move transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95`}
                      >
                        <p className={`text-[10px] font-semibold ${card.textColor} uppercase mb-1`}>{card.title}</p>
                        <p className={`text-sm font-bold ${card.valueColor}`}>
                          {card.isPositive ? '▲ ' : '▼ '}
                          {card.isPositive ? '' : '-'}
                          {card.formattedValue}
                        </p>
                      </div>
                    )
                  }
                  
                  return null
                })}
              </>
            )}
            {displayMode === 'percentage' && (
              <>
                <div className="bg-white rounded shadow-sm border border-blue-200 p-2">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0">Total Clients</p>
                  <p className="text-sm font-bold text-gray-900">{filteredClients.length}</p>
                </div>
                <div className="bg-white rounded shadow-sm border border-emerald-200 p-2">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-0">Total Credit %</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {filteredClients.reduce((sum, c) => sum + (c.credit_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-indigo-200 p-2">
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-0">Total Balance %</p>
                  <p className="text-sm font-bold text-indigo-700">
                    {filteredClients.reduce((sum, c) => sum + (c.balance_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-sky-200 p-2">
                  <p className="text-[10px] font-semibold text-sky-600 uppercase mb-0">Total Equity %</p>
                  <p className="text-sm font-bold text-sky-700">
                    {filteredClients.reduce((sum, c) => sum + (c.equity_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'border-green-200' : 'border-red-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'} uppercase mb-0`}>PNL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>Floating Profit %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-green-200 p-2">
                  <p className="text-[10px] font-semibold text-green-600 uppercase mb-0">Daily Deposit</p>
                  <p className="text-sm font-bold text-green-700">
                    {faceCardStats.dailyDeposit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-red-200 p-2">
                  <p className="text-[10px] font-semibold text-red-600 uppercase mb-0">Daily Withdrawal</p>
                  <p className="text-sm font-bold text-red-700">
                    {faceCardStats.dailyWithdrawal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? 'border-emerald-200' : 'border-rose-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} uppercase mb-0`}>Daily PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? 'border-cyan-200' : 'border-amber-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'} uppercase mb-0`}>This Week PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>This Month PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? 'border-violet-200' : 'border-pink-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'} uppercase mb-0`}>Lifetime PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
            {displayMode === 'both' && (
              <>
                {/* Value Cards - First Row */}
                <div className="bg-white rounded shadow-sm border border-blue-200 p-2">
                  <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0">Total Clients</p>
                  <p className="text-sm font-bold text-gray-900">{faceCardStats.totalClients}</p>
                </div>
                <div className="bg-white rounded shadow-sm border border-indigo-200 p-2">
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-0">Total Balance</p>
                  <p className="text-sm font-bold text-indigo-700">
                    {faceCardStats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-emerald-200 p-2">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-0">Total Credit</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {faceCardStats.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-sky-200 p-2">
                  <p className="text-[10px] font-semibold text-sky-600 uppercase mb-0">Total Equity</p>
                  <p className="text-sm font-bold text-sky-700">
                    {faceCardStats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${faceCardStats.totalPnl >= 0 ? 'border-green-200' : 'border-red-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${faceCardStats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'} uppercase mb-0`}>PNL</p>
                  <p className={`text-sm font-bold ${faceCardStats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {faceCardStats.totalPnl >= 0 ? '▲ ' : '▼ '}
                    {faceCardStats.totalPnl >= 0 ? '' : '-'}
                    {Math.abs(faceCardStats.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${faceCardStats.totalProfit >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${faceCardStats.totalProfit >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>Total Floating Profit</p>
                  <p className={`text-sm font-bold ${faceCardStats.totalProfit >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {faceCardStats.totalProfit >= 0 ? '▲ ' : '▼ '}
                    {faceCardStats.totalProfit >= 0 ? '' : '-'}
                    {Math.abs(faceCardStats.totalProfit).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                
                {/* Percentage Indicator Card - Start of Second Row */}
                <div className="bg-white rounded shadow-sm border border-blue-200 p-2 flex items-center justify-center">
                  <p className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                    By Percentage 
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </p>
                </div>
                
                {/* Percentage Cards - Second Row */}
                <div className="bg-white rounded shadow-sm border border-emerald-200 p-2">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-0">Total Credit %</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {filteredClients.reduce((sum, c) => sum + (c.credit_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-indigo-200 p-2">
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-0">Total Balance %</p>
                  <p className="text-sm font-bold text-indigo-700">
                    {filteredClients.reduce((sum, c) => sum + (c.balance_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-sky-200 p-2">
                  <p className="text-[10px] font-semibold text-sky-600 uppercase mb-0">Total Equity %</p>
                  <p className="text-sm font-bold text-sky-700">
                    {filteredClients.reduce((sum, c) => sum + (c.equity_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'border-green-200' : 'border-red-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'} uppercase mb-0`}>PNL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>Total Floating Profit %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                
                {/* New Cards - Third Row (Value) */}
                <div className="bg-white rounded shadow-sm border border-green-200 p-2">
                  <p className="text-[10px] font-semibold text-green-600 uppercase mb-0">Daily Deposit</p>
                  <p className="text-sm font-bold text-green-700">
                    {faceCardStats.dailyDeposit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-red-200 p-2">
                  <p className="text-[10px] font-semibold text-red-600 uppercase mb-0">Daily Withdrawal</p>
                  <p className="text-sm font-bold text-red-700">
                    {faceCardStats.dailyWithdrawal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? 'border-emerald-200' : 'border-rose-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} uppercase mb-0`}>Daily PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? 'border-cyan-200' : 'border-amber-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'} uppercase mb-0`}>This Week PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>This Month PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? 'border-violet-200' : 'border-pink-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'} uppercase mb-0`}>Lifetime PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                
                {/* New Cards - Fourth Row (Percentage) */}
                {/* Percentage Indicator Card - Start of Fourth Row */}
                <div className="bg-white rounded shadow-sm border border-blue-200 p-2 flex items-center justify-center">
                  <p className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                    By Percentage 
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? 'border-emerald-200' : 'border-rose-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} uppercase mb-0`}>Daily PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.dailyPnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? 'border-cyan-200' : 'border-amber-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'} uppercase mb-0`}>This Week PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>This Month PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? 'border-violet-200' : 'border-pink-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'} uppercase mb-0`}>Lifetime PnL %</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.lifetimePnL_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
          </div>
          </>
          )}

          {/* Pagination Controls - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 rounded-lg shadow-md border border-blue-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value === 'All' ? 'All' : parseInt(e.target.value))}
                className="px-2.5 py-1.5 text-xs font-medium border-2 border-blue-300 rounded-md bg-white text-blue-700 hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all shadow-sm"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span className="text-xs font-semibold text-blue-700">entries</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Page Navigation */}
              {itemsPerPage !== 'All' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded-md transition-all shadow-sm ${
                      currentPage === 1
                        ? 'text-gray-300 bg-gray-100 cursor-not-allowed border border-gray-200'
                        : 'text-blue-600 hover:bg-blue-100 hover:text-blue-700 cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-xs font-bold text-white px-3 py-1.5 bg-blue-600 rounded-md shadow-md border border-blue-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded-md transition-all shadow-sm ${
                      currentPage === totalPages
                        ? 'text-gray-300 bg-gray-100 cursor-not-allowed border border-gray-200'
                        : 'text-blue-600 hover:bg-blue-100 hover:text-blue-700 cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Percentage View Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                  className="text-purple-700 hover:text-purple-800 px-2.5 py-1.5 rounded-md hover:bg-purple-50 border-2 border-purple-300 hover:border-purple-500 transition-all inline-flex items-center gap-1.5 text-xs font-semibold bg-white shadow-sm"
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
                    className="absolute right-0 bottom-full mb-2 bg-purple-50 rounded-lg shadow-xl border-2 border-purple-200 py-2 z-[100] w-52"
                  >
                    <div className="px-3 py-2 border-b border-purple-200">
                      <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wide">Display Mode</p>
                    </div>
                    <div className="px-2 py-2 space-y-1">
                      <label className="flex items-center gap-2 text-xs text-gray-700 hover:bg-purple-100 p-2 rounded-md cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="value"
                          checked={displayMode === 'value'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <span className="font-semibold">Without Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 hover:bg-purple-100 p-2 rounded-md cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="percentage"
                          checked={displayMode === 'percentage'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <span className="font-semibold">Show My Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 hover:bg-purple-100 p-2 rounded-md cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="both"
                          checked={displayMode === 'both'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-purple-600 border-gray-300 focus:ring-purple-500"
                        />
                        <span className="font-semibold">Both</span>
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
                    value={searchInput}
                    onChange={(e) => {
                      setSearchInput(e.target.value)
                      setShowSuggestions(true)
                      setCurrentPage(1)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setShowSuggestions(false) }}
                    placeholder="Search login, name, email..."
                    className="pl-10 pr-9 py-2 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-700 placeholder:text-slate-400 hover:border-slate-400 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 w-64 transition-all"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchInput && (
                    <button
                      onClick={() => { setSearchInput(''); setSearchQuery(''); setShowSuggestions(false) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded hover:bg-slate-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {showSuggestions && getSuggestions(filteredClients).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50 max-h-80 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Search Results</p>
                    </div>
                    <div className="py-1">
                      {getSuggestions(filteredClients).map((client, idx) => (
                        <button 
                          key={idx}
                          onClick={() => handleSuggestionClick(client)} 
                          className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border-l-2 border-transparent hover:border-slate-400"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{client.login}</span>
                            <span className="text-slate-500">•</span>
                            <span className="flex-1 ml-2 truncate">{client.name || 'N/A'}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-sm border-2 border-gray-300 flex flex-col" style={{ 
            height: showFaceCards ? 'calc(100vh - 380px)' : 'calc(100vh - 200px)',
            minHeight: '350px',
            overflow: 'hidden'
          }}>
            <div className="overflow-y-auto flex-1" style={{ 
              scrollbarWidth: 'thin',
              scrollbarColor: '#3b82f6 #e5e7eb',
              zoom: `${zoomLevel}%`,
              position: 'relative',
              willChange: 'scroll-position'
            }}>
              <style>{`
                .flex-1::-webkit-scrollbar {
                  width: 8px;
                }
                .flex-1::-webkit-scrollbar-track {
                  background: #f3f4f6;
                }
                .flex-1::-webkit-scrollbar-thumb {
                  background: #2563eb;
                  border-radius: 4px;
                }
                .flex-1::-webkit-scrollbar-thumb:hover {
                  background: #1d4ed8;
                }
              `}</style>
              <table ref={tableRef} className="w-full divide-y divide-gray-200 mb-4" style={{ tableLayout: 'fixed', willChange: 'contents' }}>
                <thead className="bg-blue-600 sticky top-0 shadow-md" style={{ zIndex: 10, overflow: 'visible', willChange: 'auto' }}>
                  <tr>
                    {(() => {
                      // Build the list of columns to render in header based on display mode
                      const baseVisible = allColumns.filter(c => visibleColumns[c.key])
                      const renderCols = []
                      baseVisible.forEach(col => {
                        const widthBaseTotal = baseVisible.length + (displayMode === 'both' ? baseVisible.filter(c => isMetricColumn(c.key)).length : 0)
                        const defaultWidth = 100 / widthBaseTotal

                        // For base column header, adjust label if percentage mode and metric
                        const isMetric = isMetricColumn(col.key)
                        const headerLabel = (displayMode === 'percentage' && isMetric) ? `${col.label} %` : col.label

                        renderCols.push({ key: col.key, label: headerLabel, width: defaultWidth, baseKey: col.key })

                        if (displayMode === 'both' && isMetric) {
                          // Add a virtual percentage column next to it
                          const virtKey = `${col.key}_percentage_display`
                          renderCols.push({ key: virtKey, label: `${col.label} %`, width: defaultWidth, baseKey: col.key })
                        }
                      })

                      return renderCols.map((col, colIndex) => {
                        const filterCount = getActiveFilterCount(col.baseKey)
                        const isFilterable = !col.key.endsWith('_percentage_display') // Only filter base columns
                        const isLastColumn = colIndex >= renderCols.length - 3 // Last 3 columns
                        
                        return (
                        <th
                          key={col.key}
                          className="px-3 py-3 text-left text-xs font-bold text-white uppercase tracking-wider relative group hover:bg-blue-700/70 transition-all"
                          ref={el => { if (el) { if (!headerRefs.current) headerRefs.current = {}; headerRefs.current[col.key] = el } }}
                          style={{ width: columnWidths[col.key] || col.width + '%', minWidth: 50, overflow: 'visible', position: 'relative' }}
                        >
                          {/* Column Resize Handle */}
                          <div 
                            className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-yellow-400 active:bg-yellow-500 z-20 group/resize"
                            onMouseDown={(e) => handleResizeStart(e, col.key)}
                            onDoubleClick={() => handleAutoFit(col.key, col.baseKey)}
                            title="Drag to resize column"
                          >
                            <div className="absolute right-0 top-0 w-1.5 h-full bg-white/30 group-hover/resize:bg-yellow-400 active:bg-yellow-500 transition-colors"></div>
                          </div>
                          
                          <div className="flex items-center gap-1 justify-between">
                            <div 
                              className="flex items-center gap-1 truncate cursor-pointer flex-1"
                              title={col.label}
                              onClick={() => handleSort(col.key)}
                            >
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
                            
                            {isFilterable && (
                              <div className="relative" ref={el => {
                                if (!filterRefs.current) filterRefs.current = {}
                                filterRefs.current[col.baseKey] = el
                              }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (showFilterDropdown === col.baseKey) {
                                      setShowFilterDropdown(null)
                                      setFilterPosition(null)
                                    } else {
                                      const rect = e.currentTarget.getBoundingClientRect()
                                      setFilterPosition({
                                        top: rect.top,
                                        left: rect.left,
                                        right: rect.right,
                                        isLastColumn
                                      })
                                      setShowFilterDropdown(col.baseKey)
                                    }
                                  }}
                                  className={`p-1.5 rounded-md transition-all ${filterCount > 0 ? 'bg-green-400 text-blue-900 hover:bg-green-300 shadow-md' : 'bg-white/20 text-white hover:bg-white/30'}`}
                                  title="Filter column"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                  </svg>
                                  {filterCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow-lg border-2 border-white">
                                      {filterCount}
                                    </span>
                                  )}
                                </button>

                                {showFilterDropdown === col.baseKey && filterPosition && createPortal(
                                  <div 
                                    ref={filterPanelRef}
                                    className="fixed bg-white border-2 border-slate-300 rounded-lg shadow-2xl w-64 h-[500px] flex flex-col text-[11px]"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onWheel={(e) => e.stopPropagation()}
                                    onScroll={(e) => e.stopPropagation()}
                                    style={{
                                      top: `${Math.min(filterPosition.top + 40, window.innerHeight * 0.2)}px`,
                                      left: filterPosition.isLastColumn ? 'auto' : `${filterPosition.right + 8}px`,
                                      right: filterPosition.isLastColumn ? `${window.innerWidth - filterPosition.left + 8}px` : 'auto',
                                      zIndex: 20000000
                                    }}>
                                    {/* Header */}
                                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Filter Menu</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setShowFilterDropdown(null)
                                          }}
                                          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded transition-colors"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>

                                    {/* Quick Clear Filter (top like Syncfusion) */}
                                    <div className="border-b border-slate-200 py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          clearColumnFilter(col.baseKey)
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
                                          handleSort(col.key)
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
                                          handleSort(col.key)
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
                                    {!isStringColumn(col.baseKey) && (
                                      <div className="border-b border-slate-200 py-1" style={{ overflow: 'visible' }}>
                                        <div className="px-2 py-1 relative group text-[11px]" style={{ overflow: 'visible' }}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setShowNumberFilterDropdown(showNumberFilterDropdown === col.baseKey ? null : col.baseKey)
                                            }}
                                            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 transition-all"
                                          >
                                            <span>Number Filters</span>
                                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                          </button>
                                          
                                          {/* Number Filter Dropdown - Opens to the left to avoid overlap */}
                                          {showNumberFilterDropdown === col.baseKey && (
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
                                                  setCustomFilterColumn(col.baseKey)
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
                                                  setCustomFilterColumn(col.baseKey)
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
                                                  setCustomFilterColumn(col.baseKey)
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
                                                  setCustomFilterColumn(col.baseKey)
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
                                                  setCustomFilterColumn(col.baseKey)
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
                                                  setCustomFilterColumn(col.baseKey)
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
                                                  setCustomFilterColumn(col.baseKey)
                                                  setCustomFilterType('between')
                                                  setShowCustomFilterModal(true)
                                                }}
                                              >
                                                Between...
                                              </div>
                                              <div 
                                                className="hover:bg-gray-50 px-2 py-1 cursor-pointer"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setCustomFilterColumn(col.baseKey)
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
                                    {isStringColumn(col.baseKey) && (
                                      <div className="border-b border-slate-200 py-1" style={{ overflow: 'visible' }}>
                                        <div className="px-2 py-1 relative group text-[11px]" style={{ overflow: 'visible' }}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setShowTextFilterDropdown(showTextFilterDropdown === col.baseKey ? null : col.baseKey)
                                            }}
                                            className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 transition-all"
                                          >
                                            <span>Text Filters</span>
                                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                          </button>
                                          {showTextFilterDropdown === col.baseKey && (
                                            <div 
                                              className="absolute top-0 w-56 bg-white border-2 border-slate-300 rounded-lg shadow-xl"
                                              style={{ left: 'calc(100% + 8px)', zIndex: 10000000 }}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <div className="text-[11px] text-slate-700 py-1">
                                                <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('equal'); setShowCustomTextFilterModal(true) }}>Equal...</div>
                                                <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('notEqual'); setShowCustomTextFilterModal(true) }}>Not Equal...</div>
                                                <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('startsWith'); setShowCustomTextFilterModal(true) }}>Starts With...</div>
                                                <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('endsWith'); setShowCustomTextFilterModal(true) }}>Ends With...</div>
                                                <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('contains'); setShowCustomTextFilterModal(true) }}>Contains...</div>
                                                <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer font-medium transition-colors" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('doesNotContain'); setShowCustomTextFilterModal(true) }}>Does Not Contain...</div>
                                                <div className="hover:bg-gray-50 px-2 py-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); setCustomTextFilterColumn(col.baseKey); setCustomTextFilterType('contains'); setShowCustomTextFilterModal(true) }}>Custom Filter...</div>
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
                                          value={filterSearchQuery[col.baseKey] || ''}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            setFilterSearchQuery(prev => ({
                                              ...prev,
                                              [col.baseKey]: e.target.value
                                            }))
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-full pl-8 pr-3 py-1 text-[11px] font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-700 placeholder:text-slate-400"
                                        />
                                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                      </div>
                                    </div>

                                    {/* Select All / Deselect All */}
                                    <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                                      <label className="flex items-center gap-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isAllSelected(col.baseKey)}
                                          onChange={(e) => {
                                            e.stopPropagation()
                                            if (e.target.checked) {
                                              selectAllFilters(col.baseKey)
                                            } else {
                                              deselectAllFilters(col.baseKey)
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-3.5 h-3.5 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                                        />
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Select All</span>
                                      </label>
                                    </div>

                                    {/* Filter List */}
                                    <div 
                                      className="overflow-y-scroll overflow-x-hidden" 
                                      style={{ 
                                        height: '380px',
                                        scrollbarWidth: 'thin',
                                        scrollbarColor: '#94a3b8 #e2e8f0'
                                      }}
                                      onWheel={(e) => e.stopPropagation()}
                                    >
                                      <style>{`
                                        div.overflow-y-scroll::-webkit-scrollbar {
                                          width: 8px;
                                        }
                                        div.overflow-y-scroll::-webkit-scrollbar-track {
                                          background: #e2e8f0;
                                          border-radius: 4px;
                                        }
                                        div.overflow-y-scroll::-webkit-scrollbar-thumb {
                                          background: #94a3b8;
                                          border-radius: 4px;
                                        }
                                        div.overflow-y-scroll::-webkit-scrollbar-thumb:hover {
                                          background: #64748b;
                                        }
                                      `}</style>
                                      <div className="p-2 space-y-1">
                                        {getUniqueColumnValues(col.baseKey).length === 0 ? (
                                          <div className="px-3 py-3 text-center text-xs text-slate-500 font-medium">
                                            No items found
                                          </div>
                                        ) : (
                                          getUniqueColumnValues(col.baseKey).map(value => (
                                            <label 
                                              key={value} 
                                              className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-md cursor-pointer transition-colors text-[11px]"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <input
                                                type="checkbox"
                                                checked={(columnFilters[col.baseKey] || []).includes(value)}
                                                onChange={(e) => {
                                                  e.stopPropagation()
                                                  toggleColumnFilter(col.baseKey, value)
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-3.5 h-3.5 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                                              />
                                              <span className="text-[11px] text-slate-700 font-medium truncate flex-1">
                                                {formatValue(col.baseKey, value)}
                                              </span>
                                            </label>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    {/* Footer with Action Buttons */}
                                    <div className="px-2 py-1 border-t border-gray-200 bg-gray-50 rounded-b flex items-center justify-between text-[11px]">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          clearColumnFilter(col.baseKey)
                                        }}
                                        className="px-2 py-1 text-[10px] font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded transition-colors"
                                      >
                                        Clear
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setShowFilterDropdown(null)
                                        }}
                                        className="px-2 py-1 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                                      >
                                        OK
                                      </button>
                                    </div>
                                  </div>,
                                  document.body
                                )}
                              </div>
                            )}
                          </div>
                        </th>
                      )})
                    })()}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {displayedClients.map((client, index) => {
                    const isLastRow = index === displayedClients.length - 1
                    
                    // Build render columns for each row consistent with header
                    const baseVisible = allColumns.filter(c => visibleColumns[c.key])
                    const renderCols = []
                    const widthBaseTotal = baseVisible.length + (displayMode === 'both' ? baseVisible.filter(c => isMetricColumn(c.key)).length : 0)
                    const defaultWidth = 100 / widthBaseTotal

                    baseVisible.forEach(col => {
                      const isMetric = isMetricColumn(col.key)

                      // Compute displayed value for base column
                      let titleVal
                      let displayVal
                      if (displayMode === 'percentage' && isMetric) {
                        const percKey = percentageFieldMap[col.key]
                        const val = percKey ? client[percKey] : undefined
                        titleVal = formatPercent(val)
                        displayVal = formatPercent(val)
                      } else {
                        titleVal = formatValue(col.key, client[col.key], client)
                        displayVal = formatValue(col.key, client[col.key], client)
                      }

                      renderCols.push({ key: col.key, width: defaultWidth, value: displayVal, title: titleVal })

                      if (displayMode === 'both' && isMetric) {
                        const virtKey = `${col.key}_percentage_display`
                        const percKey = percentageFieldMap[col.key]
                        const val = percKey ? client[percKey] : undefined
                        renderCols.push({ key: virtKey, width: defaultWidth, value: formatPercent(val), title: formatPercent(val) })
                      }
                    })

                    return (
                      <tr
                        key={client.login}
                        className={`hover:bg-blue-50 transition-all duration-200 ${isLastRow ? 'border-b-2 border-gray-300' : 'border-b border-gray-100 hover:border-blue-200'}`}
                      >
                        {renderCols.map(col => {
                          // Special handling for login column - make it clickable
                          if (col.key === 'login') {
                            return (
                              <td 
                                key={col.key} 
                                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-semibold cursor-pointer hover:underline group-hover:font-bold transition-all" 
                                style={{ width: columnWidths[col.key] || `${col.width}%` }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedClient(client)
                                }}
                                title="Click to view client details"
                              >
                                <div className="truncate flex items-center gap-1">
                                  <svg className="w-3 h-3 inline opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                  {col.value}
                                </div>
                              </td>
                            )
                          }
                          
                          // Regular columns
                          return (
                            <td key={col.key} className="px-3 py-2 text-sm text-gray-800 font-medium" style={{ width: columnWidths[col.key] || `${col.width}%`, minWidth: 50 }}>
                              <div className="truncate" title={col.title}>
                                {col.value}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      {/* Client Positions Modal */}
      {selectedClient && (
        <ClientPositionsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onClientUpdate={fetchClients}
          allPositionsCache={cachedPositions}
          onCacheUpdate={(newAllPositions) => {
            // Positions are managed by DataContext, no need to update local state
          }}
        />
      )}
      
      {/* Group Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false)
          setEditingGroup(null)
        }}
        availableItems={clients}
        loginField="login"
        displayField="name"
        secondaryField="group"
        editGroup={editingGroup}
      />

      {/* Custom Filter Modal */}
      {showCustomFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[30000000]">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]" style={{ marginLeft: '12vw' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Custom Filter</h3>
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
            <div className="p-3 space-y-3 text-[12px]">
              <div>
                <p className="text-[12px] font-medium text-gray-700 mb-2">Show rows where:</p>
                <p className="text-[12px] text-gray-600 mb-3">{customFilterColumn}</p>
              </div>

              {/* Filter Type Dropdown */}
              <div>
                <select
                  value={customFilterType}
                  onChange={(e) => setCustomFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-[12px]"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-[12px]"
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
                      <span className="text-[12px] text-gray-700">AND</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={customFilterOperator === 'OR'}
                        onChange={() => setCustomFilterOperator('OR')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-[12px] text-gray-700">OR</span>
                    </label>
                  </div>

                  <div>
                    <input
                      type="number"
                      value={customFilterValue2}
                      onChange={(e) => setCustomFilterValue2(e.target.value)}
                      placeholder="Enter the value"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-[12px]"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCustomFilterModal(false)
                  setCustomFilterValue1('')
                  setCustomFilterValue2('')
                }}
                className="px-3 py-1.5 text-[12px] text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomNumberFilter}
                disabled={!customFilterValue1}
                className="px-3 py-1.5 text-[12px] text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Text Filter Modal */}
      {showCustomTextFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[30000000]">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]" style={{ marginLeft: '12vw' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Text Filter</h3>
              <button
                onClick={() => {
                  setShowCustomTextFilterModal(false)
                  setCustomTextFilterValue('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-3 space-y-3 text-[12px]">
              <div>
                <p className="text-[12px] font-medium text-gray-700 mb-2">Show rows where:</p>
                <p className="text-[12px] text-gray-600 mb-3">{customTextFilterColumn}</p>
              </div>

              {/* Filter Type Dropdown */}
              <div>
                <select
                  value={customTextFilterType}
                  onChange={(e) => setCustomTextFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-[12px]"
                >
                  <option value="equal">Equal</option>
                  <option value="notEqual">Not Equal</option>
                  <option value="startsWith">Starts With</option>
                  <option value="endsWith">Ends With</option>
                  <option value="contains">Contains</option>
                  <option value="doesNotContain">Does Not Contain</option>
                </select>
              </div>

              {/* Value Input */}
              <div>
                <input
                  type="text"
                  value={customTextFilterValue}
                  onChange={(e) => setCustomTextFilterValue(e.target.value)}
                  placeholder="Enter text"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-[12px]"
                />
              </div>

              {/* Case Sensitive */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={customTextFilterCaseSensitive}
                  onChange={(e) => setCustomTextFilterCaseSensitive(e.target.checked)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[12px] text-gray-700">Case sensitive</span>
              </label>
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCustomTextFilterModal(false)
                  setCustomTextFilterValue('')
                }}
                className="px-3 py-1.5 text-[12px] text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomTextFilter}
                disabled={!customTextFilterColumn}
                className="px-3 py-1.5 text-[12px] text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
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

export default ClientsPage



