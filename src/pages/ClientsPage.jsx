import { useState, useEffect, useRef, useCallback } from 'react'
import { useData } from '../contexts/DataContext'
import { useGroups } from '../contexts/GroupContext'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import WebSocketIndicator from '../components/WebSocketIndicator'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'

const ClientsPage = () => {
  const { clients: cachedClients, positions: cachedPositions, fetchClients, fetchPositions, loading, connectionState } = useData()
  const { filterByActiveGroup } = useGroups()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showDisplayMenu, setShowDisplayMenu] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
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
  
  const tableRef = useRef(null)

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
    clients.forEach(client => {
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
  
  // Get filtered clients based on filter settings
  const getFilteredClients = () => {
    let filtered = [...clients]
    
    if (filterByPositions) {
      // Filter clients who have floating values
      filtered = filtered.filter(c => c.floating && Math.abs(c.floating) > 0)
    }
    
    if (filterByCredit) {
      // Filter clients who have credit (positive or negative, but not zero)
      filtered = filtered.filter(c => c.credit && c.credit !== 0)
    }

    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, values]) => {
      if (columnKey.endsWith('_number')) {
        // Number filter
        const actualColumnKey = columnKey.replace('_number', '')
        filtered = filtered.filter(client => {
          const clientValue = client[actualColumnKey]
          return matchesNumberFilter(clientValue, values)
        })
      } else if (values && values.length > 0) {
        // Regular checkbox filter
        filtered = filtered.filter(client => {
          const clientValue = client[columnKey]
          return values.includes(clientValue)
        })
      }
    })
    
    return filtered
  }
  
  // Sorting function with type detection
  const sortClients = (clientsToSort) => {
    if (!sortColumn) return clientsToSort
    
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
  }
  
  // Search helpers
  const searchClients = (list) => {
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
  }

  const getSuggestions = (sorted) => {
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
  }

  const handleSuggestionClick = (client) => {
    setSearchQuery(String(client.login || ''))
    setShowSuggestions(false)
    setCurrentPage(1)
  }

  const filteredBase = getFilteredClients()
  const searchedBase = searchClients(filteredBase)
  
  // Apply group filter if active
  const groupFilteredBase = filterByActiveGroup(searchedBase, 'login', 'clients')
  
  const filteredClients = sortClients(groupFilteredBase)
  
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
  }, [filterByPositions, filterByCredit, itemsPerPage, searchQuery, displayMode])

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

  const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    const num = Number(value)
    if (isNaN(num)) return '-'
    // Header will carry the % label; values remain numeric
    return num.toFixed(2)
  }

  // Format numbers in Indian currency style (lakhs/crores)
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
    <div className="h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-hidden">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-slate-600 hover:text-slate-900 p-2.5 rounded-lg hover:bg-slate-50 border border-slate-200 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Clients</h1>
                <p className="text-xs font-medium text-slate-500 mt-1">Manage and view all client accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
              
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="text-emerald-700 hover:text-emerald-800 px-2.5 py-1.5 rounded-md hover:bg-emerald-50 border-2 border-emerald-300 hover:border-emerald-500 transition-all inline-flex items-center gap-1.5 text-xs font-semibold bg-white shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                  {(filterByPositions || filterByCredit) && (
                    <span className="ml-0.5 px-1.5 py-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold rounded-full shadow-sm">
                      {(filterByPositions ? 1 : 0) + (filterByCredit ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilterMenu && (
                  <div
                    ref={filterMenuRef}
                    className="absolute right-0 top-full mt-2 bg-gradient-to-br from-emerald-50 to-white rounded-lg shadow-xl border-2 border-emerald-200 py-2 z-50 w-52"
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
                  className="text-amber-700 hover:text-amber-800 px-2.5 py-1.5 rounded-md hover:bg-amber-50 border-2 border-amber-300 hover:border-amber-500 transition-all inline-flex items-center gap-1.5 text-xs font-semibold bg-white shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Columns
                </button>
                {showColumnSelector && (
                  <div
                    ref={columnSelectorRef}
                    className="absolute right-0 top-full mt-2 bg-gradient-to-br from-amber-50 to-white rounded-lg shadow-xl border-2 border-amber-200 py-2 z-50 w-52"
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
              
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Refresh clients data"
              >
                <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {displayMode === 'value' && (
              <>
                <div className="bg-white rounded shadow-sm border border-slate-200 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-slate-600 uppercase">Total Clients</p>
                    <div className="w-6 h-6 bg-blue-50 rounded-lg flex items-center justify-center border border-blue-100">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800">{filteredClients.length}</p>
                </div>
                <div className="bg-white rounded shadow-sm border border-slate-200 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-slate-600 uppercase">Total Balance</p>
                    <div className="w-6 h-6 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
                      <svg className="w-3 h-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-indigo-700">
                    {formatIndianNumber(filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0).toFixed(2))}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-slate-200 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-slate-600 uppercase">Total Credit</p>
                    <div className="w-6 h-6 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100">
                      <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {formatIndianNumber(filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0).toFixed(2))}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-slate-200 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-slate-600 uppercase">Total Equity</p>
                    <div className="w-6 h-6 bg-sky-50 rounded-lg flex items-center justify-center border border-sky-100">
                      <svg className="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-slate-800">
                    {formatIndianNumber(filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0).toFixed(2))}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'border-green-200' : 'border-red-200'} p-2`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'} uppercase`}>PNL</p>
                    <div className={`w-6 h-6 ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'} rounded-lg flex items-center justify-center`}>
                      <svg className={`w-3 h-3 ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        )}
                      </svg>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '' : '-'}
                    {formatIndianNumber(Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0)).toFixed(2))}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase`}>Floating Profit</p>
                    <div className={`w-6 h-6 ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'bg-teal-50 border border-teal-100' : 'bg-orange-50 border border-orange-100'} rounded-lg flex items-center justify-center`}>
                      <svg className={`w-3 h-3 ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '' : '-'}
                    {formatIndianNumber(Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0)).toFixed(2))}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-green-200 p-2">
                  <p className="text-[10px] font-semibold text-green-600 uppercase mb-1">Daily Deposit</p>
                  <p className="text-sm font-bold text-green-700">
                    {formatIndianNumber(filteredClients.reduce((sum, c) => sum + (c.dailyDeposit || 0), 0).toFixed(2))}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-red-200 p-2">
                  <p className="text-[10px] font-semibold text-red-600 uppercase mb-1">Daily Withdrawal</p>
                  <p className="text-sm font-bold text-red-700">
                    {formatIndianNumber(filteredClients.reduce((sum, c) => sum + (c.dailyWithdrawal || 0), 0).toFixed(2))}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? 'border-emerald-200' : 'border-rose-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'} uppercase mb-1`}>Daily PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0) >= 0 ? '' : '-'}
                    {formatIndianNumber(Math.abs(filteredClients.reduce((sum, c) => sum + (c.dailyPnL || 0), 0)).toFixed(2))}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? 'border-cyan-200' : 'border-amber-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'} uppercase mb-1`}>This Week PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? 'text-cyan-700' : 'text-amber-700'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0) >= 0 ? '' : '-'}
                    {formatIndianNumber(Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisWeekPnL || 0), 0)).toFixed(2))}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-1`}>This Month PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? 'text-teal-700' : 'text-orange-700'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0) >= 0 ? '' : '-'}
                    {formatIndianNumber(Math.abs(filteredClients.reduce((sum, c) => sum + (c.thisMonthPnL || 0), 0)).toFixed(2))}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? 'border-violet-200' : 'border-pink-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? 'text-violet-600' : 'text-pink-600'} uppercase mb-1`}>Lifetime PnL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? 'text-violet-700' : 'text-pink-700'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0) >= 0 ? '' : '-'}
                    {formatIndianNumber(Math.abs(filteredClients.reduce((sum, c) => sum + (c.lifetimePnL || 0), 0)).toFixed(2))}
                  </p>
                </div>
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
                    {filteredClients.reduce((sum, c) => sum + (c.dailyDeposit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-red-200 p-2">
                  <p className="text-[10px] font-semibold text-red-600 uppercase mb-0">Daily Withdrawal</p>
                  <p className="text-sm font-bold text-red-700">
                    {filteredClients.reduce((sum, c) => sum + (c.dailyWithdrawal || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <p className="text-sm font-bold text-gray-900">{filteredClients.length}</p>
                </div>
                <div className="bg-white rounded shadow-sm border border-indigo-200 p-2">
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-0">Total Balance</p>
                  <p className="text-sm font-bold text-indigo-700">
                    {filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-emerald-200 p-2">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-0">Total Credit</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-sky-200 p-2">
                  <p className="text-[10px] font-semibold text-sky-600 uppercase mb-0">Total Equity</p>
                  <p className="text-sm font-bold text-sky-700">
                    {filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'border-green-200' : 'border-red-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'} uppercase mb-0`}>PNL</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={`bg-white rounded shadow-sm border ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'border-teal-200' : 'border-orange-200'} p-2`}>
                  <p className={`text-[10px] font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'} uppercase mb-0`}>Total Floating Profit</p>
                  <p className={`text-sm font-bold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    {filteredClients.reduce((sum, c) => sum + (c.dailyDeposit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded shadow-sm border border-red-200 p-2">
                  <p className="text-[10px] font-semibold text-red-600 uppercase mb-0">Daily Withdrawal</p>
                  <p className="text-sm font-bold text-red-700">
                    {filteredClients.reduce((sum, c) => sum + (c.dailyWithdrawal || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

          {/* Pagination Controls - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-md border border-blue-200 p-3">
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
                  
                  <span className="text-xs font-bold text-white px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-md shadow-md border border-blue-700">
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
                    className="absolute right-0 top-full mt-2 bg-gradient-to-br from-purple-50 to-white rounded-lg shadow-xl border-2 border-purple-200 py-2 z-50 w-52"
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
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
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
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setShowSuggestions(false) }}
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
          <div className="bg-white rounded-xl shadow-lg border border-gray-200/50 overflow-hidden flex flex-col backdrop-blur-sm" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table ref={tableRef} className="w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 sticky top-0 z-10 shadow-md">
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
                          style={{ width: `${col.width}%` }}
                        >
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
                                    setShowFilterDropdown(showFilterDropdown === col.baseKey ? null : col.baseKey)
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

                                {showFilterDropdown === col.baseKey && (
                                  <div className="absolute bg-white border-2 border-slate-300 rounded-lg shadow-2xl z-[9999] w-64 max-h-[80vh] flex flex-col"
                                    style={{
                                      overflow: 'hidden',
                                      bottom: '100%',
                                      marginBottom: '-40px',
                                      left: isLastColumn 
                                        ? 'auto'
                                        : '100%',
                                      right: isLastColumn 
                                        ? '100%'
                                        : 'auto',
                                      marginLeft: isLastColumn ? '0' : '8px',
                                      marginRight: isLastColumn ? '8px' : '0'
                                    }}>
                                    {/* Header */}
                                    <div className="px-3 py-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white rounded-t-lg">
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

                                    {/* Sort Options */}
                                    <div className="border-b border-slate-200 py-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleSort(col.key)
                                          setSortDirection('asc')
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
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
                                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                                      >
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                        </svg>
                                        Sort Largest to Smallest
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          clearColumnFilter(col.baseKey)
                                        }}
                                        className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-slate-50 flex items-center gap-2 text-slate-700 transition-colors"
                                      >
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                        </svg>
                                        Clear Filter
                                      </button>
                                    </div>

                                    {/* Number Filters (for all columns) */}
                                    <div className="border-b border-slate-200 py-1" style={{ overflow: 'visible' }}>
                                      <div className="px-2 py-1 relative group" style={{ overflow: 'visible' }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setShowNumberFilterDropdown(showNumberFilterDropdown === col.baseKey ? null : col.baseKey)
                                          }}
                                          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 hover:border-slate-400 transition-all"
                                        >
                                          <span>Number Filters</span>
                                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                        
                                        {/* Number Filter Dropdown - Opens to the right or left based on position */}
                                        {showNumberFilterDropdown === col.baseKey && (
                                          <div 
                                            className="absolute top-0 w-48 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-[10000]"
                                            style={{
                                              left: isLastColumn ? 'auto' : 'calc(100% + 8px)',
                                              right: isLastColumn ? 'calc(100% + 8px)' : 'auto'
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="text-xs text-slate-700 py-1">
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
                                          className="w-full pl-8 pr-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 bg-white text-slate-700 placeholder:text-slate-400"
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
                                    <div className="flex-1 overflow-y-auto">
                                      <div className="p-2 space-y-1">
                                        {getUniqueColumnValues(col.baseKey).length === 0 ? (
                                          <div className="px-3 py-3 text-center text-xs text-slate-500 font-medium">
                                            No items found
                                          </div>
                                        ) : (
                                          getUniqueColumnValues(col.baseKey).map(value => (
                                            <label 
                                              key={value} 
                                              className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
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
                                              <span className="text-xs text-slate-700 font-medium truncate flex-1">
                                                {formatValue(col.baseKey, value)}
                                              </span>
                                            </label>
                                          ))
                                        )}
                                      </div>
                                    </div>

                                    {/* Footer with Action Buttons */}
                                    <div className="px-2 py-1.5 border-t border-gray-200 bg-gray-50 rounded-b flex items-center justify-between">
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
                                  </div>
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
                  {displayedClients.map((client) => {
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
                        className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50/30 transition-all duration-200 border-b border-gray-100 hover:border-blue-200"
                      >
                        {renderCols.map(col => {
                          // Special handling for login column - make it clickable
                          if (col.key === 'login') {
                            return (
                              <td 
                                key={col.key} 
                                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-semibold cursor-pointer hover:underline group-hover:font-bold transition-all" 
                                style={{ width: `${col.width}%` }}
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
                            <td key={col.key} className="px-3 py-2 text-sm text-gray-800 font-medium" style={{ width: `${col.width}%` }}>
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

export default ClientsPage



