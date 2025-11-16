import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'
import IBSelector from '../components/IBSelector'
import api, { brokerAPI } from '../services/api'
import { useGroups } from '../contexts/GroupContext'
import { useIB } from '../contexts/IBContext'

const Client2Page = () => {
  // Group context
  const { filterByActiveGroup, activeGroupFilters, getActiveGroupFilter, groups } = useGroups()
  
  // Get active group for this module
  const activeGroupName = getActiveGroupFilter('client2')
  const activeGroup = groups.find(g => g.name === activeGroupName)
  
  // IB context
  const { filterByActiveIB, selectedIB, ibMT5Accounts, refreshIBList } = useIB()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Data state
  const [clients, setClients] = useState([])
  const [totalClients, setTotalClients] = useState(0)
  const [totals, setTotals] = useState({})
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(100)
  const [totalPages, setTotalPages] = useState(1)
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState([])
  const [mt5Accounts, setMt5Accounts] = useState([])
  const [accountRangeMin, setAccountRangeMin] = useState('')
  const [accountRangeMax, setAccountRangeMax] = useState('')
  
  // Sorting state
  const [sortBy, setSortBy] = useState('')
  const [sortOrder, setSortOrder] = useState('asc')
  const [animationKey, setAnimationKey] = useState(0)
  const [initialLoad, setInitialLoad] = useState(true)
  
  // UI state
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showAccountFilterModal, setShowAccountFilterModal] = useState(false)
  const [showClientDetailModal, setShowClientDetailModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [columnSearchQuery, setColumnSearchQuery] = useState('')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showCardFilterMenu, setShowCardFilterMenu] = useState(false)
  const [cardFilterSearchQuery, setCardFilterSearchQuery] = useState('')
  // Card filter mode: show only percentage cards or only non-percentage cards
  const [cardFilterPercentMode, setCardFilterPercentMode] = useState(() => {
    try {
      const saved = localStorage.getItem('client2CardFilterPercentMode')
      return saved ? JSON.parse(saved) : false
    } catch (e) {
      return false
    }
  })
  const [showFaceCards, setShowFaceCards] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSorting, setIsSorting] = useState(false)
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterDropdown, setShowFilterDropdown] = useState(null)
  const [filterSearchQuery, setFilterSearchQuery] = useState({})
  const [numericFilterTemp, setNumericFilterTemp] = useState({}) // Temporary storage for numeric filters being edited
  const [textFilterTemp, setTextFilterTemp] = useState({}) // Temporary storage for text filters being edited
  const [columnSortOrder, setColumnSortOrder] = useState({}) // Track sort order per column: 'asc', 'desc', or null
  const [filterPosition, setFilterPosition] = useState(null) // Track filter button position for portal
  const [columnValues, setColumnValues] = useState({}) // Store unique values for each column
  const [columnValuesLoading, setColumnValuesLoading] = useState({}) // Track loading state for column values
  const [selectedColumnValues, setSelectedColumnValues] = useState({}) // Track selected values for checkbox filters
  const [columnValueSearch, setColumnValueSearch] = useState({}) // Search query for column value filters
  const [quickFilters, setQuickFilters] = useState({
    hasFloating: false,
    hasCredit: false,
    noDeposit: false
  })
  
  // Column resizing state
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('client2ColumnWidths')) || {}
    } catch (e) {
      return {}
    }
  })

  // useEffect to save columnWidths to localStorage
  useEffect(() => {
    localStorage.setItem('client2ColumnWidths', JSON.stringify(columnWidths))
  }, [columnWidths])

  const columnSelectorRef = useRef(null)
  const filterMenuRef = useRef(null)
  const cardFilterMenuRef = useRef(null)
  const exportMenuRef = useRef(null)
  const filterRefs = useRef({})
  const filterPanelRef = useRef(null)
  const headerRefs = useRef({})
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const resizeRightStartWidth = useRef(0)
  const resizeRAF = useRef(null)
  const resizeRightNeighborKey = useRef(null)
  const measureCanvasRef = useRef(null)
  const tableRef = useRef(null)
  const hScrollRef = useRef(null)
  const [resizingColumn, setResizingColumn] = useState(null)

  // Persist card filter percentage mode
  useEffect(() => {
    try {
      localStorage.setItem('client2CardFilterPercentMode', JSON.stringify(cardFilterPercentMode))
    } catch (e) {
      // ignore
    }
  }, [cardFilterPercentMode])
  
  // Face card visibility state
  const getInitialCardVisibility = () => {
    const saved = localStorage.getItem('client2CardVisibility')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved card visibility:', e)
      }
    }
    // Default: show only essential cards
    return {
      assets: false,
      balance: true,
      blockedCommission: false,
      blockedProfit: false,
      commission: false,
      credit: true,
      dailyBonusIn: false,
      dailyBonusOut: false,
      dailyCreditIn: false,
      dailyCreditOut: false,
      dailyDeposit: true,
      dailyPnL: true,
      dailySOCompensationIn: false,
      dailySOCompensationOut: false,
      dailyWithdrawal: true,
      equity: true,
      floating: false,
      liabilities: false,
      lifetimeBonusIn: false,
      lifetimeBonusOut: false,
      lifetimeCreditIn: false,
      lifetimeCreditOut: false,
      lifetimeDeposit: false,
      lifetimePnL: true,
      lifetimeSOCompensationIn: false,
      lifetimeSOCompensationOut: false,
      lifetimeWithdrawal: false,
      margin: false,
      marginFree: false,
      marginInitial: false,
      marginLevel: false,
      marginMaintenance: false,
      soEquity: false,
      soLevel: false,
      soMargin: false,
      pnl: false,
      previousEquity: false,
      profit: false,
      storage: false,
      // Percent versions (default hidden except P&L %)
      assetsPercent: false,
      balancePercent: false,
      blockedCommissionPercent: false,
      blockedProfitPercent: false,
      commissionPercent: false,
      creditPercent: false,
      dailyBonusInPercent: false,
      dailyBonusOutPercent: false,
      dailyCreditInPercent: false,
      dailyCreditOutPercent: false,
      dailyDepositPercent: false,
      dailyPnLPercent: false,
      dailySOCompensationInPercent: false,
      dailySOCompensationOutPercent: false,
      dailyWithdrawalPercent: false,
      equityPercent: false,
      floatingPercent: false,
      liabilitiesPercent: false,
      lifetimeBonusInPercent: false,
      lifetimeBonusOutPercent: false,
      lifetimeCreditInPercent: false,
      lifetimeCreditOutPercent: false,
      lifetimeDepositPercent: false,
      lifetimePnLPercent: false,
      lifetimeSOCompensationInPercent: false,
      lifetimeSOCompensationOutPercent: false,
      lifetimeWithdrawalPercent: false,
      marginPercent: false,
      marginFreePercent: false,
      marginInitialPercent: false,
      marginLevelPercent: false,
      marginMaintenancePercent: false,
      soEquityPercent: false,
      soLevelPercent: false,
      soMarginPercent: false,
      pnlPercent: true,
      previousEquityPercent: false,
      profitPercent: false,
      storagePercent: false,
      thisMonthBonusIn: false,
      thisMonthBonusOut: false,
      thisMonthCreditIn: false,
      thisMonthCreditOut: false,
      thisMonthDeposit: false,
      thisMonthPnL: false,
      thisMonthSOCompensationIn: false,
      thisMonthSOCompensationOut: false,
      thisMonthWithdrawal: false,
      thisWeekBonusIn: false,
      thisWeekBonusOut: false,
      thisWeekCreditIn: false,
      thisWeekCreditOut: false,
      thisWeekDeposit: false,
      thisWeekPnL: false,
      thisWeekSOCompensationIn: false,
      thisWeekSOCompensationOut: false,
      thisWeekWithdrawal: false,
      // Percent versions for week/month
      thisMonthBonusInPercent: false,
      thisMonthBonusOutPercent: false,
      thisMonthCreditInPercent: false,
      thisMonthCreditOutPercent: false,
      thisMonthDepositPercent: false,
      thisMonthPnLPercent: false,
      thisMonthSOCompensationInPercent: false,
      thisMonthSOCompensationOutPercent: false,
      thisMonthWithdrawalPercent: false,
      thisWeekBonusInPercent: false,
      thisWeekBonusOutPercent: false,
      thisWeekCreditInPercent: false,
      thisWeekCreditOutPercent: false,
      thisWeekDepositPercent: false,
      thisWeekPnLPercent: false,
      thisWeekSOCompensationInPercent: false,
      thisWeekSOCompensationOutPercent: false,
      thisWeekWithdrawalPercent: false
    }
  }
  
  const [cardVisibility, setCardVisibility] = useState(getInitialCardVisibility)
  // Global percentage view disabled; use per-field % cards instead
  const showPercentage = false

  // If any % face card is enabled, send percentage=true in the request
  const percentModeActive = useMemo(() => {
    return Object.entries(cardVisibility || {}).some(([key, value]) => key.endsWith('Percent') && value !== false)
  }, [cardVisibility])
  
  // Filter modal state
  const [newFilterField, setNewFilterField] = useState('balance')
  const [newFilterOperator, setNewFilterOperator] = useState('greater_than')
  const [newFilterValue, setNewFilterValue] = useState('')
  
  // Account filter modal state
  const [accountInputText, setAccountInputText] = useState('')
  const [tempAccountRangeMin, setTempAccountRangeMin] = useState('')
  const [tempAccountRangeMax, setTempAccountRangeMax] = useState('')
  
  // Column visibility state
  const getInitialVisibleColumns = () => {
    const saved = localStorage.getItem('client2PageVisibleColumns')
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
      email: true,
      group: true,
      balance: true,
      equity: true,
      credit: true,
      margin: true,
      marginLevel: true,
      profit: true,
      currency: true,
      leverage: true,
      country: true,
      phone: false,
      city: false,
      state: false,
      address: false,
      zipCode: false,
      company: false,
      comment: false,
      registration: false,
      lastAccess: false,
      marginFree: false,
      floating: false,
      dailyPnL: false,
      thisWeekPnL: false,
      thisMonthPnL: false,
      lifetimePnL: false
    }
  }
  
  const [visibleColumns, setVisibleColumns] = useState(getInitialVisibleColumns)
  
  // All available columns
  const allColumns = [
    { key: 'login', label: 'Login', type: 'integer' },
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'lastName', label: 'Last Name', type: 'text' },
    { key: 'middleName', label: 'Middle Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'group', label: 'Group', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'zipCode', label: 'Zip Code', type: 'text' },
    { key: 'balance', label: 'Balance', type: 'float' },
    { key: 'credit', label: 'Credit', type: 'float' },
    { key: 'equity', label: 'Equity', type: 'float' },
    { key: 'margin', label: 'Margin', type: 'float' },
    { key: 'marginFree', label: 'Margin Free', type: 'float' },
    { key: 'marginLevel', label: 'Margin Level', type: 'float' },
    { key: 'leverage', label: 'Leverage', type: 'integer' },
    { key: 'profit', label: 'Floating Profit', type: 'float' },
    { key: 'floating', label: 'Floating', type: 'float' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'comment', label: 'Comment', type: 'text' },
    { key: 'registration', label: 'Registration', type: 'date' },
    { key: 'lastAccess', label: 'Last Access', type: 'date' },
    { key: 'dailyPnL', label: 'Daily PnL', type: 'float' },
    { key: 'thisWeekPnL', label: 'This Week PnL', type: 'float' },
    { key: 'thisMonthPnL', label: 'This Month PnL', type: 'float' },
    { key: 'lifetimePnL', label: 'Lifetime PnL', type: 'float' }
  ]
  
  // Filter operators by type
  const numberOperators = [
    { value: 'equal', label: 'Equal to (=)' },
    { value: 'not_equal', label: 'Not equal to (≠)' },
    { value: 'greater_than', label: 'Greater than (>)' },
    { value: 'greater_than_equal', label: 'Greater than or equal (≥)' },
    { value: 'less_than', label: 'Less than (<)' },
    { value: 'less_than_equal', label: 'Less than or equal (≤)' },
    { value: 'between', label: 'Between' }
  ]
  
  const textOperators = [
    { value: 'equal', label: 'Equal to' },
    { value: 'not_equal', label: 'Not equal to' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'ends_with', label: 'Ends with' }
  ]
  
  const dateOperators = [
    { value: 'equal', label: 'Equal to' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' }
  ]
  
  // Get operators for selected field
  const getOperatorsForField = (fieldKey) => {
    const column = allColumns.find(col => col.key === fieldKey)
    if (!column) return numberOperators
    
    switch (column.type) {
      case 'text':
        return textOperators
      case 'date':
        return dateOperators
      default:
        return numberOperators
    }
  }
  
  // Get visible columns list
  const visibleColumnsList = useMemo(() => {
    return allColumns.filter(c => visibleColumns[c.key] === true)
  }, [visibleColumns])
  
  // Save visible columns to localStorage
  useEffect(() => {
    localStorage.setItem('client2PageVisibleColumns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  // Persist column widths
  useEffect(() => {
    try {
      localStorage.setItem('client2ColumnWidths', JSON.stringify(columnWidths))
    } catch (e) {
      // ignore
    }
  }, [columnWidths])
  
  // Fetch clients data
  const fetchClients = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      setError('')
      
      // Build request payload - start with empty object for initial load
      const payload = {}
      
      // Only add parameters if they have meaningful values
      if (currentPage > 1) {
        payload.page = currentPage
      }
      if (itemsPerPage !== 100) {
        payload.limit = itemsPerPage
      }
      
      // Add search query if present
      if (searchQuery && searchQuery.trim()) {
        payload.search = searchQuery.trim()
      }
      
      // Add filters if present
      const combinedFilters = []
      if (filters && filters.length > 0) {
        combinedFilters.push(...filters)
      }

      // Map column header filters to API filters
      // Checkbox values: expand into multiple 'equal' filters for the same field
      if (columnFilters && Object.keys(columnFilters).length > 0) {
        Object.entries(columnFilters).forEach(([key, cfg]) => {
          if (key.endsWith('_checkbox') && cfg && Array.isArray(cfg.values) && cfg.values.length > 0) {
            const field = key.replace('_checkbox', '')
            // Expand into OR-like semantics by sending multiple equal filters for the same field
            cfg.values.forEach((val) => {
              combinedFilters.push({ field, operator: 'equal', value: val })
            })
          }
          // Future: number/text header filters can be mapped here if needed
        })
      }

      if (combinedFilters.length > 0) {
        payload.filters = combinedFilters
      }
      
      // Add MT5 accounts filter if present
      if (mt5Accounts && mt5Accounts.length > 0) {
        payload.mt5Accounts = mt5Accounts
      }
      
      // Add account range filter if present
      if (accountRangeMin && accountRangeMin.trim()) {
        payload.accountRangeMin = parseInt(accountRangeMin.trim())
      }
      if (accountRangeMax && accountRangeMax.trim()) {
        payload.accountRangeMax = parseInt(accountRangeMax.trim())
      }
      
      // Add active group filter if present - use API filtering
      if (activeGroup) {
        if (activeGroup.range) {
          // Range-based group
          payload.accountRangeMin = activeGroup.range.from
          payload.accountRangeMax = activeGroup.range.to
          console.log('[Client2] Applying range group filter:', activeGroup.range)
        } else if (activeGroup.loginIds && activeGroup.loginIds.length > 0) {
          // Manual selection group
          payload.mt5Accounts = activeGroup.loginIds.map(id => Number(id))
          console.log('[Client2] Applying manual group filter:', payload.mt5Accounts.length, 'accounts')
        }
      }
      
      // Add sorting if present
      if (sortBy) {
        payload.sortBy = sortBy
        payload.sortOrder = sortOrder
      }

      // Determine whether any normal and/or percent face cards are enabled
      const anyNormal = Object.entries(cardVisibility || {}).some(([key, value]) => !key.endsWith('Percent') && value !== false)
      const anyPercent = percentModeActive

      // Build payloads
      const payloadNormal = { ...payload, percentage: false }
      const payloadPercent = { ...payload, percentage: true }

      // Fetch based on selection: both → fetch both; otherwise fetch one
      if (anyNormal && anyPercent) {
        console.log('[Client2] Sending dual requests:', { normal: payloadNormal, percent: payloadPercent })
        const [respNormal, respPercent] = await Promise.all([
          brokerAPI.searchClients(payloadNormal),
          brokerAPI.searchClients(payloadPercent)
        ])

        // Normal
        if (respNormal && respNormal.data) {
          const dataN = respNormal.data
          setClients(dataN.clients || [])
          setTotalClients(dataN.total || dataN.clients?.length || 0)
          setTotalPages(dataN.pages || 1)
          setTotals(dataN.totals || {})
          setError('')
        } else if (respNormal?.status === 0 && respNormal.data) {
          setClients(respNormal.data.clients || [])
          setTotalClients(respNormal.data.total || 0)
          setTotalPages(respNormal.data.pages || 1)
          setTotals(respNormal.data.totals || {})
          setError('')
        } else {
          setError(respNormal?.message || 'Failed to fetch normal data')
        }

        // Percent
        if (respPercent && respPercent.data) {
          const dataP = respPercent.data
          setTotalsPercent(dataP.totals || {})
        } else if (respPercent?.status === 0 && respPercent.data) {
          setTotalsPercent(respPercent.data.totals || {})
        } else {
          // Do not override previous error; just log
          console.warn('[Client2] Failed to fetch percent data', respPercent)
        }
      } else if (anyPercent) {
        console.log('[Client2] Sending percent request:', payloadPercent)
        const response = await brokerAPI.searchClients(payloadPercent)
        if (response && response.data) {
          const data = response.data
          setClients(data.clients || [])
          setTotalClients(data.total || data.clients?.length || 0)
          setTotalPages(data.pages || 1)
          setTotals({})
          setTotalsPercent(data.totals || {})
          setError('')
        } else if (response?.status === 0 && response.data) {
          setClients(response.data.clients || [])
          setTotalClients(response.data.total || 0)
          setTotalPages(response.data.pages || 1)
          setTotals({})
          setTotalsPercent(response.data.totals || {})
          setError('')
        } else {
          setError(response?.message || 'Failed to fetch percent data')
        }
      } else {
        console.log('[Client2] Sending normal request:', payloadNormal)
        const response = await brokerAPI.searchClients(payloadNormal)
        if (response && response.data) {
          const data = response.data
          setClients(data.clients || [])
          setTotalClients(data.total || data.clients?.length || 0)
          setTotalPages(data.pages || 1)
          setTotals(data.totals || {})
          setTotalsPercent({})
          setError('')
        } else if (response?.status === 0 && response.data) {
          setClients(response.data.clients || [])
          setTotalClients(response.data.total || 0)
          setTotalPages(response.data.pages || 1)
          setTotals(response.data.totals || {})
          setTotalsPercent({})
          setError('')
        } else {
          setError(response?.message || 'Failed to fetch clients')
        }
      }
    } catch (err) {
      console.error('[Client2] Error fetching clients:', err)
      if (!silent) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch clients')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
      // Mark initial load complete and always reset sorting state
      setInitialLoad(false)
      setIsSorting(false)
    }
  }, [currentPage, itemsPerPage, searchQuery, filters, columnFilters, mt5Accounts, accountRangeMin, accountRangeMax, sortBy, sortOrder, percentModeActive, activeGroup])
  
  // Refetch when any percent face card visibility toggles
  useEffect(() => {
    fetchClients(false)
  }, [percentModeActive, fetchClients])
  
  // Client-side filtering and sorting
  const sortedClients = useMemo(() => {
    let filtered = [...clients]
    
    // Apply quick filters first
    if (quickFilters.hasFloating) {
      filtered = filtered.filter(client => {
        const floatingValue = parseFloat(client.floating) || 0
        return floatingValue > 0
      })
    }
    
    if (quickFilters.hasCredit) {
      filtered = filtered.filter(client => {
        const creditValue = parseFloat(client.credit) || 0
        return creditValue > 0
      })
    }
    
    if (quickFilters.noDeposit) {
      filtered = filtered.filter(client => {
        const depositValue = parseFloat(client.lifetimeDeposit) || 0
        return depositValue === 0
      })
    }
    
    // Column header filters are applied on the server (API-only). Skip client-side filtering here.
    
    // Apply IB filter (only when an IB with accounts is selected)
    if (selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0) {
      filtered = filterByActiveIB(filtered, 'login')
    }
    
    // Apply column-specific sorting (from filter menu)
    const sortColumnKey = Object.keys(columnSortOrder)[0]
    if (sortColumnKey && columnSortOrder[sortColumnKey]) {
      const direction = columnSortOrder[sortColumnKey]
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumnKey]
        const bVal = b[sortColumnKey]
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        
        // Handle numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // Handle strings (case-insensitive)
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        
        if (direction === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
        }
      })
    }
    // Apply default sorting
    else if (sortBy && filtered.length > 0) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        
        // Handle numbers
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // Handle strings (case-insensitive)
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        
        if (sortOrder === 'asc') {
          return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
        } else {
          return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
        }
      })
    }
    
    return filtered
  }, [clients, sortBy, sortOrder, columnFilters, columnSortOrder, quickFilters, filterByActiveIB, selectedIB, ibMT5Accounts])
  
  // Initial fetch and refetch on dependency changes
  useEffect(() => {
    fetchClients()
  }, [fetchClients])
  
  // Percentage view is now controlled by Card Filter (cardVisibility.percentage) and fetched together with main data
  
  // Auto-refresh every 1 second (silent update)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchClients(true) // silent = true, no loading spinner
    }, 1000)
    
    return () => clearInterval(intervalId)
  }, [fetchClients])
  
  // Handle search
  const handleSearch = () => {
    setSearchQuery(searchInput)
    setCurrentPage(1)
  }
  
  // Handle sort
  const handleSort = (columnKey) => {
    // Set sorting loading state
    setIsSorting(true)
    
    // Increment animation key to force re-render and re-trigger animations
    setAnimationKey(prev => prev + 1)
    
    if (sortBy === columnKey) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(columnKey)
      setSortOrder('asc')
    }
    // Don't reset page - keep user on current page
  }

  // Column resize handlers with RAF for smooth performance (Excel-like)
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

  const handleAutoFit = (columnKey, baseKey) => {
    try {
      const headerText = visibleColumnsList.find(c => c.key === columnKey)?.label || ''
      const headerWidth = measureText(headerText) + 60 // +60 for padding, icons, etc
      
      let maxCellWidth = headerWidth
      const columnData = clients.map(row => row[baseKey || columnKey])
      
      columnData.forEach(val => {
        const cellWidth = measureText(val) + 40 // +40 for padding
        if (cellWidth > maxCellWidth) maxCellWidth = cellWidth
      })
      
      const finalWidth = Math.max(50, Math.min(600, Math.ceil(maxCellWidth)))
      setColumnWidths(prev => ({ ...prev, [columnKey]: finalWidth }))
    } catch (err) {
      console.error('[Client2Page] Auto-fit error:', err)
    }
  }
  
  // Column filter functions
  const getUniqueColumnValues = useMemo(() => {
    // Create a cache object for all columns
    const cache = {}
    
    return (columnKey) => {
      // Return cached result if search query hasn't changed
      const cacheKey = `${columnKey}_${filterSearchQuery[columnKey] || ''}`
      if (cache[cacheKey]) {
        return cache[cacheKey]
      }
      
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
      const result = searchQuery
        ? sortedValues.filter(value => 
            String(value).toLowerCase().includes(searchQuery)
          )
        : sortedValues
      
      // Cache the result
      cache[cacheKey] = result
      return result
    }
  }, [clients, filterSearchQuery])
  
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
      const checkboxFilterKey = `${columnKey}_checkbox`
      const { [columnKey]: _, [numberFilterKey]: __, [textFilterKey]: ___, [checkboxFilterKey]: ____, ...rest } = prev
      return rest
    })
    setFilterSearchQuery(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })
    // Reset selected values to all
    if (columnValues[columnKey]) {
      setSelectedColumnValues(prev => ({
        ...prev,
        [columnKey]: [...columnValues[columnKey]]
      }))
    }
    clearSort(columnKey)
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
    
    // Check for checkbox value filter
    const checkboxFilterKey = `${columnKey}_checkbox`
    const hasCheckboxFilter = columnFilters[checkboxFilterKey] ? 1 : 0
    
    return checkboxCount + hasNumberFilter + hasTextFilter + hasCheckboxFilter
  }
  
  const isAllSelected = (columnKey) => {
    const allValues = getUniqueColumnValues(columnKey)
    const selectedValues = columnFilters[columnKey] || []
    return allValues.length > 0 && selectedValues.length === allValues.length
  }
  
  const applyNumberFilter = (columnKey) => {
    const temp = numericFilterTemp[columnKey]
    if (!temp || !temp.value1) return
    
    if (temp.operator === 'between' && !temp.value2) return
    
    const filterConfig = {
      operator: temp.operator,
      value1: parseFloat(temp.value1),
      value2: temp.value2 ? parseFloat(temp.value2) : null
    }
    
    setColumnFilters(prev => ({
      ...prev,
      [`${columnKey}_number`]: filterConfig
    }))
    
    setShowFilterDropdown(null)
  }
  
  const initNumericFilterTemp = (columnKey) => {
    if (!numericFilterTemp[columnKey]) {
      setNumericFilterTemp(prev => ({
        ...prev,
        [columnKey]: { operator: 'equal', value1: '', value2: '' }
      }))
    }
  }
  
  const updateNumericFilterTemp = (columnKey, field, value) => {
    setNumericFilterTemp(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey],
        [field]: value
      }
    }))
  }
  
  const initTextFilterTemp = (columnKey) => {
    if (!textFilterTemp[columnKey]) {
      setTextFilterTemp(prev => ({
        ...prev,
        [columnKey]: { operator: 'equal', value: '', caseSensitive: false }
      }))
    }
  }
  
  const updateTextFilterTemp = (columnKey, field, value) => {
    setTextFilterTemp(prev => ({
      ...prev,
      [columnKey]: {
        ...prev[columnKey],
        [field]: value
      }
    }))
  }
  
  const applyTextFilter = (columnKey) => {
    const temp = textFilterTemp[columnKey]
    if (!temp || !temp.value) return
    
    const filterConfig = {
      operator: temp.operator,
      value: temp.value,
      caseSensitive: temp.caseSensitive
    }
    
    setColumnFilters(prev => ({
      ...prev,
      [`${columnKey}_text`]: filterConfig
    }))
    
    setShowFilterDropdown(null)
  }

  // Fetch unique column values from API for checkbox filter
  const fetchColumnValues = async (columnKey) => {
    // Don't fetch if already loading or already loaded
    if (columnValuesLoading[columnKey] || columnValues[columnKey]) return
    
    setColumnValuesLoading(prev => ({ ...prev, [columnKey]: true }))
    
    try {
      // Map the column key to the actual API field name
      // Remove 'Percent' suffix if present
      const apiFieldName = columnKey.replace(/Percent$/, '')

      // Helper to perform a request and extract uniques for a given fields list
      const requestAndExtract = async (fieldsParam) => {
        const qs = new URLSearchParams({ fields: fieldsParam, page: 1, limit: 1000 }).toString()
  const res = await api.get(`/api/broker/clients/fields?${qs}`)
        if (res?.data?.status !== 'success') return []
        const rows = res.data?.data?.clients || []
        const set = new Set()
        for (const row of rows) {
          const val = row?.[apiFieldName]
          if (val !== null && val !== undefined && val !== '') set.add(val)
        }
        return Array.from(set)
      }

      // 1) Try with the single field first
      let uniqueValues = await requestAndExtract(apiFieldName)

      // 2) Fallback: ask for a broader common field set (covers most string columns)
      if (!uniqueValues || uniqueValues.length === 0) {
        const broadFields = [
          'login','name','lastName','middleName','email','phone','group','country','city','state','zipCode','address','company','comment','currency'
        ].join(',')
        uniqueValues = await requestAndExtract(broadFields)
      }

  // Sort alphabetically and persist
      uniqueValues.sort((a, b) => String(a).localeCompare(String(b)))
      setColumnValues(prev => ({ ...prev, [columnKey]: uniqueValues }))
  // Do NOT pre-select all values. Start with none selected; user will choose and click OK.
  setSelectedColumnValues(prev => ({ ...prev, [columnKey]: [] }))
    } catch (err) {
      console.error(`[Client2Page] Error fetching column values for ${columnKey}:`, err)
    } finally {
      setColumnValuesLoading(prev => ({ ...prev, [columnKey]: false }))
    }
  }

  // Toggle individual value selection
  const toggleColumnValue = (columnKey, value) => {
    setSelectedColumnValues(prev => {
      const currentSelected = prev[columnKey] || []
      const isSelected = currentSelected.includes(value)
      
      if (isSelected) {
        return { ...prev, [columnKey]: currentSelected.filter(v => v !== value) }
      } else {
        return { ...prev, [columnKey]: [...currentSelected, value] }
      }
    })
  }

  // Toggle select all for column
  const toggleSelectAllColumnValues = (columnKey) => {
    const allValues = columnValues[columnKey] || []
    const currentSelected = selectedColumnValues[columnKey] || []
    
    if (currentSelected.length === allValues.length) {
      // Deselect all
      setSelectedColumnValues(prev => ({ ...prev, [columnKey]: [] }))
    } else {
      // Select all
      setSelectedColumnValues(prev => ({ ...prev, [columnKey]: [...allValues] }))
    }
  }

  // Apply checkbox filter
  const applyCheckboxFilter = (columnKey) => {
    const selected = selectedColumnValues[columnKey] || []
    
    if (selected.length === 0) {
      // No values selected, clear filter
      clearColumnFilter(columnKey)
      return
    }
    
    // Create a filter configuration for checkbox selection
    setColumnFilters(prev => ({
      ...prev,
      [`${columnKey}_checkbox`]: { values: selected }
    }))
    
    setShowFilterDropdown(null)
    // Immediately refetch via API with new header filters and reset to first page
    setCurrentPage(1)
    fetchClients(false)
  }
  
  const applySortToColumn = (columnKey, direction) => {
    setColumnSortOrder({
      [columnKey]: direction // Only one column can be sorted at a time
    })
    setShowFilterDropdown(null)
  }
  
  const clearSort = (columnKey) => {
    setColumnSortOrder(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })
  }
  
  const getColumnType = (columnKey) => {
    const column = allColumns.find(col => col.key === columnKey)
    return column?.type || 'text'
  }
  
  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value === 'All' ? 10000 : parseInt(value))
    setCurrentPage(1)
  }
  
  // Toggle column visibility
  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }
  
  // Add filter
  const handleAddFilter = () => {
    if (!newFilterValue.trim()) {
      alert('Please enter a filter value')
      return
    }
    
    const newFilter = {
      field: newFilterField,
      operator: newFilterOperator,
      value: newFilterValue.trim()
    }
    
    setFilters(prev => [...prev, newFilter])
    setNewFilterValue('')
    setShowFilterModal(false)
    setCurrentPage(1)
  }
  
  // Remove filter
  const handleRemoveFilter = (index) => {
    setFilters(prev => prev.filter((_, i) => i !== index))
    setCurrentPage(1)
  }
  
  // Clear all filters
  const handleClearAllFilters = () => {
    setFilters([])
    setCurrentPage(1)
  }
  
  // Apply account filters
  const handleApplyAccountFilters = () => {
    // Parse MT5 accounts from text input
    if (accountInputText.trim()) {
      const accounts = accountInputText
        .split(/[\s,;]+/)
        .map(a => a.trim())
        .filter(a => a && !isNaN(parseInt(a)))
        .map(a => parseInt(a))
      setMt5Accounts(accounts)
    } else {
      setMt5Accounts([])
    }
    
    // Set account range
    setAccountRangeMin(tempAccountRangeMin)
    setAccountRangeMax(tempAccountRangeMax)
    
    setShowAccountFilterModal(false)
    setCurrentPage(1)
  }
  
  // Clear account filters
  const handleClearAccountFilters = () => {
    setMt5Accounts([])
    setAccountRangeMin('')
    setAccountRangeMax('')
    setAccountInputText('')
    setTempAccountRangeMin('')
    setTempAccountRangeMax('')
    setCurrentPage(1)
  }
  
  // Export to CSV
  const handleExportToCSV = () => {
    if (clients.length === 0) {
      alert('No data to export')
      return
    }
    
    // Get headers
    const headers = visibleColumnsList.map(col => col.label).join(',')
    
    // Get rows
    const rows = clients.map(client => {
      return visibleColumnsList.map(col => {
        let value = client[col.key]
        
        // Format value
        if (value === null || value === undefined || value === '') {
          return ''
        }
        
        // Escape quotes and commas
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""')
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value}"`
          }
        }
        
        return value
      }).join(',')
    }).join('\n')
    
    const csvContent = headers + '\n' + rows
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `client2_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
  
  // Manual refresh handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetchClients()
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }
  
  // Export to Excel handler
  const handleExportToExcel = (type) => {
    setShowExportMenu(false)
    
    if (type === 'table') {
      // Export current table view
      downloadCSV(clients, `clients_table_${new Date().toISOString().split('T')[0]}.csv`)
    } else if (type === 'all') {
      // Export all data
      downloadCSV(clients, `clients_all_${new Date().toISOString().split('T')[0]}.csv`)
    }
  }
  
  // View client details
  const handleViewClientDetails = (client) => {
    setSelectedClient(client)
    setShowClientDetailModal(true)
  }
  
  // Format value for display
  const formatValue = (key, value) => {
    if (value === null || value === undefined || value === '') {
      return '-'
    }
    
    // Format numbers with Indian style
    if (['balance', 'credit', 'equity', 'margin', 'marginFree', 'profit', 'floating', 
         'dailyPnL', 'thisWeekPnL', 'thisMonthPnL', 'lifetimePnL'].includes(key)) {
      const num = parseFloat(value)
      if (isNaN(num)) return '-'
      return formatIndianNumber(num.toFixed(2))
    }
    
    // Format margin level as percentage
    if (key === 'marginLevel') {
      const num = parseFloat(value)
      if (isNaN(num)) return '-'
      return `${num.toFixed(2)}%`
    }
    
    // Format leverage
    if (key === 'leverage') {
      return `1:${value}`
    }
    
    // Format dates
    if (key === 'registration' || key === 'lastAccess') {
      if (!value) return '-'
      const timestamp = parseInt(value)
      if (isNaN(timestamp)) return value
      const date = new Date(timestamp * 1000)
      return date.toLocaleString()
    }
    
    return value
  }
  
  // Get color class for numeric values
  const getValueColorClass = (key, value) => {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    
    // Color code profit/loss fields
    if (['profit', 'floating', 'dailyPnL', 'thisWeekPnL', 'thisMonthPnL', 'lifetimePnL'].includes(key)) {
      const num = parseFloat(value)
      if (isNaN(num)) return ''
      if (num > 0) return 'text-green-600 font-semibold'
      if (num < 0) return 'text-red-600 font-semibold'
    }
    
    // Color code margin level
    if (key === 'marginLevel') {
      const num = parseFloat(value)
      if (isNaN(num)) return ''
      if (num < 100) return 'text-red-600 font-semibold'
      if (num < 200) return 'text-orange-600 font-semibold'
      return 'text-green-600'
    }
    
    return ''
  }
  
  // Format numbers in Indian style
  const formatIndianNumber = (num) => {
    const numStr = num.toString()
    const [integerPart, decimalPart] = numStr.split('.')
    
    const isNegative = integerPart.startsWith('-')
    const absoluteInteger = isNegative ? integerPart.substring(1) : integerPart
    
    if (absoluteInteger.length <= 3) {
      return decimalPart ? `${integerPart}.${decimalPart}` : integerPart
    }
    
    const lastThree = absoluteInteger.substring(absoluteInteger.length - 3)
    const otherNumbers = absoluteInteger.substring(0, absoluteInteger.length - 3)
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    const formatted = `${formattedOther},${lastThree}`
    
    const result = (isNegative ? '-' : '') + formatted
    return decimalPart ? `${result}.${decimalPart}` : result
  }
  
  // Percentage mode: just append a percent sign to the normal formatted number
  const formatPercentageValue = (value) => {
    if (value == null || value === '') return ''
    const num = Number(value) || 0
    return `${formatIndianNumber(num.toFixed(2))} %`
  }
  
  // Percent totals (server response when percentage:true)
  const [totalsPercent, setTotalsPercent] = useState({})

  // Save card visibility to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('client2CardVisibility', JSON.stringify(cardVisibility))
  }, [cardVisibility])
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
      if (cardFilterMenuRef.current && !cardFilterMenuRef.current.contains(event.target)) {
        setShowCardFilterMenu(false)
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false)
      }
      // Close filter dropdown if clicking outside
      if (showFilterDropdown) {
        const clickedInsideButton = filterRefs.current[showFilterDropdown]?.contains(event.target)
        const clickedInsideDropdown = document.querySelector('.filter-dropdown-panel')?.contains(event.target)
        if (!clickedInsideButton && !clickedInsideDropdown) {
          setShowFilterDropdown(null)
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown])
  
  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Clean White Background */}
      <div className="absolute inset-0 bg-white"></div>
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-hidden relative z-10">
        <div className="max-w-full mx-auto h-full flex flex-col min-h-0" style={{ zoom: '90%' }}>
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
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Client 2</h1>
                <p className="text-xs font-medium text-gray-600 mt-1">
                  Advanced search with {totalClients.toLocaleString()} clients
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Filter Button (Green/Emerald Theme) */}
              <div className="relative" ref={filterMenuRef}>
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors font-medium text-sm"
                  title="Filter Options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                </button>
                
                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border-2 border-emerald-300 z-50">
                    <div className="p-3">
                      <div className="text-xs font-semibold text-gray-700 mb-3">Quick Filters</div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={quickFilters.hasFloating}
                            onChange={(e) => {
                              setQuickFilters(prev => ({
                                ...prev,
                                hasFloating: e.target.checked
                              }))
                            }}
                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Has Floating</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={quickFilters.hasCredit}
                            onChange={(e) => {
                              setQuickFilters(prev => ({
                                ...prev,
                                hasCredit: e.target.checked
                              }))
                            }}
                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">Has Credit</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={quickFilters.noDeposit}
                            onChange={(e) => {
                              setQuickFilters(prev => ({
                                ...prev,
                                noDeposit: e.target.checked
                              }))
                            }}
                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                          />
                          <span className="text-sm text-gray-700">No Deposit</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Card Filter Button (Pink Theme) */}
              <div className="relative" ref={cardFilterMenuRef}>
                <button
                  onClick={() => setShowCardFilterMenu(!showCardFilterMenu)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-lg border-2 border-pink-300 text-pink-700 hover:bg-pink-50 transition-colors font-medium text-sm"
                  title="Toggle Card Visibility"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Card Filter
                </button>
                {/* Percentage Toggle moved next to Card Filter (as a sibling) */}
                
                {showCardFilterMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border-2 border-pink-300 z-50 max-h-96 overflow-y-auto" style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#9ca3af #f3f4f6'
                  }}>
                    <style>{`
                      .overflow-y-auto::-webkit-scrollbar {
                        width: 8px;
                      }
                      .overflow-y-auto::-webkit-scrollbar-track {
                        background: #f3f4f6;
                      }
                      .overflow-y-auto::-webkit-scrollbar-thumb {
                        background: #9ca3af;
                        border-radius: 4px;
                      }
                      .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                        background: #6b7280;
                      }
                    `}</style>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-semibold text-gray-700">Show/Hide Cards</div>
                        <button
                          onClick={() => {
                            // Determine the keys currently displayed in the menu and toggle only those
                            const baseLabels = {
                              assets: 'Assets',
                              balance: 'Balance',
                              blockedCommission: 'Blocked Commission',
                              blockedProfit: 'Blocked Profit',
                              commission: 'Commission',
                              credit: 'Credit',
                              dailyBonusIn: 'Daily Bonus In',
                              dailyBonusOut: 'Daily Bonus Out',
                              dailyCreditIn: 'Daily Credit In',
                              dailyCreditOut: 'Daily Credit Out',
                              dailyDeposit: 'Daily Deposit',
                              dailyPnL: 'Daily P&L',
                              dailySOCompensationIn: 'Daily SO Compensation In',
                              dailySOCompensationOut: 'Daily SO Compensation Out',
                              dailyWithdrawal: 'Daily Withdrawal',
                              equity: 'Equity',
                              floating: 'Floating',
                              liabilities: 'Liabilities',
                              lifetimeBonusIn: 'Lifetime Bonus In',
                              lifetimeBonusOut: 'Lifetime Bonus Out',
                              lifetimeCreditIn: 'Lifetime Credit In',
                              lifetimeCreditOut: 'Lifetime Credit Out',
                              lifetimeDeposit: 'Lifetime Deposit',
                              lifetimePnL: 'Lifetime P&L',
                              lifetimeSOCompensationIn: 'Lifetime SO Compensation In',
                              lifetimeSOCompensationOut: 'Lifetime SO Compensation Out',
                              lifetimeWithdrawal: 'Lifetime Withdrawal',
                              margin: 'Margin',
                              marginFree: 'Margin Free',
                              marginInitial: 'Margin Initial',
                              marginLevel: 'Margin Level',
                              marginMaintenance: 'Margin Maintenance',
                              soEquity: 'SO Equity',
                              soLevel: 'SO Level',
                              soMargin: 'SO Margin',
                              pnl: 'P&L',
                              previousEquity: 'Previous Equity',
                              profit: 'Profit',
                              storage: 'Storage',
                              thisMonthBonusIn: 'This Month Bonus In',
                              thisMonthBonusOut: 'This Month Bonus Out',
                              thisMonthCreditIn: 'This Month Credit In',
                              thisMonthCreditOut: 'This Month Credit Out',
                              thisMonthDeposit: 'This Month Deposit',
                              thisMonthPnL: 'This Month P&L',
                              thisMonthSOCompensationIn: 'This Month SO Compensation In',
                              thisMonthSOCompensationOut: 'This Month SO Compensation Out',
                              thisMonthWithdrawal: 'This Month Withdrawal',
                              thisWeekBonusIn: 'This Week Bonus In',
                              thisWeekBonusOut: 'This Week Bonus Out',
                              thisWeekCreditIn: 'This Week Credit In',
                              thisWeekCreditOut: 'This Week Credit Out',
                              thisWeekDeposit: 'This Week Deposit',
                              thisWeekPnL: 'This Week P&L',
                              thisWeekSOCompensationIn: 'This Week SO Compensation In',
                              thisWeekSOCompensationOut: 'This Week SO Compensation Out',
                              thisWeekWithdrawal: 'This Week Withdrawal'
                            }
                            const baseItems = Object.entries(baseLabels).map(([key, label]) => [key, label])
                            const percentItems = Object.entries(baseLabels).map(([key, label]) => [`${key}Percent`, `${label} %`])
                            const items = cardFilterPercentMode ? percentItems : baseItems
                            const filteredItems = items.filter(([_, label]) =>
                              cardFilterSearchQuery === '' || label.toLowerCase().includes(cardFilterSearchQuery.toLowerCase())
                            )
                            const displayedKeys = filteredItems.map(([key]) => key)
                            const allVisible = displayedKeys.every(k => cardVisibility[k] !== false)
                            const newVisibility = { ...cardVisibility }
                            displayedKeys.forEach(k => { newVisibility[k] = !allVisible })
                            setCardVisibility(newVisibility)
                          }}
                          className="text-xs text-pink-600 hover:text-pink-700 font-medium"
                        >
                          {/* Determine button label based on displayed items only */}
                          {(() => {
                            const baseLabels = {
                              assets: 'Assets', balance: 'Balance', blockedCommission: 'Blocked Commission', blockedProfit: 'Blocked Profit', commission: 'Commission', credit: 'Credit', dailyBonusIn: 'Daily Bonus In', dailyBonusOut: 'Daily Bonus Out', dailyCreditIn: 'Daily Credit In', dailyCreditOut: 'Daily Credit Out', dailyDeposit: 'Daily Deposit', dailyPnL: 'Daily P&L', dailySOCompensationIn: 'Daily SO Compensation In', dailySOCompensationOut: 'Daily SO Compensation Out', dailyWithdrawal: 'Daily Withdrawal', equity: 'Equity', floating: 'Floating', liabilities: 'Liabilities', lifetimeBonusIn: 'Lifetime Bonus In', lifetimeBonusOut: 'Lifetime Bonus Out', lifetimeCreditIn: 'Lifetime Credit In', lifetimeCreditOut: 'Lifetime Credit Out', lifetimeDeposit: 'Lifetime Deposit', lifetimePnL: 'Lifetime P&L', lifetimeSOCompensationIn: 'Lifetime SO Compensation In', lifetimeSOCompensationOut: 'Lifetime SO Compensation Out', lifetimeWithdrawal: 'Lifetime Withdrawal', margin: 'Margin', marginFree: 'Margin Free', marginInitial: 'Margin Initial', marginLevel: 'Margin Level', marginMaintenance: 'Margin Maintenance', soEquity: 'SO Equity', soLevel: 'SO Level', soMargin: 'SO Margin', pnl: 'P&L', previousEquity: 'Previous Equity', profit: 'Profit', storage: 'Storage', thisMonthBonusIn: 'This Month Bonus In', thisMonthBonusOut: 'This Month Bonus Out', thisMonthCreditIn: 'This Month Credit In', thisMonthCreditOut: 'This Month Credit Out', thisMonthDeposit: 'This Month Deposit', thisMonthPnL: 'This Month P&L', thisMonthSOCompensationIn: 'This Month SO Compensation In', thisMonthSOCompensationOut: 'This Month SO Compensation Out', thisMonthWithdrawal: 'This Month Withdrawal', thisWeekBonusIn: 'This Week Bonus In', thisWeekBonusOut: 'This Week Bonus Out', thisWeekCreditIn: 'This Week Credit In', thisWeekCreditOut: 'This Week Credit Out', thisWeekDeposit: 'This Week Deposit', thisWeekPnL: 'This Week P&L', thisWeekSOCompensationIn: 'This Week SO Compensation In', thisWeekSOCompensationOut: 'This Week SO Compensation Out', thisWeekWithdrawal: 'This Week Withdrawal'
                            }
                            const baseItems = Object.entries(baseLabels).map(([key, label]) => [key, label])
                            const percentItems = Object.entries(baseLabels).map(([key, label]) => [`${key}Percent`, `${label} %`])
                            const items = cardFilterPercentMode ? percentItems : baseItems
                            const filteredItems = items.filter(([_, label]) =>
                              cardFilterSearchQuery === '' || label.toLowerCase().includes(cardFilterSearchQuery.toLowerCase())
                            )
                            const displayedKeys = filteredItems.map(([key]) => key)
                            const allVisible = displayedKeys.every(k => cardVisibility[k] !== false)
                            return allVisible ? 'Hide All' : 'Show All'
                          })()}
                        </button>
                      </div>
                      
                      <input
                        type="text"
                        placeholder="Search cards..."
                        value={cardFilterSearchQuery}
                        onChange={(e) => setCardFilterSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-lg mb-3 focus:outline-none focus:border-pink-300 text-gray-900 bg-white"
                      />
                      
                      <div className="space-y-1">
                        {(() => {
                          const baseLabels = {
                            assets: 'Assets',
                            balance: 'Balance',
                            blockedCommission: 'Blocked Commission',
                            blockedProfit: 'Blocked Profit',
                            commission: 'Commission',
                            credit: 'Credit',
                            dailyBonusIn: 'Daily Bonus In',
                            dailyBonusOut: 'Daily Bonus Out',
                            dailyCreditIn: 'Daily Credit In',
                            dailyCreditOut: 'Daily Credit Out',
                            dailyDeposit: 'Daily Deposit',
                            dailyPnL: 'Daily P&L',
                            dailySOCompensationIn: 'Daily SO Compensation In',
                            dailySOCompensationOut: 'Daily SO Compensation Out',
                            dailyWithdrawal: 'Daily Withdrawal',
                            equity: 'Equity',
                            floating: 'Floating',
                            liabilities: 'Liabilities',
                            lifetimeBonusIn: 'Lifetime Bonus In',
                            lifetimeBonusOut: 'Lifetime Bonus Out',
                            lifetimeCreditIn: 'Lifetime Credit In',
                            lifetimeCreditOut: 'Lifetime Credit Out',
                            lifetimeDeposit: 'Lifetime Deposit',
                            lifetimePnL: 'Lifetime P&L',
                            lifetimeSOCompensationIn: 'Lifetime SO Compensation In',
                            lifetimeSOCompensationOut: 'Lifetime SO Compensation Out',
                            lifetimeWithdrawal: 'Lifetime Withdrawal',
                            margin: 'Margin',
                            marginFree: 'Margin Free',
                            marginInitial: 'Margin Initial',
                            marginLevel: 'Margin Level',
                            marginMaintenance: 'Margin Maintenance',
                            soEquity: 'SO Equity',
                            soLevel: 'SO Level',
                            soMargin: 'SO Margin',
                            pnl: 'P&L',
                            previousEquity: 'Previous Equity',
                            profit: 'Profit',
                            storage: 'Storage',
                            thisMonthBonusIn: 'This Month Bonus In',
                            thisMonthBonusOut: 'This Month Bonus Out',
                            thisMonthCreditIn: 'This Month Credit In',
                            thisMonthCreditOut: 'This Month Credit Out',
                            thisMonthDeposit: 'This Month Deposit',
                            thisMonthPnL: 'This Month P&L',
                            thisMonthSOCompensationIn: 'This Month SO Compensation In',
                            thisMonthSOCompensationOut: 'This Month SO Compensation Out',
                            thisMonthWithdrawal: 'This Month Withdrawal',
                            thisWeekBonusIn: 'This Week Bonus In',
                            thisWeekBonusOut: 'This Week Bonus Out',
                            thisWeekCreditIn: 'This Week Credit In',
                            thisWeekCreditOut: 'This Week Credit Out',
                            thisWeekDeposit: 'This Week Deposit',
                            thisWeekPnL: 'This Week P&L',
                            thisWeekSOCompensationIn: 'This Week SO Compensation In',
                            thisWeekSOCompensationOut: 'This Week SO Compensation Out',
                            thisWeekWithdrawal: 'This Week Withdrawal'
                          }
                          // Build items based on toggle: only non-percent OR only percent
                          const baseItems = Object.entries(baseLabels).map(([key, label]) => [key, label])
                          const percentItems = Object.entries(baseLabels).map(([key, label]) => [`${key}Percent`, `${label} %`])
                          return (cardFilterPercentMode ? percentItems : baseItems)
                            .filter(([key, label]) =>
                              cardFilterSearchQuery === '' ||
                              label.toLowerCase().includes(cardFilterSearchQuery.toLowerCase())
                            )
                            .map(([key, label]) => (
                              <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                <input
                                  type="checkbox"
                                  checked={cardVisibility[key] !== false}
                                  onChange={(e) => {
                                    setCardVisibility(prev => ({
                                      ...prev,
                                      [key]: e.target.checked
                                    }))
                                  }}
                                  className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                                />
                                <span className="text-sm text-gray-700">{label}</span>
                              </label>
                            ))
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Percentage Toggle next to Card Filter button */}
              <div className="flex items-center gap-2 select-none">
                <span className="text-[11px] text-gray-700">Percentage</span>
                <button
                  onClick={() => setCardFilterPercentMode(v => !v)}
                  className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors p-0.5 ${
                    cardFilterPercentMode ? 'bg-pink-600' : 'bg-gray-400'
                  }`}
                  title="Toggle percentage cards in Card Filter"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      cardFilterPercentMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              
              {/* Groups Button */}
              <GroupSelector 
                onCreateClick={() => setShowGroupModal(true)}
                onEditClick={() => setShowGroupModal(true)}
                moduleName="client2"
              />
              
              {/* IB Filter Button */}
              <IBSelector />
              
              {/* Cards Toggle Button */}
              <button
                onClick={() => setShowFaceCards(!showFaceCards)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all shadow-sm text-sm font-semibold h-9 ${
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

              {/* Refresh Button */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`text-blue-600 hover:text-blue-700 p-2 rounded-lg border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-white transition-all shadow-sm h-9 w-9 flex items-center justify-center ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Refresh clients data"
              >
                <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Excel Export with Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="text-green-600 hover:text-green-700 p-2 rounded-lg border-2 border-green-300 hover:border-green-500 hover:bg-green-50 bg-white transition-all shadow-sm h-9 w-9 flex items-center justify-center"
                  title="Download as Excel (CSV)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border-2 border-green-300 z-50 overflow-hidden">
                    <div className="py-1">
                      <button
                        onClick={() => handleExportToExcel('table')}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Table View
                      </button>
                      <button
                        onClick={() => handleExportToExcel('all')}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-green-50 hover:text-green-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        Export All Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Face Cards Section */}
          {showFaceCards && ((totals && Object.keys(totals).length > 0) || (totalsPercent && Object.keys(totalsPercent).length > 0)) && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-700">Summary Statistics</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                {/* Assets */}
                {cardVisibility.assets !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-blue-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-blue-600 mb-1">Assets</div>
                    <div className="text-sm font-bold text-blue-700">{formatIndianNumber(((totals?.assets) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Balance */}
                {cardVisibility.balance !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-indigo-600 mb-1">Balance</div>
                    <div className="text-sm font-bold text-indigo-700">{formatIndianNumber(((totals?.balance) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Blocked Commission */}
                {cardVisibility.blockedCommission !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-gray-300 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-gray-600 mb-1">Blocked Commission</div>
                    <div className="text-sm font-bold text-gray-700">{formatIndianNumber(((totals?.blockedCommission) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Blocked Profit */}
                {cardVisibility.blockedProfit !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-orange-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-orange-600 mb-1">Blocked Profit</div>
                    <div className={`text-sm font-bold ${((totals?.blockedProfit) || 0) >= 0 ? 'text-orange-700' : 'text-red-700'}`}>{formatIndianNumber(((totals?.blockedProfit) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Commission */}
                {cardVisibility.commission !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-amber-600 mb-1">Commission</div>
                    <div className="text-sm font-bold text-amber-700">{formatIndianNumber(((totals?.commission) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Credit */}
                {cardVisibility.credit !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-emerald-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-emerald-600 mb-1">Credit</div>
                    <div className="text-sm font-bold text-emerald-700">{formatIndianNumber(((totals?.credit) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily Bonus In */}
                {cardVisibility.dailyBonusIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-emerald-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-emerald-600 mb-1">Daily Bonus In</div>
                    <div className="text-sm font-bold text-emerald-700">{formatIndianNumber(((totals?.dailyBonusIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily Bonus Out */}
                {cardVisibility.dailyBonusOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-rose-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-rose-600 mb-1">Daily Bonus Out</div>
                    <div className="text-sm font-bold text-rose-700">{formatIndianNumber(((totals?.dailyBonusOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily Credit In */}
                {cardVisibility.dailyCreditIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-teal-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-teal-600 mb-1">Daily Credit In</div>
                    <div className="text-sm font-bold text-teal-700">{formatIndianNumber(((totals?.dailyCreditIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily Credit Out */}
                {cardVisibility.dailyCreditOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-amber-600 mb-1">Daily Credit Out</div>
                    <div className="text-sm font-bold text-amber-700">{formatIndianNumber(((totals?.dailyCreditOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily Deposit */}
                {cardVisibility.dailyDeposit !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-green-600 mb-1">Daily Deposit</div>
                    <div className="text-sm font-bold text-green-700">{formatIndianNumber(((totals?.dailyDeposit) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily PnL */}
                {cardVisibility.dailyPnL !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.dailyPnL || 0) >= 0 ? 'border-emerald-200' : 'border-rose-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.dailyPnL || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Daily PnL</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.dailyPnL || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {(totals.dailyPnL || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.dailyPnL) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* Daily SO Compensation In */}
                {cardVisibility.dailySOCompensationIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-lime-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-lime-600 mb-1">Daily SO Compensation In</div>
                    <div className="text-sm font-bold text-lime-700">{formatIndianNumber(((totals?.dailySOCompensationIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily SO Compensation Out */}
                {cardVisibility.dailySOCompensationOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-yellow-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-yellow-600 mb-1">Daily SO Compensation Out</div>
                    <div className="text-sm font-bold text-yellow-700">{formatIndianNumber(((totals?.dailySOCompensationOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Daily Withdrawal */}
                {cardVisibility.dailyWithdrawal !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-red-600 mb-1">Daily Withdrawal</div>
                    <div className="text-sm font-bold text-red-700">{formatIndianNumber(((totals?.dailyWithdrawal) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Equity */}
                {cardVisibility.equity !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-sky-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-sky-600 mb-1">Equity</div>
                    <div className="text-sm font-bold text-sky-700">{formatIndianNumber(((totals?.equity) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Floating */}
                {cardVisibility.floating !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.floating || 0) >= 0 ? 'border-teal-200' : 'border-orange-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.floating || 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>Floating</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.floating || 0) >= 0 ? 'text-teal-700' : 'text-orange-700'}`}>
                      {(totals.floating || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.floating) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* Liabilities */}
                {cardVisibility.liabilities !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-red-600 mb-1">Liabilities</div>
                    <div className="text-sm font-bold text-red-700">{formatIndianNumber(((totals?.liabilities) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime Bonus In */}
                {cardVisibility.lifetimeBonusIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-emerald-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-emerald-600 mb-1">Lifetime Bonus In</div>
                    <div className="text-sm font-bold text-emerald-700">{formatIndianNumber(((totals?.lifetimeBonusIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime Bonus Out */}
                {cardVisibility.lifetimeBonusOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-rose-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-rose-600 mb-1">Lifetime Bonus Out</div>
                    <div className="text-sm font-bold text-rose-700">{formatIndianNumber(((totals?.lifetimeBonusOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime Credit In */}
                {cardVisibility.lifetimeCreditIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-teal-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-teal-600 mb-1">Lifetime Credit In</div>
                    <div className="text-sm font-bold text-teal-700">{formatIndianNumber(((totals?.lifetimeCreditIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime Credit Out */}
                {cardVisibility.lifetimeCreditOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-amber-600 mb-1">Lifetime Credit Out</div>
                    <div className="text-sm font-bold text-amber-700">{formatIndianNumber(((totals?.lifetimeCreditOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime Deposit */}
                {cardVisibility.lifetimeDeposit !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-green-600 mb-1">Lifetime Deposit</div>
                    <div className="text-sm font-bold text-green-700">{formatIndianNumber(((totals?.lifetimeDeposit) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime PnL */}
                {cardVisibility.lifetimePnL !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.lifetimePnL || 0) >= 0 ? 'border-violet-200' : 'border-pink-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.lifetimePnL || 0) >= 0 ? 'text-violet-600' : 'text-pink-600'}`}>Lifetime PnL</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.lifetimePnL || 0) >= 0 ? 'text-violet-700' : 'text-pink-700'}`}>
                      {(totals.lifetimePnL || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.lifetimePnL) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* Lifetime SO Compensation In */}
                {cardVisibility.lifetimeSOCompensationIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-lime-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-lime-600 mb-1">Lifetime SO Compensation In</div>
                    <div className="text-sm font-bold text-lime-700">{formatIndianNumber(((totals?.lifetimeSOCompensationIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime SO Compensation Out */}
                {cardVisibility.lifetimeSOCompensationOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-yellow-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-yellow-600 mb-1">Lifetime SO Compensation Out</div>
                    <div className="text-sm font-bold text-yellow-700">{formatIndianNumber(((totals?.lifetimeSOCompensationOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Lifetime Withdrawal */}
                {cardVisibility.lifetimeWithdrawal !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-red-600 mb-1">Lifetime Withdrawal</div>
                    <div className="text-sm font-bold text-red-700">{formatIndianNumber(((totals?.lifetimeWithdrawal) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Margin */}
                {cardVisibility.margin !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-purple-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-purple-600 mb-1">Margin</div>
                    <div className="text-sm font-bold text-purple-700">{formatIndianNumber(((totals?.margin) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Margin Free */}
                {cardVisibility.marginFree !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-fuchsia-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-fuchsia-600 mb-1">Margin Free</div>
                    <div className="text-sm font-bold text-fuchsia-700">{formatIndianNumber(((totals?.marginFree) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Margin Initial */}
                {cardVisibility.marginInitial !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-indigo-600 mb-1">Margin Initial</div>
                    <div className="text-sm font-bold text-indigo-700">{formatIndianNumber(((totals?.marginInitial) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Margin Level */}
                {cardVisibility.marginLevel !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-purple-300 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-purple-600 mb-1">Margin Level</div>
                    <div className="text-sm font-bold text-purple-700">{formatPercentageValue((totals?.marginLevel) || 0)}</div>
                  </div>
                )}

                {/* Margin Maintenance */}
                {cardVisibility.marginMaintenance !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-violet-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-violet-600 mb-1">Margin Maintenance</div>
                    <div className="text-sm font-bold text-violet-700">{formatIndianNumber(((totals?.marginMaintenance) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* SO Equity */}
                {cardVisibility.soEquity !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-indigo-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-indigo-600 mb-1">SO Equity</div>
                    <div className="text-sm font-bold text-indigo-700">{formatIndianNumber(((totals?.soEquity) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* SO Level */}
                {cardVisibility.soLevel !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-blue-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-blue-600 mb-1">SO Level</div>
                    <div className="text-sm font-bold text-blue-700">{formatIndianNumber(((totals?.soLevel) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* SO Margin */}
                {cardVisibility.soMargin !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-sky-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-sky-600 mb-1">SO Margin</div>
                    <div className="text-sm font-bold text-sky-700">{formatIndianNumber(((totals?.soMargin) || 0).toFixed(2))}</div>
                  </div>
                )}
                {/* PnL */}
                {cardVisibility.pnl !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.pnl || 0) >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.pnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>PnL</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.pnl || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {(totals.pnl || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.pnl) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* Previous Equity */}
                {cardVisibility.previousEquity !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-cyan-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-cyan-600 mb-1">Previous Equity</div>
                    <div className="text-sm font-bold text-cyan-700">{formatIndianNumber(((totals?.previousEquity) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Profit */}
                {cardVisibility.profit !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.profit || 0) >= 0 ? 'border-teal-200' : 'border-orange-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.profit || 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>Profit</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.profit || 0) >= 0 ? 'text-teal-700' : 'text-orange-700'}`}>
                      {(totals.profit || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.profit) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* Storage */}
                {cardVisibility.storage !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-gray-300 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-gray-600 mb-1">Storage</div>
                    <div className={`text-sm font-bold ${((totals?.storage) || 0) >= 0 ? 'text-gray-700' : 'text-red-700'}`}>{formatIndianNumber(((totals?.storage) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month Bonus In */}
                {cardVisibility.thisMonthBonusIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-emerald-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-emerald-600 mb-1">This Month Bonus In</div>
                    <div className="text-sm font-bold text-emerald-700">{formatIndianNumber(((totals?.thisMonthBonusIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month Bonus Out */}
                {cardVisibility.thisMonthBonusOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-rose-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-rose-600 mb-1">This Month Bonus Out</div>
                    <div className="text-sm font-bold text-rose-700">{formatIndianNumber(((totals?.thisMonthBonusOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month Credit In */}
                {cardVisibility.thisMonthCreditIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-teal-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-teal-600 mb-1">This Month Credit In</div>
                    <div className="text-sm font-bold text-teal-700">{formatIndianNumber(((totals?.thisMonthCreditIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month Credit Out */}
                {cardVisibility.thisMonthCreditOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-amber-600 mb-1">This Month Credit Out</div>
                    <div className="text-sm font-bold text-amber-700">{formatIndianNumber(((totals?.thisMonthCreditOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month Deposit */}
                {cardVisibility.thisMonthDeposit !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-green-600 mb-1">This Month Deposit</div>
                    <div className="text-sm font-bold text-green-700">{formatIndianNumber(((totals?.thisMonthDeposit) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month PnL */}
                {cardVisibility.thisMonthPnL !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.thisMonthPnL || 0) >= 0 ? 'border-teal-200' : 'border-orange-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.thisMonthPnL || 0) >= 0 ? 'text-teal-600' : 'text-orange-600'}`}>This Month PnL</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.thisMonthPnL || 0) >= 0 ? 'text-teal-700' : 'text-orange-700'}`}>
                      {(totals.thisMonthPnL || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.thisMonthPnL) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* This Month SO Compensation In */}
                {cardVisibility.thisMonthSOCompensationIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-lime-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-lime-600 mb-1">This Month SO Compensation In</div>
                    <div className="text-sm font-bold text-lime-700">{formatIndianNumber(((totals?.thisMonthSOCompensationIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month SO Compensation Out */}
                {cardVisibility.thisMonthSOCompensationOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-yellow-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-yellow-600 mb-1">This Month SO Compensation Out</div>
                    <div className="text-sm font-bold text-yellow-700">{formatIndianNumber(((totals?.thisMonthSOCompensationOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Month Withdrawal */}
                {cardVisibility.thisMonthWithdrawal !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-red-600 mb-1">This Month Withdrawal</div>
                    <div className="text-sm font-bold text-red-700">{formatIndianNumber(((totals?.thisMonthWithdrawal) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week Bonus In */}
                {cardVisibility.thisWeekBonusIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-emerald-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-emerald-600 mb-1">This Week Bonus In</div>
                    <div className="text-sm font-bold text-emerald-700">{formatIndianNumber(((totals?.thisWeekBonusIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week Bonus Out */}
                {cardVisibility.thisWeekBonusOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-rose-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-rose-600 mb-1">This Week Bonus Out</div>
                    <div className="text-sm font-bold text-rose-700">{formatIndianNumber(((totals?.thisWeekBonusOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week Credit In */}
                {cardVisibility.thisWeekCreditIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-teal-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-teal-600 mb-1">This Week Credit In</div>
                    <div className="text-sm font-bold text-teal-700">{formatIndianNumber(((totals?.thisWeekCreditIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week Credit Out */}
                {cardVisibility.thisWeekCreditOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-amber-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-amber-600 mb-1">This Week Credit Out</div>
                    <div className="text-sm font-bold text-amber-700">{formatIndianNumber(((totals?.thisWeekCreditOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week Deposit */}
                {cardVisibility.thisWeekDeposit !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-green-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-green-600 mb-1">This Week Deposit</div>
                    <div className="text-sm font-bold text-green-700">{formatIndianNumber(((totals?.thisWeekDeposit) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week PnL */}
                {cardVisibility.thisWeekPnL !== false && (
                  <div className={`bg-white rounded-lg shadow-sm border-2 p-2 hover:shadow-md transition-shadow ${(totals.thisWeekPnL || 0) >= 0 ? 'border-cyan-200' : 'border-amber-200'}`}>
                    <div className={`text-[10px] font-medium mb-1 ${(totals.thisWeekPnL || 0) >= 0 ? 'text-cyan-600' : 'text-amber-600'}`}>This Week PnL</div>
                    <div className={`text-sm font-bold flex items-center gap-1 ${(totals.thisWeekPnL || 0) >= 0 ? 'text-cyan-700' : 'text-amber-700'}`}>
                      {(totals.thisWeekPnL || 0) >= 0 ? '▲' : '▼'}
                      {formatIndianNumber(((totals?.thisWeekPnL) || 0).toFixed(2))}
                    </div>
                  </div>
                )}

                {/* This Week SO Compensation In */}
                {cardVisibility.thisWeekSOCompensationIn !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-lime-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-lime-600 mb-1">This Week SO Compensation In</div>
                    <div className="text-sm font-bold text-lime-700">{formatIndianNumber(((totals?.thisWeekSOCompensationIn) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week SO Compensation Out */}
                {cardVisibility.thisWeekSOCompensationOut !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-yellow-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-yellow-600 mb-1">This Week SO Compensation Out</div>
                    <div className="text-sm font-bold text-yellow-700">{formatIndianNumber(((totals?.thisWeekSOCompensationOut) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* This Week Withdrawal */}
                {cardVisibility.thisWeekWithdrawal !== false && (
                  <div className="bg-white rounded-lg shadow-sm border-2 border-red-200 p-2 hover:shadow-md transition-shadow">
                    <div className="text-[10px] font-medium text-red-600 mb-1">This Week Withdrawal</div>
                    <div className="text-sm font-bold text-red-700">{formatIndianNumber(((totals?.thisWeekWithdrawal) || 0).toFixed(2))}</div>
                  </div>
                )}

                {/* Percent versions for all fields (toggle individually in Card Filter) */}
                {(() => {
                  const baseLabels = {
                    assets: 'Assets',
                    balance: 'Balance',
                    blockedCommission: 'Blocked Commission',
                    blockedProfit: 'Blocked Profit',
                    commission: 'Commission',
                    credit: 'Credit',
                    dailyBonusIn: 'Daily Bonus In',
                    dailyBonusOut: 'Daily Bonus Out',
                    dailyCreditIn: 'Daily Credit In',
                    dailyCreditOut: 'Daily Credit Out',
                    dailyDeposit: 'Daily Deposit',
                    dailyPnL: 'Daily P&L',
                    dailySOCompensationIn: 'Daily SO Compensation In',
                    dailySOCompensationOut: 'Daily SO Compensation Out',
                    dailyWithdrawal: 'Daily Withdrawal',
                    equity: 'Equity',
                    floating: 'Floating',
                    liabilities: 'Liabilities',
                    lifetimeBonusIn: 'Lifetime Bonus In',
                    lifetimeBonusOut: 'Lifetime Bonus Out',
                    lifetimeCreditIn: 'Lifetime Credit In',
                    lifetimeCreditOut: 'Lifetime Credit Out',
                    lifetimeDeposit: 'Lifetime Deposit',
                    lifetimePnL: 'Lifetime P&L',
                    lifetimeSOCompensationIn: 'Lifetime SO Compensation In',
                    lifetimeSOCompensationOut: 'Lifetime SO Compensation Out',
                    lifetimeWithdrawal: 'Lifetime Withdrawal',
                    margin: 'Margin',
                    marginFree: 'Margin Free',
                    marginInitial: 'Margin Initial',
                    marginLevel: 'Margin Level',
                    marginMaintenance: 'Margin Maintenance',
                    soEquity: 'SO Equity',
                    soLevel: 'SO Level',
                    soMargin: 'SO Margin',
                    pnl: 'P&L',
                    previousEquity: 'Previous Equity',
                    profit: 'Profit',
                    storage: 'Storage',
                    thisMonthBonusIn: 'This Month Bonus In',
                    thisMonthBonusOut: 'This Month Bonus Out',
                    thisMonthCreditIn: 'This Month Credit In',
                    thisMonthCreditOut: 'This Month Credit Out',
                    thisMonthDeposit: 'This Month Deposit',
                    thisMonthPnL: 'This Month P&L',
                    thisMonthSOCompensationIn: 'This Month SO Compensation In',
                    thisMonthSOCompensationOut: 'This Month SO Compensation Out',
                    thisMonthWithdrawal: 'This Month Withdrawal',
                    thisWeekBonusIn: 'This Week Bonus In',
                    thisWeekBonusOut: 'This Week Bonus Out',
                    thisWeekCreditIn: 'This Week Credit In',
                    thisWeekCreditOut: 'This Week Credit Out',
                    thisWeekDeposit: 'This Week Deposit',
                    thisWeekPnL: 'This Week P&L',
                    thisWeekSOCompensationIn: 'This Week SO Compensation In',
                    thisWeekSOCompensationOut: 'This Week SO Compensation Out',
                    thisWeekWithdrawal: 'This Week Withdrawal'
                  }
                  return Object.entries(baseLabels).map(([key, label]) => {
                    const visKey = `${key}Percent`
                    if (cardVisibility[visKey] === false) return null
                    return (
                      <div key={visKey} className="bg-white rounded-lg shadow-sm border-2 border-pink-200 p-2 hover:shadow-md transition-shadow">
                        <div className="text-[10px] font-medium text-pink-600 mb-1">{label} %</div>
                        <div className="text-sm font-bold text-pink-700">{formatIndianNumber(((totalsPercent?.[key]) || 0).toFixed(2))}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        
        {/* Main Content */}
        <div className="flex-1">
          {/* Pagination Controls - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 rounded-lg shadow-md border border-blue-200 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-700">Show:</span>
              <select
                value={itemsPerPage === 10000 ? 'All' : itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-medium border-2 border-blue-300 rounded-md bg-white text-blue-700 hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all shadow-sm"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="All">All</option>
              </select>
              <span className="text-xs font-semibold text-blue-700">entries</span>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              {/* Page Navigation */}
              {itemsPerPage !== 'All' && itemsPerPage !== 10000 && (
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

              {/* Columns Selector Button */}
              <div className="relative" ref={columnSelectorRef}>
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="text-amber-700 hover:text-amber-800 px-2.5 py-1.5 rounded-md hover:bg-amber-50 border-2 border-amber-300 hover:border-amber-500 transition-all inline-flex items-center gap-1.5 text-xs font-semibold bg-white shadow-sm"
                  title="Show/Hide Columns"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                  </svg>
                  Columns
                </button>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search login, name, email..."
                    className="w-64 pl-3 pr-3 py-1.5 text-xs font-medium border-2 border-gray-300 rounded-md bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  />
                </div>
                
                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-xs font-medium"
                  title="Search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search</span>
                </button>
                
                {/* Clear Button - Only show when there's text */}
                {searchInput && (
                  <button
                    onClick={() => {
                      setSearchInput('')
                      setSearchQuery('')
                      setCurrentPage(1)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors shadow-sm text-xs font-medium"
                    title="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Column Selector Dropdown */}
          {showColumnSelector && (
            <div 
              ref={columnSelectorRef}
              className="fixed bg-amber-50 rounded-lg shadow-xl border-2 border-amber-200 py-2 flex flex-col" 
              style={{ 
                top: '15%',
                right: '10px',
                width: '300px',
                maxHeight: '70vh',
                zIndex: 20000000
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-amber-200 flex items-center justify-between">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Show/Hide Columns</p>
                <button
                  onClick={() => setShowColumnSelector(false)}
                  className="text-amber-500 hover:text-amber-700 p-1 rounded hover:bg-amber-100"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="px-3 py-2 border-b border-amber-200">
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={columnSearchQuery}
                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs text-gray-700 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder:text-gray-400"
                />
              </div>
              
              <div className="overflow-y-auto flex-1 px-2 py-2" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#9ca3af #f3f4f6'
              }}>
                <style>{`
                  .overflow-y-auto::-webkit-scrollbar {
                    width: 8px;
                  }
                  .overflow-y-auto::-webkit-scrollbar-track {
                    background: #f3f4f6;
                  }
                  .overflow-y-auto::-webkit-scrollbar-thumb {
                    background: #9ca3af;
                    border-radius: 4px;
                  }
                  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                  }
                `}</style>
                {allColumns
                  .filter(col => col.label.toLowerCase().includes((columnSearchQuery || '').toLowerCase()))
                  .map(col => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 text-xs text-gray-700 hover:bg-amber-100 p-2 rounded-md cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key] || false}
                        onChange={() => toggleColumn(col.key)}
                        className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 focus:ring-1"
                      />
                      <span className="font-semibold">{col.label}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
          
          
          {/* Error Message */}
          {error && error !== 'Success' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}
          
          {/* Initial Loading Spinner */}
          {initialLoad && loading && <LoadingSpinner />}
          
          {/* Table - Keep rows visible during sorting; no shimmer on sort */}
          {(!initialLoad && clients.length > 0) && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
              {/* Table Container with Vertical Scroll */}
              <div className="overflow-y-auto flex-1" style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#9ca3af #e5e7eb',
                maxHeight: showFaceCards ? 'calc(100vh - 280px)' : 'calc(100vh - 150px)'
              }}>
                <style>{`
                  .overflow-y-auto::-webkit-scrollbar {
                    width: 8px;
                  }
                  .overflow-y-auto::-webkit-scrollbar-track {
                    background: #f3f4f6;
                  }
                  .overflow-y-auto::-webkit-scrollbar-thumb {
                    background: #9ca3af;
                    border-radius: 4px;
                  }
                  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                  }
                  
                  /* Staggered fade-in animation for lazy loading */
                  @keyframes fadeIn {
                    from {
                      opacity: 0;
                      transform: translateY(10px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                  
                  /* Shimmer effect for loading skeleton */
                  @keyframes shimmer {
                    0% {
                      background-position: -1000px 0;
                    }
                    100% {
                      background-position: 1000px 0;
                    }
                  }
                  
                  .skeleton-shimmer {
                    background: linear-gradient(90deg, #f0f0f0 0%, #f8f8f8 20%, #f0f0f0 40%, #f0f0f0 100%);
                    background-size: 1000px 100%;
                    animation: shimmer 1.5s ease-in-out infinite;
                    border-radius: 4px;
                  }

                  /* Header sorting loading bar */
                  @keyframes headerSlide {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                  }
                  .header-loading-track {
                    position: absolute;
                    left: 0; right: 0; bottom: 0; height: 2px;
                    overflow: hidden;
                    background: transparent;
                  }
                  .header-loading-bar {
                    width: 30%; height: 100%;
                    background: #22c55e; /* tailwind green-500 */
                    border-radius: 2px;
                    animation: headerSlide 0.9s linear infinite;
                  }
                `}</style>
                {/* Horizontal Scroll for Table */}
                <div className="overflow-x-auto relative" ref={hScrollRef}>
                  <table ref={tableRef} className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      {visibleColumnsList.map(col => (
                        <col key={`col-${col.key}`} style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined }} />
                      ))}
                    </colgroup>
                    <thead className="bg-blue-600 sticky top-0 z-10">
                      <tr>
                        {visibleColumnsList.map(col => {
                          const filterCount = getActiveFilterCount(col.key)
                          return (
                            <th
                              key={col.key}
                              ref={(el) => { if (!headerRefs.current) headerRefs.current = {}; headerRefs.current[col.key] = el }}
                              className="px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer bg-blue-600 hover:bg-blue-700 active:bg-blue-700 transition-colors select-none relative"
                              onClick={() => handleSort(col.key)}
                              style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined, minWidth: '80px' }}
                            >
                              <div className="flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{col.label}</span>
                                  {sortBy === col.key && (
                                    <span className="text-white">
                                      {sortOrder === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                                {/* Header sorting loader - show only for active sorted column while isSorting */}
                                {isSorting && sortBy === col.key && (
                                  <div className="relative w-8 h-4 flex items-center justify-center" aria-label="Sorting">
                                    <div className="header-loading-track">
                                      <div className="header-loading-bar" />
                                    </div>
                                  </div>
                                )}
                                
                                {/* Filter Icon - Just icon, no box */}
                                <div className="relative" ref={el => {
                                  if (!filterRefs.current) filterRefs.current = {}
                                  filterRefs.current[col.key] = el
                                }}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (showFilterDropdown === col.key) {
                                        setShowFilterDropdown(null)
                                        setFilterPosition(null)
                                      } else {
                                        const rect = e.currentTarget.getBoundingClientRect()
                                        const columnIndex = visibleColumnsList.indexOf(col)
                                        const totalColumns = visibleColumnsList.length
                                        const isLastColumn = columnIndex === totalColumns - 1
                                        const dropdownWidth = 280
                                        const spaceOnRight = window.innerWidth - rect.right
                                        const spaceOnLeft = rect.left
                                        
                                        // Open to the left for last 3 columns OR if there's not enough space on the right
                                        const isLastThreeColumns = columnIndex >= totalColumns - 3
                                        const shouldOpenLeft = isLastThreeColumns || (spaceOnRight < dropdownWidth + 20 && spaceOnLeft > dropdownWidth + 20)
                                        
                                        setFilterPosition({
                                          top: rect.top,
                                          left: rect.left,
                                          right: rect.right,
                                          isLastColumn,
                                          shouldOpenLeft
                                        })
                                        setShowFilterDropdown(col.key)
                                        
                                        // Fetch column values for text/non-numeric columns
                                        const columnType = getColumnType(col.key)
                                        if (columnType !== 'float' && columnType !== 'integer') {
                                          fetchColumnValues(col.key)
                                        }
                                      }
                                    }}
                                    className={`p-0.5 transition-opacity hover:opacity-70 ${filterCount > 0 ? 'text-green-400' : 'text-white/60'}`}
                                    title="Filter column"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                    </svg>
                                    {filterCount > 0 && (
                                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[16px] h-[16px] px-1 flex items-center justify-center">
                                        {filterCount}
                                      </span>
                                    )}
                                  </button>

                                  {/* Filter Dropdown */}
                                  {showFilterDropdown === col.key && filterPosition && (() => {
                                    const columnKey = col.key // Capture the column key
                                    const columnType = getColumnType(columnKey)
                                    const isNumeric = columnType === 'float'
                                    const isInteger = columnType === 'integer'
                                    
                                    // Initialize temp state for numeric filter if needed
                                    if (isNumeric && !numericFilterTemp[columnKey]) {
                                      initNumericFilterTemp(columnKey)
                                    }
                                    
                                    const tempFilter = numericFilterTemp[columnKey] || { operator: 'equal', value1: '', value2: '' }
                                    
                                    return createPortal(
                                      <div 
                                        ref={filterPanelRef}
                                        className="fixed bg-white border-2 border-slate-300 rounded-lg shadow-2xl flex flex-col text-[11px]"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onWheel={(e) => e.stopPropagation()}
                                        onScroll={(e) => e.stopPropagation()}
                                        style={{
                                          top: '50%',
                                          transform: 'translateY(-50%)',
                                          left: filterPosition.shouldOpenLeft 
                                            ? `${filterPosition.left - 290}px` 
                                            : `${filterPosition.right + 10}px`,
                                          width: '280px',
                                          maxHeight: '80vh',
                                          zIndex: 20000000
                                        }}
                                      >
                                        {/* Header */}
                                        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-gray-700">
                                              {isNumeric ? 'Number Filters' : isInteger ? 'Text Filters' : 'Text Filters'}
                                            </span>
                                            <button
                                              onClick={() => clearColumnFilter(columnKey)}
                                              className="text-xs text-red-600 hover:text-red-700 font-medium"
                                            >
                                              Clear
                                            </button>
                                          </div>
                                        </div>

                                        {/* Numeric Filter (Float) */}
                                        {isNumeric && (() => {
                                          const hasNumberFilter = columnFilters[`${columnKey}_number`]
                                          const currentSort = columnSortOrder[columnKey]
                                          
                                          return (
                                            <>
                                              {/* Sort Options */}
                                              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                <button
                                                  onClick={() => applySortToColumn(columnKey, 'asc')}
                                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-200 ${currentSort === 'asc' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                                  </svg>
                                                  Sort Smallest to Largest
                                                </button>
                                                <button
                                                  onClick={() => applySortToColumn(columnKey, 'desc')}
                                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-200 mt-1 ${currentSort === 'desc' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                                  </svg>
                                                  Sort Largest to Smallest
                                                </button>
                                              </div>

                                              {/* Number Filter Operators */}
                                              <div className="px-3 py-2 border-b border-gray-200">
                                                <div className="relative">
                                                  <button
                                                    onClick={() => {
                                                      const btn = document.getElementById(`number-filter-btn-${columnKey}`)
                                                      const menu = document.getElementById(`number-filter-menu-${columnKey}`)
                                                      if (menu) {
                                                        menu.classList.toggle('hidden')
                                                      }
                                                    }}
                                                    id={`number-filter-btn-${col.key}`}
                                                    className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded border ${hasNumberFilter ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'} hover:bg-gray-100`}
                                                  >
                                                    <span className="text-gray-700 font-medium">Number Filters</span>
                                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                  </button>
                                                  
                                                  {/* Number Filter Submenu */}
                                                  <div
                                                    id={`number-filter-menu-${columnKey}`}
                                                    className={`hidden absolute ${filterPosition?.shouldOpenLeft ? 'right-full mr-1' : 'left-full ml-1'} top-0 w-64 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50`}
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <div className="p-3 space-y-3">
                                                      {/* Operator Dropdown */}
                                                      <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">CONDITION</label>
                                                        <select
                                                          value={tempFilter.operator}
                                                          onChange={(e) => updateNumericFilterTemp(columnKey, 'operator', e.target.value)}
                                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                        >
                                                          <option value="equal">Equal...</option>
                                                          <option value="not_equal">Not Equal...</option>
                                                          <option value="less_than">Less Than...</option>
                                                          <option value="less_than_equal">Less Than Or Equal...</option>
                                                          <option value="greater_than">Greater Than...</option>
                                                          <option value="greater_than_equal">Greater Than Or Equal...</option>
                                                          <option value="between">Between...</option>
                                                        </select>
                                                      </div>

                                                      {/* Value Input(s) */}
                                                      <div>
                                                        <label className="block text-xs font-medium text-gray-700 mb-1">VALUE</label>
                                                        <input
                                                          type="number"
                                                          step="any"
                                                          placeholder="Enter value"
                                                          value={tempFilter.value1}
                                                          onChange={(e) => updateNumericFilterTemp(columnKey, 'value1', e.target.value)}
                                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                        />
                                                      </div>

                                                      {/* Second Value for Between */}
                                                      {tempFilter.operator === 'between' && (
                                                        <div>
                                                          <label className="block text-xs font-medium text-gray-700 mb-1">AND</label>
                                                          <input
                                                            type="number"
                                                            step="any"
                                                            placeholder="Enter value"
                                                            value={tempFilter.value2}
                                                            onChange={(e) => updateNumericFilterTemp(columnKey, 'value2', e.target.value)}
                                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                          />
                                                        </div>
                                                      )}

                                                      {/* Apply/Clear Buttons */}
                                                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                                                        <button
                                                          onClick={() => {
                                                            applyNumberFilter(columnKey)
                                                            const menu = document.getElementById(`number-filter-menu-${columnKey}`)
                                                            if (menu) menu.classList.add('hidden')
                                                          }}
                                                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                                        >
                                                          OK
                                                        </button>
                                                        <button
                                                          onClick={() => {
                                                            const numberFilterKey = `${columnKey}_number`
                                                            setColumnFilters(prev => {
                                                              const { [numberFilterKey]: _, ...rest } = prev
                                                              return rest
                                                            })
                                                            const menu = document.getElementById(`number-filter-menu-${columnKey}`)
                                                            if (menu) menu.classList.add('hidden')
                                                          }}
                                                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                                        >
                                                          Clear
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* OK/Clear Buttons */}
                                              <div className="px-3 py-2 border-t border-gray-200 flex gap-2">
                                                <button
                                                  onClick={() => setShowFilterDropdown(null)}
                                                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                                >
                                                  OK
                                                </button>
                                                <button
                                                  onClick={() => clearColumnFilter(columnKey)}
                                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                            </>
                                          )
                                        })()}

                                        {/* Text/Integer Filter (Checkboxes) */}
                                        {!isNumeric && (() => {
                                          const currentSort = columnSortOrder[columnKey]
                                          const checkboxFilterKey = `${columnKey}_checkbox`
                                          const hasCheckboxFilter = columnFilters[checkboxFilterKey]
                                          
                                          const allValues = columnValues[columnKey] || []
                                          const loading = columnValuesLoading[columnKey]
                                          const selected = selectedColumnValues[columnKey] || []
                                          const searchQuery = columnValueSearch[columnKey] || ''
                                          
                                          // Filter values based on search
                                          const filteredValues = searchQuery
                                            ? allValues.filter(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()))
                                            : allValues
                                          
                                          return (
                                            <>
                                              {/* Sort Options */}
                                              <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                <button
                                                  onClick={() => applySortToColumn(columnKey, 'asc')}
                                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-200 ${currentSort === 'asc' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                                  </svg>
                                                  Sort Smallest to Largest
                                                </button>
                                                <button
                                                  onClick={() => applySortToColumn(columnKey, 'desc')}
                                                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-gray-200 mt-1 ${currentSort === 'desc' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'}`}
                                                >
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                                                  </svg>
                                                  Sort Largest to Smallest
                                                </button>
                                              </div>

                                              {/* Text Filters Section */}
                                              <div className="px-3 py-2 border-b border-gray-200">
                                                <div className="relative">
                                                  <button
                                                    onClick={() => {
                                                      const btn = document.getElementById(`text-filter-btn-${columnKey}`)
                                                      const menu = document.getElementById(`text-filter-menu-${columnKey}`)
                                                      if (menu) {
                                                        menu.classList.toggle('hidden')
                                                      }
                                                    }}
                                                    id={`text-filter-btn-${columnKey}`}
                                                    className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded border ${columnFilters[`${columnKey}_text`] ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'} hover:bg-gray-100`}
                                                  >
                                                    <span className="text-gray-700 font-medium">Text Filters</span>
                                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                  </button>
                                                  
                                                  {/* Keep existing text filter submenu for advanced filtering */}
                                                  <div
                                                    id={`text-filter-menu-${columnKey}`}
                                                    className={`hidden absolute ${filterPosition?.shouldOpenLeft ? 'right-full mr-1' : 'left-full ml-1'} top-0 w-64 bg-white border-2 border-gray-300 rounded-lg shadow-xl z-50`}
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <div className="p-3 space-y-3">
                                                      {!textFilterTemp[columnKey] && initTextFilterTemp(columnKey)}
                                                      {(() => {
                                                        const tempTextFilter = textFilterTemp[columnKey] || { operator: 'equal', value: '', caseSensitive: false }
                                                        return (
                                                          <>
                                                            <div>
                                                              <label className="block text-xs font-medium text-gray-700 mb-1">Condition</label>
                                                              <select
                                                                value={tempTextFilter.operator}
                                                                onChange={(e) => updateTextFilterTemp(columnKey, 'operator', e.target.value)}
                                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                              >
                                                                <option value="equal">Equal...</option>
                                                                <option value="notEqual">Not Equal...</option>
                                                                <option value="startsWith">Starts With...</option>
                                                                <option value="endsWith">Ends With...</option>
                                                                <option value="contains">Contains...</option>
                                                                <option value="doesNotContain">Does Not Contain...</option>
                                                              </select>
                                                            </div>
                                                            <div>
                                                              <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                                                              <input
                                                                type="text"
                                                                placeholder="Enter text"
                                                                value={tempTextFilter.value}
                                                                onChange={(e) => updateTextFilterTemp(columnKey, 'value', e.target.value)}
                                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                              />
                                                            </div>
                                                            <div>
                                                              <label className="flex items-center gap-2 cursor-pointer">
                                                                <input
                                                                  type="checkbox"
                                                                  checked={tempTextFilter.caseSensitive}
                                                                  onChange={(e) => updateTextFilterTemp(columnKey, 'caseSensitive', e.target.checked)}
                                                                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                                />
                                                                <span className="text-xs text-gray-700">Match Case</span>
                                                              </label>
                                                            </div>
                                                            <div className="flex gap-2 pt-2 border-t border-gray-200">
                                                              <button
                                                                onClick={() => {
                                                                  applyTextFilter(columnKey)
                                                                  const menu = document.getElementById(`text-filter-menu-${columnKey}`)
                                                                  if (menu) menu.classList.add('hidden')
                                                                }}
                                                                className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                                              >
                                                                OK
                                                              </button>
                                                              <button
                                                                onClick={() => {
                                                                  const textFilterKey = `${columnKey}_text`
                                                                  setColumnFilters(prev => {
                                                                    const { [textFilterKey]: _, ...rest } = prev
                                                                    return rest
                                                                  })
                                                                  const menu = document.getElementById(`text-filter-menu-${columnKey}`)
                                                                  if (menu) menu.classList.add('hidden')
                                                                }}
                                                                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                                              >
                                                                Clear
                                                              </button>
                                                            </div>
                                                          </>
                                                        )
                                                      })()}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Checkbox Value List */}
                                              <div className="flex-1 overflow-hidden flex flex-col">
                                                {/* Search Bar */}
                                                <div className="px-3 py-2 border-b border-gray-200">
                                                  <input
                                                    type="text"
                                                    placeholder="Search values..."
                                                    value={searchQuery}
                                                    onChange={(e) => setColumnValueSearch(prev => ({ ...prev, [columnKey]: e.target.value }))}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                  />
                                                </div>

                                                {/* Select All Checkbox */}
                                                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                  <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                      type="checkbox"
                                                      checked={selected.length === allValues.length && allValues.length > 0}
                                                      onChange={() => toggleSelectAllColumnValues(columnKey)}
                                                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs font-bold text-gray-700">SELECT ALL</span>
                                                  </label>
                                                </div>

                                                {/* Values List */}
                                                <div className="flex-1 overflow-y-auto px-3 py-2">
                                                  {loading ? (
                                                    <div className="py-8 text-center">
                                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                      <p className="text-xs text-gray-500 mt-2">Loading values...</p>
                                                    </div>
                                                  ) : filteredValues.length > 0 ? (
                                                    <div className="space-y-1">
                                                      {filteredValues.map((value) => (
                                                        <label key={value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                                                          <input
                                                            type="checkbox"
                                                            checked={selected.includes(value)}
                                                            onChange={() => toggleColumnValue(columnKey, value)}
                                                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                          />
                                                          <span className="text-xs text-gray-700">{value}</span>
                                                        </label>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <div className="py-8 text-xs text-gray-500 text-center">
                                                      {searchQuery ? 'No matching values found' : 'No values available'}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>

                                              {/* OK/Clear Buttons */}
                                              <div className="px-3 py-2 border-t border-gray-200 flex gap-2">
                                                <button
                                                  onClick={() => {
                                                    applyCheckboxFilter(columnKey)
                                                    setShowFilterDropdown(null)
                                                  }}
                                                  className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                                >
                                                  OK
                                                </button>
                                                <button
                                                  onClick={() => clearColumnFilter(columnKey)}
                                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                            </>
                                          )
                                        })()}
                                      </div>,
                                      document.body
                                    )
                                  })()}
                                </div>
                              </div>
                              {/* Column Resizer Handle - Excel-like */}
                              <div
                                onMouseDown={(e) => handleResizeStart(e, col.key)}
                                onDoubleClick={(e) => { e.stopPropagation(); handleAutoFit(col.key, col.baseKey) }}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize select-none z-20 hover:bg-yellow-400/60 active:bg-yellow-500/70"
                                style={{ userSelect: 'none' }}
                                title="Drag to resize column • Double-click to auto-fit"
                                draggable={false}
                              >
                                <div className="absolute right-0 top-0 w-[2px] h-full bg-white/40 group-hover:bg-yellow-400 active:bg-yellow-500 transition-colors"></div>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200" key={`tbody-${animationKey}`}>
                      {loading && !isSorting ? (
                        // Progressive loading skeleton with staggered animation
                        Array.from({ length: 10 }).map((_, idx) => (
                          <tr 
                            key={`skeleton-${animationKey}-${idx}`} 
                            style={{
                              opacity: 0,
                              animation: `fadeIn 0.3s ease-in forwards ${idx * 50}ms`
                            }}
                          >
                            {visibleColumnsList.map(col => (
                              <td key={col.key} data-col={col.key} className="px-6 py-4 whitespace-nowrap" style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined, minWidth: '80px' }}>
                                <div className="h-4 skeleton-shimmer w-full"></div>
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        // Actual data rows with staggered fade-in
                        sortedClients.map((client, idx) => (
                          <tr 
                            key={`${client.login}-${animationKey}-${idx}`} 
                            onClick={() => handleViewClientDetails(client)}
                            className="hover:bg-blue-50 cursor-pointer transition-colors"
                            style={{
                              opacity: 0,
                              animation: `fadeIn 0.2s ease-out forwards ${idx * 20}ms`
                            }}
                          >
                            {visibleColumnsList.map(col => {
                              // Special handling for login column - make it blue
                              if (col.key === 'login') {
                                return (
                                  <td 
                                    key={col.key} 
                                    className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer hover:underline transition-all"
                                    style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined, minWidth: '80px' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleViewClientDetails(client)
                                    }}
                                    title="Click to view client details"
                                  >
                                    {formatValue(col.key, client[col.key])}
                                  </td>
                                )
                              }
                              
                              // Regular columns
                              return (
                                <td 
                                  key={col.key} 
                                  className={`px-6 py-4 whitespace-nowrap text-sm ${getValueColorClass(col.key, client[col.key]) || 'text-gray-900'}`}
                                  data-col={col.key}
                                  style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined, minWidth: '80px' }}
                                >
                                  {formatValue(col.key, client[col.key])}
                                </td>
                              )
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                    {/* Totals Footer */}
                    {totals && Object.keys(totals).length > 0 && (
                      <tfoot className="bg-gray-100 font-semibold sticky bottom-0">
                        <tr>
                          {visibleColumnsList.map(col => (
                            <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{ width: columnWidths[col.key] ? `${columnWidths[col.key]}px` : undefined, minWidth: '80px' }}>
                              {col.key === 'login' ? 'Total:' : formatValue(col.key, totals[col.key])}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}
          
          {/* Active Filters Display */}
          {filters.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Active Filters:</h3>
                <button
                  onClick={handleClearAllFilters}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map((filter, idx) => {
                  const column = allColumns.find(col => col.key === filter.field)
                  const operator = getOperatorsForField(filter.field).find(op => op.value === filter.operator)
                  return (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                    >
                      <span className="font-medium">{column?.label || filter.field}</span>
                      <span className="text-blue-600">{operator?.label || filter.operator}</span>
                      <span className="font-semibold">{filter.value}</span>
                      <button
                        onClick={() => handleRemoveFilter(idx)}
                        className="ml-1 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* No Results */}
          {!loading && !initialLoad && clients.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-600">No clients found</p>
            </div>
          )}
        </div>
        </div>
      </main>
      
      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Filter</h2>
            
            {/* Field Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Field
              </label>
              <select
                value={newFilterField}
                onChange={(e) => setNewFilterField(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                {allColumns.map(col => (
                  <option key={col.key} value={col.key}>{col.label}</option>
                ))}
              </select>
            </div>
            
            {/* Operator Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Operator
              </label>
              <select
                value={newFilterOperator}
                onChange={(e) => setNewFilterOperator(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                {getOperatorsForField(newFilterField).map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            
            {/* Value Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Value
              </label>
              <input
                type="text"
                value={newFilterValue}
                onChange={(e) => setNewFilterValue(e.target.value)}
                placeholder="Enter filter value"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleAddFilter}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Add Filter
              </button>
              <button
                onClick={() => {
                  setShowFilterModal(false)
                  setNewFilterValue('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Account Filter Modal */}
      {showAccountFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Account Filters</h2>
            
            {/* MT5 Accounts */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specific MT5 Accounts
              </label>
              <textarea
                value={accountInputText}
                onChange={(e) => setAccountInputText(e.target.value)}
                placeholder="Enter account numbers separated by commas, spaces, or new lines&#10;Example: 555075, 555088, 555175"
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              />
              <p className="text-xs text-gray-500 mt-1">
                Currently filtered: {mt5Accounts.length > 0 ? mt5Accounts.join(', ') : 'None'}
              </p>
            </div>
            
            {/* Account Range */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Range
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number"
                    value={tempAccountRangeMin}
                    onChange={(e) => setTempAccountRangeMin(e.target.value)}
                    placeholder="Min"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    value={tempAccountRangeMax}
                    onChange={(e) => setTempAccountRangeMax(e.target.value)}
                    placeholder="Max"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  />
                </div>
              </div>
              {(accountRangeMin || accountRangeMax) && (
                <p className="text-xs text-gray-500 mt-1">
                  Current range: {accountRangeMin || '∞'} - {accountRangeMax || '∞'}
                </p>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleApplyAccountFilters}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearAccountFilters}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
              >
                Clear
              </button>
              <button
                onClick={() => setShowAccountFilterModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Client Positions Modal */}
      {showClientDetailModal && selectedClient && (
        <ClientPositionsModal
          client={selectedClient}
          onClose={() => {
            setShowClientDetailModal(false)
            setSelectedClient(null)
          }}
          onClientUpdate={(updatedClient) => {
            // Update the client in the list
            setClients(prevClients =>
              prevClients.map(c =>
                c.login === updatedClient.login ? updatedClient : c
              )
            )
            setSelectedClient(updatedClient)
          }}
        />
      )}
      
      {/* Group Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        availableItems={clients}
        loginField="login"
        displayField="name"
        secondaryField="group"
      />
    </div>
  )
}

export default Client2Page





