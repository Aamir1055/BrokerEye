import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import { useData } from '../contexts/DataContext'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'
import IBSelector from '../components/IBSelector'
import api, { brokerAPI } from '../services/api'
import { useGroups } from '../contexts/GroupContext'
import { useIB } from '../contexts/IBContext'

// Gate verbose logs behind env flag to keep console clean in production
const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'

const Client2Page = () => {
  // DataContext (align with ClientsPage for positions cache usage)
  const { positions: cachedPositions } = useData()
  // Column value dropdown paging defaults and settings
  // Expose batch size as a quick setting (persisted), while capping parallel page prefetch to be safe.
  const COLUMN_VALUES_MAX_PAGES_PER_BATCH = 5   // safety cap to avoid excessive parallel requests

  const getInitialColumnValuesBatchSize = () => {
    try {
      const saved = localStorage.getItem('client2ColumnValuesBatchSize')
      const n = saved ? parseInt(saved) : 200
      if (!Number.isFinite(n)) return 200
      return Math.min(1000, Math.max(50, n))
    } catch {
      return 200
    }
  }
  const [columnValuesBatchSize, setColumnValuesBatchSize] = useState(getInitialColumnValuesBatchSize)

  useEffect(() => {
    try { localStorage.setItem('client2ColumnValuesBatchSize', String(columnValuesBatchSize)) } catch { }
  }, [columnValuesBatchSize])
  
  // Group context
  const { filterByActiveGroup, activeGroupFilters, getActiveGroupFilter, groups } = useGroups()

  // Get active group for this module
  const activeGroupName = getActiveGroupFilter('client2')
  const activeGroup = groups.find(g => g.name === activeGroupName)

  // IB context
  const { filterByActiveIB, selectedIB, ibMT5Accounts, refreshIBList } = useIB()

  const getInitialSidebarOpen = () => {
    try {
      const v = localStorage.getItem('sidebarOpen')
      if (v === null) return false // collapsed by default
      return JSON.parse(v)
    } catch {
      return false
    }
  }
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Data state
  const [clients, setClients] = useState([])
  const [totalClients, setTotalClients] = useState(0)
  const [totals, setTotals] = useState({})
  const [rebateTotals, setRebateTotals] = useState({})
  const [totalsPercent, setTotalsPercent] = useState({}) // Percent totals (server response when percentage:true)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
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
  const [columnValuesLoading, setColumnValuesLoading] = useState({}) // Track first-load state for column values
  const [columnValuesLoadingMore, setColumnValuesLoadingMore] = useState({}) // Track incremental load state
  const [columnValuesPage, setColumnValuesPage] = useState({}) // Track current page per column
  const [columnValuesHasMore, setColumnValuesHasMore] = useState({}) // Track hasMore per column
  const [columnValuesCurrentPage, setColumnValuesCurrentPage] = useState({}) // Track current page number per column
  const [columnValuesTotalPages, setColumnValuesTotalPages] = useState({}) // Track total pages per column
  const [columnValuesUnsupported, setColumnValuesUnsupported] = useState({}) // Fields not supported by /clients/fields API
  const [selectedColumnValues, setSelectedColumnValues] = useState({}) // Track selected values for checkbox filters
  const [columnValueSearch, setColumnValueSearch] = useState({}) // Search query for column value filters
  const [columnValueSearchDebounce, setColumnValueSearchDebounce] = useState({}) // Debounced search queries
  const [quickFilters, setQuickFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('client2QuickFilters')
      return saved ? JSON.parse(saved) : {
        hasFloating: false,
        hasCredit: false,
        noDeposit: false
      }
    } catch (e) {
      return {
        hasFloating: false,
        hasCredit: false,
        noDeposit: false
      }
    }
  })
  
  // Save quick filters to localStorage whenever they change
  useEffect(() => {
    try { 
      localStorage.setItem('client2QuickFilters', JSON.stringify(quickFilters)) 
    } catch { }
  }, [quickFilters])
  
  // Networking guards for polling
  const fetchAbortRef = useRef(null)
  const isFetchingRef = useRef(false)
  const [draggedCard, setDraggedCard] = useState(null) // For face card drag and drop

  // Define default face card order for Client2 (matching all available cards in the actual rendering)
  const defaultClient2FaceCardOrder = [
    'totalClients', 'assets', 'balance', 'blockedCommission', 'blockedProfit', 'commission', 'credit',
    'dailyBonusIn', 'dailyBonusOut', 'dailyCreditIn', 'dailyCreditOut', 'dailyDeposit', 'dailyDepositPercent', 'dailyPnL',
    'dailySOCompensationIn', 'dailySOCompensationOut', 'dailyWithdrawal', 'dailyWithdrawalPercent',
    'equity', 'floating', 'liabilities',
    'lifetimeBonusIn', 'lifetimeBonusOut', 'lifetimeCreditIn', 'lifetimeCreditOut', 'lifetimeDeposit', 'lifetimePnL', 'lifetimePnLPercent',
    'lifetimeSOCompensationIn', 'lifetimeSOCompensationOut', 'lifetimeWithdrawal',
    'margin', 'marginFree', 'marginInitial', 'marginLevel', 'marginMaintenance',
    'soEquity', 'soLevel', 'soMargin', 'pnl', 'previousEquity', 'profit', 'storage',
    'thisMonthBonusIn', 'thisMonthBonusOut', 'thisMonthCreditIn', 'thisMonthCreditOut', 'thisMonthDeposit', 'thisMonthPnL',
    'thisMonthSOCompensationIn', 'thisMonthSOCompensationOut', 'thisMonthWithdrawal',
    'thisWeekBonusIn', 'thisWeekBonusOut', 'thisWeekCreditIn', 'thisWeekCreditOut', 'thisWeekDeposit', 'thisWeekPnL',
    'thisWeekSOCompensationIn', 'thisWeekSOCompensationOut', 'thisWeekWithdrawal',
    'availableRebate', 'availableRebatePercent', 'totalRebate', 'totalRebatePercent',
    'netLifetimePnL', 'netLifetimePnLPercent', 'bookPnL', 'bookPnLPercent'
  ]

  const getInitialClient2FaceCardOrder = () => {
    try {
      const saved = localStorage.getItem('client2FaceCardOrder')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate that it's an array and reconcile with current defaults
        if (Array.isArray(parsed)) {
          const defaults = [...defaultClient2FaceCardOrder]
          const defaultSet = new Set(defaults)
          // Keep only known keys and preserve saved order
          const cleaned = parsed.filter(k => defaultSet.has(k))
          // Append any new keys missing from saved order
          defaults.forEach(k => { if (!cleaned.includes(k)) cleaned.push(k) })
          return cleaned
        }
      }
    } catch (e) {
      console.warn('Failed to parse client2FaceCardOrder from localStorage:', e)
    }
    return defaultClient2FaceCardOrder
  }

  const [faceCardOrder, setFaceCardOrder] = useState(getInitialClient2FaceCardOrder)

  // Column ordering state
  const getInitialColumnOrder = () => {
    const saved = localStorage.getItem('client2ColumnOrder')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error('Failed to parse saved column order:', e)
      }
    }
    return null // Will use default order from allColumns
  }

  const [columnOrder, setColumnOrder] = useState(getInitialColumnOrder)
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)

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

  // Debounce search input for server-side filtering
  useEffect(() => {
    const timers = {}

    Object.keys(columnValueSearch).forEach(columnKey => {
      const searchQuery = columnValueSearch[columnKey] || ''
      const previousQuery = columnValueSearchDebounce[columnKey] || ''

      // Only trigger if search changed
      if (searchQuery !== previousQuery) {
        if (timers[columnKey]) clearTimeout(timers[columnKey])

        timers[columnKey] = setTimeout(() => {
          setColumnValueSearchDebounce(prev => ({ ...prev, [columnKey]: searchQuery }))

          // Reset and fetch with new search query
          setColumnValues(prev => ({ ...prev, [columnKey]: [] }))
          setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 1 }))
          fetchColumnValuesWithSearch(columnKey, searchQuery, true)
        }, 500) // 500ms debounce
      }
    })

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer))
    }
  }, [columnValueSearch])

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
  const stickyScrollRef = useRef(null)
  const faceCardsRef = useRef(null)
  const tableContainerRef = useRef(null)
  const [resizingColumn, setResizingColumn] = useState(null)
  // Scroll gating for column value dropdowns
  const columnScrollUserActionRef = useRef({}) // { [columnKey]: boolean }
  const columnScrollLastTriggerRef = useRef({}) // { [columnKey]: number }
  const columnLastScrollTopRef = useRef({}) // { [columnKey]: number }

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
    // Default: show only 6 essential cards
    return {
      totalClients: true,
      assets: false,
      balance: false,
      blockedCommission: false,
      blockedProfit: false,
      commission: false,
      credit: false,
      dailyBonusIn: false,
      dailyBonusOut: false,
      dailyCreditIn: false,
      dailyCreditOut: false,
      dailyDeposit: true,  // Card 1
      dailyPnL: false,
      dailySOCompensationIn: false,
      dailySOCompensationOut: false,
      dailyWithdrawal: false,
      equity: true,  // Card 2
      floating: true,  // Card 3
      liabilities: false,
      lifetimeBonusIn: false,
      lifetimeBonusOut: false,
      lifetimeCreditIn: false,
      lifetimeCreditOut: false,
      lifetimeDeposit: true,  // Card 4
      lifetimePnL: true,  // Card 5
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
      pnl: true,  // Card 6
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
      thisWeekWithdrawalPercent: false,
      // Rebate cards (all visible by default)
      availableRebate: true,
      availableRebatePercent: true,
      totalRebate: true,
      totalRebatePercent: true,
      // Calculated PnL cards
      netLifetimePnL: true,
      netLifetimePnLPercent: true,
      bookPnL: true,
      bookPnLPercent: true
    }
  }

  const [cardVisibility, setCardVisibility] = useState(getInitialCardVisibility)
  // Global percentage view disabled; use per-field % cards instead
  const showPercentage = false

  // Percentage mode now ONLY controlled by explicit toggle (cardFilterPercentMode)
  // Face card visibility no longer auto-triggers percentage API calls to avoid unintended requests.
  const percentModeActive = cardFilterPercentMode === true

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

  // Save column order to localStorage
  useEffect(() => {
    if (columnOrder) {
      localStorage.setItem('client2ColumnOrder', JSON.stringify(columnOrder))
    }
  }, [columnOrder])

  // Auto-focus filter dropdown when it opens for keyboard navigation
  useEffect(() => {
    if (showFilterDropdown && filterPanelRef.current) {
      setTimeout(() => {
        filterPanelRef.current?.focus()
      }, 0)
    }
  }, [showFilterDropdown])

  // Calculate dynamic table height based on available space and changing UI above the table
  const visibleCardCount = useMemo(() => {
    try {
      return (faceCardOrder || []).filter(k => (cardVisibility?.[k] !== false)).length
    } catch {
      return 0
    }
  }, [faceCardOrder, cardVisibility])



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
    { key: 'id', label: 'ID', type: 'text' },
    { key: 'accountType', label: 'Account Type', type: 'text' },
    { key: 'status', label: 'Status', type: 'text' },
    { key: 'leadSource', label: 'Lead Source', type: 'text' },
    { key: 'leadCampaign', label: 'Lead Campaign', type: 'text' },
    { key: 'balance', label: 'Balance', type: 'float' },
    { key: 'credit', label: 'Credit', type: 'float' },
    { key: 'equity', label: 'Equity', type: 'float' },
    { key: 'margin', label: 'Margin', type: 'float' },
    { key: 'marginFree', label: 'Margin Free', type: 'float' },
    { key: 'marginLevel', label: 'Margin Level', type: 'float' },
    { key: 'marginInitial', label: 'Margin Initial', type: 'float' },
    { key: 'marginMaintenance', label: 'Margin Maintenance', type: 'float' },
    { key: 'leverage', label: 'Leverage', type: 'integer' },
    { key: 'profit', label: 'Floating Profit', type: 'float' },
    { key: 'floating', label: 'Floating', type: 'float' },
    { key: 'pnl', label: 'PnL', type: 'float' },
    { key: 'previousEquity', label: 'Previous Equity', type: 'float' },
    { key: 'currency', label: 'Currency', type: 'text' },
    { key: 'company', label: 'Company', type: 'text' },
    { key: 'comment', label: 'Comment', type: 'text' },
    { key: 'registration', label: 'Registration', type: 'date' },
    { key: 'lastAccess', label: 'Last Access', type: 'date' },
    { key: 'accountLastUpdate', label: 'Account Last Update', type: 'integer' },
    { key: 'userLastUpdate', label: 'User Last Update', type: 'integer' },
    { key: 'processorType', label: 'Processor Type', type: 'text' },
    { key: 'applied_percentage', label: 'Applied Percentage', type: 'float' },
    { key: 'applied_percentage_is_custom', label: 'Is Custom Percentage', type: 'text' },
    { key: 'assets', label: 'Assets', type: 'float' },
    { key: 'liabilities', label: 'Liabilities', type: 'float' },
    { key: 'storage', label: 'Storage', type: 'float' },
    { key: 'blockedCommission', label: 'Blocked Commission', type: 'float' },
    { key: 'blockedProfit', label: 'Blocked Profit', type: 'float' },
    { key: 'soEquity', label: 'SO Equity', type: 'float' },
    { key: 'soLevel', label: 'SO Level', type: 'float' },
    { key: 'soMargin', label: 'SO Margin', type: 'float' },
    { key: 'dailyPnL', label: 'Daily PnL', type: 'float' },
    { key: 'dailyPnL_percentage', label: 'Daily PnL %', type: 'float' },
    { key: 'dailyDeposit', label: 'Daily Deposit', type: 'float' },
    { key: 'dailyWithdrawal', label: 'Daily Withdrawal', type: 'float' },
    { key: 'dailyCreditIn', label: 'Daily Credit In', type: 'float' },
    { key: 'dailyCreditOut', label: 'Daily Credit Out', type: 'float' },
    { key: 'dailyBonusIn', label: 'Daily Bonus In', type: 'float' },
    { key: 'dailyBonusOut', label: 'Daily Bonus Out', type: 'float' },
    { key: 'dailySOCompensationIn', label: 'Daily SO Compensation In', type: 'float' },
    { key: 'dailySOCompensationOut', label: 'Daily SO Compensation Out', type: 'float' },
    { key: 'thisWeekPnL', label: 'This Week PnL', type: 'float' },
    { key: 'thisWeekPnLPercentage', label: 'This Week PnL %', type: 'float' },
    { key: 'thisWeekPreviousEquity', label: 'This Week Previous Equity', type: 'float' },
    { key: 'thisWeekDeposit', label: 'This Week Deposit', type: 'float' },
    { key: 'thisWeekWithdrawal', label: 'This Week Withdrawal', type: 'float' },
    { key: 'thisWeekCreditIn', label: 'This Week Credit In', type: 'float' },
    { key: 'thisWeekCreditOut', label: 'This Week Credit Out', type: 'float' },
    { key: 'thisWeekBonusIn', label: 'This Week Bonus In', type: 'float' },
    { key: 'thisWeekBonusOut', label: 'This Week Bonus Out', type: 'float' },
    { key: 'thisWeekSOCompensationIn', label: 'This Week SO Compensation In', type: 'float' },
    { key: 'thisWeekSOCompensationOut', label: 'This Week SO Compensation Out', type: 'float' },
    { key: 'thisMonthPnL', label: 'This Month PnL', type: 'float' },
    { key: 'thisMonthPnLPercentage', label: 'This Month PnL %', type: 'float' },
    { key: 'thisMonthPreviousEquity', label: 'This Month Previous Equity', type: 'float' },
    { key: 'thisMonthDeposit', label: 'This Month Deposit', type: 'float' },
    { key: 'thisMonthWithdrawal', label: 'This Month Withdrawal', type: 'float' },
    { key: 'thisMonthCreditIn', label: 'This Month Credit In', type: 'float' },
    { key: 'thisMonthCreditOut', label: 'This Month Credit Out', type: 'float' },
    { key: 'thisMonthBonusIn', label: 'This Month Bonus In', type: 'float' },
    { key: 'thisMonthBonusOut', label: 'This Month Bonus Out', type: 'float' },
    { key: 'thisMonthSOCompensationIn', label: 'This Month SO Compensation In', type: 'float' },
    { key: 'thisMonthSOCompensationOut', label: 'This Month SO Compensation Out', type: 'float' },
    { key: 'lifetimePnL', label: 'Lifetime PnL', type: 'float' },
    { key: 'lifetimePnLPercentage', label: 'Lifetime PnL %', type: 'float' },
    { key: 'lifetimeDeposit', label: 'Lifetime Deposit', type: 'float' },
    { key: 'lifetimeWithdrawal', label: 'Lifetime Withdrawal', type: 'float' },
    { key: 'lifetimeCreditIn', label: 'Lifetime Credit In', type: 'float' },
    { key: 'lifetimeCreditOut', label: 'Lifetime Credit Out', type: 'float' },
    { key: 'lifetimeBonusIn', label: 'Lifetime Bonus In', type: 'float' },
    { key: 'lifetimeBonusOut', label: 'Lifetime Bonus Out', type: 'float' },
    { key: 'lifetimeSOCompensationIn', label: 'Lifetime SO Compensation In', type: 'float' },
    { key: 'lifetimeSOCompensationOut', label: 'Lifetime SO Compensation Out', type: 'float' },
    // Percentage columns
    { key: 'balance_percentage', label: 'Balance %', type: 'float' },
    { key: 'credit_percentage', label: 'Credit %', type: 'float' },
    { key: 'equity_percentage', label: 'Equity %', type: 'float' },
    { key: 'margin_percentage', label: 'Margin %', type: 'float' },
    { key: 'marginFree_percentage', label: 'Margin Free %', type: 'float' },
    { key: 'marginInitial_percentage', label: 'Margin Initial %', type: 'float' },
    { key: 'marginMaintenance_percentage', label: 'Margin Maintenance %', type: 'float' },
    { key: 'profit_percentage', label: 'Floating Profit %', type: 'float' },
    { key: 'floating_percentage', label: 'Floating %', type: 'float' },
    { key: 'pnl_percentage', label: 'PnL %', type: 'float' },
    { key: 'previousEquity_percentage', label: 'Previous Equity %', type: 'float' },
    { key: 'assets_percentage', label: 'Assets %', type: 'float' },
    { key: 'liabilities_percentage', label: 'Liabilities %', type: 'float' },
    { key: 'storage_percentage', label: 'Storage %', type: 'float' },
    { key: 'blockedCommission_percentage', label: 'Blocked Commission %', type: 'float' },
    { key: 'blockedProfit_percentage', label: 'Blocked Profit %', type: 'float' },
    { key: 'dailyDeposit_percentage', label: 'Daily Deposit %', type: 'float' },
    { key: 'dailyWithdrawal_percentage', label: 'Daily Withdrawal %', type: 'float' },
    { key: 'dailyCreditIn_percentage', label: 'Daily Credit In %', type: 'float' },
    { key: 'dailyCreditOut_percentage', label: 'Daily Credit Out %', type: 'float' },
    { key: 'dailyBonusIn_percentage', label: 'Daily Bonus In %', type: 'float' },
    { key: 'dailyBonusOut_percentage', label: 'Daily Bonus Out %', type: 'float' },
    { key: 'dailySOCompensationIn_percentage', label: 'Daily SO Compensation In %', type: 'float' },
    { key: 'dailySOCompensationOut_percentage', label: 'Daily SO Compensation Out %', type: 'float' },
    { key: 'thisWeekPnL_percentage', label: 'This Week PnL %', type: 'float' },
    { key: 'thisWeekDeposit_percentage', label: 'This Week Deposit %', type: 'float' },
    { key: 'thisWeekWithdrawal_percentage', label: 'This Week Withdrawal %', type: 'float' },
    { key: 'thisWeekCreditIn_percentage', label: 'This Week Credit In %', type: 'float' },
    { key: 'thisWeekCreditOut_percentage', label: 'This Week Credit Out %', type: 'float' },
    { key: 'thisWeekBonusIn_percentage', label: 'This Week Bonus In %', type: 'float' },
    { key: 'thisWeekBonusOut_percentage', label: 'This Week Bonus Out %', type: 'float' },
    { key: 'thisWeekSOCompensationIn_percentage', label: 'This Week SO Compensation In %', type: 'float' },
    { key: 'thisWeekSOCompensationOut_percentage', label: 'This Week SO Compensation Out %', type: 'float' },
    { key: 'thisMonthPnL_percentage', label: 'This Month PnL %', type: 'float' },
    { key: 'thisMonthDeposit_percentage', label: 'This Month Deposit %', type: 'float' },
    { key: 'thisMonthWithdrawal_percentage', label: 'This Month Withdrawal %', type: 'float' },
    { key: 'thisMonthCreditIn_percentage', label: 'This Month Credit In %', type: 'float' },
    { key: 'thisMonthCreditOut_percentage', label: 'This Month Credit Out %', type: 'float' },
    { key: 'thisMonthBonusIn_percentage', label: 'This Month Bonus In %', type: 'float' },
    { key: 'thisMonthBonusOut_percentage', label: 'This Month Bonus Out %', type: 'float' },
    { key: 'thisMonthSOCompensationIn_percentage', label: 'This Month SO Compensation In %', type: 'float' },
    { key: 'thisMonthSOCompensationOut_percentage', label: 'This Month SO Compensation Out %', type: 'float' },
    { key: 'lifetimePnL_percentage', label: 'Lifetime PnL %', type: 'float' },
    { key: 'lifetimeDeposit_percentage', label: 'Lifetime Deposit %', type: 'float' },
    { key: 'lifetimeWithdrawal_percentage', label: 'Lifetime Withdrawal %', type: 'float' },
    { key: 'lifetimeCreditIn_percentage', label: 'Lifetime Credit In %', type: 'float' },
    { key: 'lifetimeCreditOut_percentage', label: 'Lifetime Credit Out %', type: 'float' },
    { key: 'lifetimeBonusIn_percentage', label: 'Lifetime Bonus In %', type: 'float' },
    { key: 'lifetimeBonusOut_percentage', label: 'Lifetime Bonus Out %', type: 'float' },
    { key: 'lifetimeSOCompensationIn_percentage', label: 'Lifetime SO Compensation In %', type: 'float' },
    { key: 'lifetimeSOCompensationOut_percentage', label: 'Lifetime SO Compensation Out %', type: 'float' }
  ]

  // Get visible columns list (moved here before being used in useEffect dependencies)
  const visibleColumnsList = useMemo(() => {
    const visible = allColumns.filter(c => visibleColumns[c.key] === true)

    // Apply column ordering if exists
    if (columnOrder && Array.isArray(columnOrder)) {
      const ordered = []
      // First add columns in the specified order
      columnOrder.forEach(key => {
        const col = visible.find(c => c.key === key)
        if (col) ordered.push(col)
      })
      // Then add any remaining visible columns that aren't in the order (new columns)
      visible.forEach(col => {
        if (!ordered.find(c => c.key === col.key)) {
          ordered.push(col)
        }
      })
      return ordered
    }

    return visible
  }, [allColumns, visibleColumns, columnOrder])

  // Sync horizontal scrollbars (robust, loop-guarded)
  useEffect(() => {
    const mainScroll = hScrollRef.current
    const stickyScroll = stickyScrollRef.current

    if (!mainScroll || !stickyScroll) return

    let raf = null
    const syncingFromMain = { current: false }
    const syncingFromSticky = { current: false }

    const handleMainScroll = () => {
      if (!stickyScroll) return
      if (syncingFromSticky.current) return
      syncingFromMain.current = true
      const left = mainScroll.scrollLeft
      if (stickyScroll.scrollLeft !== left) {
        stickyScroll.scrollLeft = left
      }
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { syncingFromMain.current = false })
    }

    const handleStickyScroll = () => {
      if (!mainScroll) return
      if (syncingFromMain.current) return
      syncingFromSticky.current = true
      const left = stickyScroll.scrollLeft
      if (mainScroll.scrollLeft !== left) {
        mainScroll.scrollLeft = left
      }
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => { syncingFromSticky.current = false })
    }

    // Initialize sticky width and sync on mount
    handleMainScroll()

    mainScroll.addEventListener('scroll', handleMainScroll, { passive: true })
    stickyScroll.addEventListener('scroll', handleStickyScroll, { passive: true })

    return () => {
      mainScroll.removeEventListener('scroll', handleMainScroll)
      stickyScroll.removeEventListener('scroll', handleStickyScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [clients.length, visibleColumnsList.length])

  // Get smart default width for a column based on its type and key
  const getDefaultColumnWidth = useCallback((col) => {
    // Check if we have a saved width
    if (columnWidths[col.key]) {
      return columnWidths[col.key]
    }

    // Smart defaults based on column key and type
    const key = col.key.toLowerCase()

    // Very narrow columns
    if (key === 'login' || key === 'id') return 130
    if (key === 'leverage') return 110

    // Email needs more space
    if (key === 'email') return 240

    // Phone numbers - need more space for international format
    if (key === 'phone') return 170

    // Names
    if (key === 'name' || key === 'lastname' || key === 'middlename') return 160

    // Long text fields
    if (key === 'address' || key === 'comment') return 280

    // Country, city, state, company
    if (key === 'country' || key === 'city' || key === 'state' || key === 'company') return 150

    // Group
    if (key === 'group') return 170

    // Date/datetime columns - need more space for full timestamp
    if (col.type === 'date' || key.includes('registration') || key.includes('access') || key.includes('update') || key.includes('date') || key.includes('time')) return 200

    // Percentage columns
    if (key.includes('percentage') || key.includes('_percentage')) return 140

    // Float/number columns - medium width
    if (col.type === 'float' || col.type === 'integer') return 150

    // Default for text
    return 160
  }, [columnWidths])

  // Calculate total table width based on all visible columns
  const totalTableWidth = useMemo(() => {
    return visibleColumnsList.reduce((sum, col) => sum + getDefaultColumnWidth(col), 0)
  }, [visibleColumnsList, columnWidths, getDefaultColumnWidth])

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

  // Checkbox filters are now handled server-side via API (no client-side filtering needed)

  // Fetch clients data
  const fetchClients = useCallback(async (silent = false) => {
    console.log('[Client2] fetchClients called - silent:', silent, 'columnFilters:', columnFilters)
    try {
      if (!silent) {
        setLoading(true)
      }
      setError('')
      // Normalize axios response shapes: some backends return data under data.data
      const extractData = (resp) => (resp?.data?.data) || (resp?.data) || resp

      // Build request payload - simple pagination (column filters handled by /fields endpoint)
      const payload = {
        page: Number(currentPage) || 1,
        limit: Number(itemsPerPage) || 100
      }

      // Add search query if present
      if (searchQuery && searchQuery.trim()) {
        payload.search = searchQuery.trim()
      }

      // Add filters if present
      const combinedFilters = []
      // Capture login checkbox selections to apply via mt5Accounts (OR semantics)
      let checkboxLoginIds = []

      // Inject server-side quick filters (full dataset filtering)
      if (quickFilters?.hasFloating) {
        // Has Floating: exclude rows where floating == 0 (allow negative or positive)
        combinedFilters.push({ field: 'floating', operator: 'not_equal', value: '0' })
      }
      if (quickFilters?.hasCredit) {
        // Has Credit: credit strictly greater than 0
        combinedFilters.push({ field: 'credit', operator: 'greater_than', value: '0' })
      }
      if (quickFilters?.noDeposit) {
        // No Deposit: lifetimeDeposit == 0
        combinedFilters.push({ field: 'lifetimeDeposit', operator: 'equal', value: '0' })
      }
      // Track fields that already have text/number filters to avoid mixing with checkbox filters for same field
      const textFilteredFields = new Set()
      const numberFilteredFields = new Set()
      if (filters && filters.length > 0) {
        combinedFilters.push(...filters)
      }

      // Map UI column keys to API field names (backend uses different naming for some fields)
      const columnKeyToAPIField = (colKey) => {
        // Map UI camelCase keys to backend snake_case or exact field names per API spec
        const fieldMap = {
          lifetimePnL: 'lifetimePnL',  // Backend uses exact camelCase per Postman
          thisMonthPnL: 'thisMonthPnL',
          thisWeekPnL: 'thisWeekPnL',
          dailyPnL: 'dailyPnL',
          marginLevel: 'marginLevel',
          marginFree: 'marginFree',
          lastAccess: 'lastAccess',
          zipCode: 'zipCode',
          middleName: 'middleName',
          lastName: 'lastName'
        }
        return fieldMap[colKey] || colKey
      }

      // Add column header filters: text, number, checkbox
      // Text filters
      Object.entries(columnFilters || {}).forEach(([key, cfg]) => {
        if (key.endsWith('_text') && cfg) {
          const uiKey = key.replace('_text', '')
          const field = columnKeyToAPIField(uiKey)
          textFilteredFields.add(field) // Track that this field has a text filter
          const opMap = { equal: 'equal', notEqual: 'not_equal', contains: 'contains', doesNotContain: 'not_contains', startsWith: 'starts_with', endsWith: 'ends_with' }
          const op = opMap[cfg.operator] || cfg.operator
          const val = cfg.value
          if (val != null && String(val).length > 0) {
            combinedFilters.push({ field, operator: op, value: String(val).trim() })
          }
        }
      })
      // Number filters
      Object.entries(columnFilters || {}).forEach(([key, cfg]) => {
        if (key.endsWith('_number') && cfg) {
          const uiKey = key.replace('_number', '')
          const field = columnKeyToAPIField(uiKey)
          numberFilteredFields.add(field) // Track that this field has a number filter
          const op = cfg.operator
          const v1 = cfg.value1
          const v2 = cfg.value2
          const num1 = v1 !== '' && v1 != null ? Number(v1) : null
          const num2 = v2 !== '' && v2 != null ? Number(v2) : null
          if (op === 'between') {
            if (num1 != null && Number.isFinite(num1)) combinedFilters.push({ field, operator: 'greater_than_equal', value: String(num1) })
            if (num2 != null && Number.isFinite(num2)) combinedFilters.push({ field, operator: 'less_than_equal', value: String(num2) })
          } else if (op && num1 != null && Number.isFinite(num1)) {
            combinedFilters.push({ field, operator: op, value: String(num1) })
          }
        }
      })
      // Add checkbox filters - use smart optimization for OR semantics
      Object.keys(columnFilters).forEach(filterKey => {
        if (filterKey.endsWith('_checkbox')) {
          const columnKey = filterKey.replace('_checkbox', '')
          const filterValues = columnFilters[filterKey]?.values || []

          if (filterValues.length > 0) {
            const field = columnKeyToAPIField(columnKey)

            // Skip checkbox filter if text or number filter is already active for this field
            if (textFilteredFields.has(field) || numberFilteredFields.has(field)) {
              console.log(`[Client2] 🔍 Checkbox ${columnKey}: skipped (text/number filter active)`)
              return
            }

            // Special-case: login filters should use mt5Accounts for proper OR semantics
            if (columnKey === 'login') {
              checkboxLoginIds = Array.from(new Set(filterValues.map(v => Number(v)).filter(v => Number.isFinite(v))))
              console.log(`[Client2] 🔍 Using mt5Accounts for login checkbox: ${checkboxLoginIds.length} accounts`)
            } else {
              const field = columnKeyToAPIField(columnKey)
              const selectedValues = Array.from(new Set(filterValues.map(v => String(v).trim()).filter(Boolean)))

              // When there's a search active, only consider the visible (filtered) values for optimization logic
              const allValues = columnValues[columnKey] || []
              const searchQ = (columnValueSearch[columnKey] || '').toLowerCase()
              const visibleValues = searchQ ? allValues.filter(v => String(v).toLowerCase().includes(searchQ)) : allValues

              // Optimization: skip if ALL visible values are selected (no filtering needed)
              // Only apply this optimization when no search is active (to avoid skipping when user searched and selected)
              if (!searchQ && visibleValues.length > 0 && selectedValues.length === visibleValues.length) {
                console.log(`[Client2] 🔍 Checkbox ${columnKey}: all values selected, skipping filter`)
                return
              }

              // Smart optimization: use not_equal for unselected values if more efficient
              // Use visibleValues for comparison when search is active
              const unselectedValues = visibleValues.filter(v => !selectedValues.includes(String(v).trim()))
              const shouldUseNotEqual = unselectedValues.length > 0 &&
                unselectedValues.length < selectedValues.length &&
                (unselectedValues.length < 50 || unselectedValues.length < selectedValues.length * 0.1)

              if (shouldUseNotEqual) {
                // For not_equal optimization, still use the standard format with operator
                // This is a special case that may not work with the simplified API format
                // So we'll skip this optimization and just send all selected values
                console.log(`[Client2] 🔍 Checkbox ${columnKey}: skipping not_equal optimization, using positive filter`)
              }
              
              {
                // Multiple values (including single): send as comma-separated list
                // Format for API: { "email": "value1,value2,value3" } (not { field: "email", value: "..." })
                const commaSeparatedValues = selectedValues.join(',')
                combinedFilters.push({ [field]: commaSeparatedValues })
                console.log(`[Client2] 🔍 Checkbox ${columnKey}: multi-value filter (${selectedValues.length} values)`)
              }
            }
          }
        }
      })

      if (combinedFilters.length > 0) {
        payload.filters = combinedFilters
        console.log('[Client2] Built filters:', JSON.stringify(combinedFilters, null, 2))
      }

      // Email, name, and phone filters are now applied client-side in sortedClients useMemo
      // This allows filtering the current page data without additional API calls

      // Build MT5 accounts filter, merging Account modal, Active Group (manual list), and selected IB accounts
      let mt5AccountsFilter = []
      // From Account Filter modal
      if (Array.isArray(mt5Accounts) && mt5Accounts.length > 0) {
        mt5AccountsFilter = [...new Set(mt5Accounts.map(Number))]
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
          if (DEBUG_LOGS) console.log('[Client2] Applying range group filter:', activeGroup.range)
        } else if (activeGroup.loginIds && activeGroup.loginIds.length > 0) {
          // Manual selection group: merge/intersect with any existing list
          const groupAccounts = activeGroup.loginIds.map(id => Number(id))
          if (mt5AccountsFilter.length > 0) {
            const set = new Set(groupAccounts)
            mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a)) // intersection
          } else {
            mt5AccountsFilter = [...new Set(groupAccounts)]
          }
          if (DEBUG_LOGS) console.log('[Client2] Applying manual group filter:', groupAccounts.length, 'accounts')
        }
      }

      // Apply IB-selected MT5 accounts server-side
      if (selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0) {
        const ibAccounts = ibMT5Accounts.map(Number)
        if (mt5AccountsFilter.length > 0) {
          const set = new Set(ibAccounts)
          mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a)) // intersection
        } else {
          mt5AccountsFilter = [...new Set(ibAccounts)]
        }
      }

      // Merge in login checkbox selections (OR) into mt5Accounts filter
      if (checkboxLoginIds.length > 0) {
        if (mt5AccountsFilter.length > 0) {
          const set = new Set(checkboxLoginIds)
          mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(Number(a))) // intersection with existing mt5 list
        } else {
          mt5AccountsFilter = [...new Set(checkboxLoginIds)]
        }
      }

      // Assign final mt5Accounts if any
      if (mt5AccountsFilter.length > 0) {
        payload.mt5Accounts = mt5AccountsFilter
      }

      // Add sorting if present
      if (sortBy) {
        payload.sortBy = sortBy
        payload.sortOrder = sortOrder
      }

      // ALWAYS fetch normal data for table display
      const shouldFetchPercentage = percentModeActive

      // Checkbox filters are now handled server-side via API filters (single request with comma-separated values)

      // Always log payload when filters are present to debug filtering issues
      if (payload.filters && payload.filters.length > 0) {
        console.log('[Client2] 🔍 API Request Payload:', JSON.stringify(payload, null, 2))
      }

      // Fetch data with single API call
      if (shouldFetchPercentage) {
        // Fetch both normal and percentage data
        const [normalResponse, percentResponse] = await Promise.all([
          brokerAPI.searchClients(payload),
          brokerAPI.searchClients({ ...payload, percentage: true })
        ])

        const normalData = extractData(normalResponse)
        const normalClients = (normalData?.clients || []).filter(c => c != null && c.login != null)
        const normalTotals = normalData?.totals || {}
        const normalTotal = Number(normalData?.total || normalClients.length || 0)
        const pages = Math.max(1, Number(normalData?.pages || 1))

        setClients(normalClients)
        setTotalClients(normalTotal)
        setTotalPages(pages)
        setTotals(normalTotals)
        setError('')

        // Set percentage data
        const percentData = extractData(percentResponse)
        const percentTotals = percentData?.totals || {}
        setTotalsPercent(percentTotals)
      } else {
        // Normal only
        const normalResponse = await brokerAPI.searchClients(payload)
        const normalData = extractData(normalResponse)
        const normalClients = (normalData?.clients || []).filter(c => c != null && c.login != null)
        const normalTotals = normalData?.totals || {}
        const normalTotal = Number(normalData?.total || normalClients.length || 0)
        const pages = Math.max(1, Number(normalData?.pages || 1))

        setClients(normalClients)
        setTotalClients(normalTotal)
        setTotalPages(pages)
        setTotals(normalTotals)
        setTotalsPercent({})
        setError('')
      }
    } catch (err) {
      // Ignore request cancellations caused by in-flight aborts
      const isCanceled = err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || /aborted|canceled/i.test(err?.message || '')
      if (isCanceled) {
        try { if (DEBUG_LOGS) console.debug('[Client2] fetchClients canceled (expected on fast refresh)') } catch { }
        return
      }
      console.error('[Client2] Error fetching clients:', err)
      console.error('[Client2] Error details:', {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status,
        url: err.config?.url
      })
      if (!silent) {
        let errorMessage = 'Failed to fetch clients'
        if (err.code === 'ERR_NETWORK') {
          errorMessage = 'Network error: Unable to connect to server. Please check if the backend is running.'
        } else if (err.response?.status === 401) {
          errorMessage = 'Authentication failed. Please login again.'
        } else if (err.response?.status === 403) {
          errorMessage = 'Access denied. You do not have permission to view this data.'
        } else if (err.response?.status === 500) {
          errorMessage = 'Server error. Please try again later.'
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message
        } else if (err.message) {
          errorMessage = err.message
        }
        setError(errorMessage)
      }
    } finally {
      isFetchingRef.current = false
      if (!silent) {
        setLoading(false)
      }
      // Mark initial load complete and always reset sorting state
      setInitialLoad(false)
      setIsSorting(false)
    }
  }, [currentPage, itemsPerPage, searchQuery, filters, columnFilters, mt5Accounts, accountRangeMin, accountRangeMax, sortBy, sortOrder, percentModeActive, activeGroup, selectedIB, ibMT5Accounts, quickFilters])

  // Clear cached column values when filters change (IB, group, accounts, filters, search)
  // This ensures column value dropdowns always fetch fresh data from API
  useEffect(() => {
    setColumnValues({})
    setSelectedColumnValues({})
  }, [selectedIB, ibMT5Accounts, activeGroup, mt5Accounts, accountRangeMin, accountRangeMax, filters, searchQuery, quickFilters])

  // Refetch when any percent face card visibility toggles
  useEffect(() => {
    fetchClients(false)
  }, [percentModeActive, fetchClients])

  // Pass-through - filtering done by API (like ClientsPage)
  const sortedClients = useMemo(() => {
    if (!Array.isArray(clients)) return []
    return clients.filter(c => c != null && c.login != null)
  }, [clients])

  // Compute percentage totals by summing percentage columns from client data
  const computedPercentageTotals = useMemo(() => {
    const dataSource = sortedClients
    
    if (!Array.isArray(dataSource) || dataSource.length === 0) {
      return {
        dailyDeposit: 0,
        dailyWithdrawal: 0,
        lifetimePnL: 0
      }
    }
    
    return {
      dailyDeposit: dataSource.reduce((sum, client) => sum + (parseFloat(client.dailyDeposit_percentage) || 0), 0),
      dailyWithdrawal: dataSource.reduce((sum, client) => sum + (parseFloat(client.dailyWithdrawal_percentage) || 0), 0),
      lifetimePnL: dataSource.reduce((sum, client) => sum + (parseFloat(client.lifetimePnL_percentage) || 0), 0)
    }
  }, [sortedClients])

  // Fetch rebate totals from API
  const fetchRebateTotals = useCallback(async () => {
    try {
      const response = await brokerAPI.getIBCommissionTotals()
      // API returns nested structure: response.data.data
      const data = response?.data?.data || response?.data || {}
      console.log('[Client2] Rebate totals received:', data)
      setRebateTotals({
        availableRebate: data.total_available_commission || 0,
        availableRebatePercent: data.total_available_commission_percentage || 0,
        totalRebate: data.total_commission || 0,
        totalRebatePercent: data.total_commission_percentage || 0
      })
    } catch (err) {
      console.error('[Client2] Error fetching rebate totals:', err)
    }
  }, [])

  // Initial fetch and refetch on dependency changes
  useEffect(() => {
    console.log('[Client2] ⚡ useEffect triggered - fetchClients dependency changed')
    console.log('[Client2] Current columnFilters:', JSON.stringify(columnFilters, null, 2))
    fetchClients()
    fetchRebateTotals()
  }, [fetchClients, fetchRebateTotals])

  // Auto-refresh rebate totals every 1 hour
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchRebateTotals()
    }, 3600000) // 3600000ms = 1 hour
    return () => clearInterval(intervalId)
  }, [fetchRebateTotals])

  // Removed server-side quick filter refetch; quick filters now apply client-side to current page only

  // Percentage view is now controlled by Card Filter (cardVisibility.percentage) and fetched together with main data

  // Auto-refresh every 1 second to keep data updated (including filtered data)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchClients(true) // silent = true, no loading spinner - will refresh with current filters applied
    }, 1000) // 1 second refresh for real-time updates
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

  // Column resize handlers - expands/contracts table width instead of stealing from neighbor
  const handleResizeStart = useCallback((e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    resizeStartX.current = e.clientX
    // Measure the actual current width of the header cell for accurate resizing
    const measured = headerRefs.current?.[columnKey]?.getBoundingClientRect()?.width
    resizeStartWidth.current = (typeof measured === 'number' && measured > 0)
      ? measured
      : (columnWidths[columnKey] || getDefaultColumnWidth({ key: columnKey }))
  }, [columnWidths])

  const handleResizeMove = useCallback((e) => {
    if (!resizingColumn) return

    // Auto-scroll when dragging near edges of scroll container
    const scrollContainer = hScrollRef.current
    if (scrollContainer) {
      const rect = scrollContainer.getBoundingClientRect()
      const scrollEdgeThreshold = 50 // pixels from edge to trigger scroll
      const scrollSpeed = 10 // pixels to scroll per frame

      // Check if mouse is near left edge
      if (e.clientX < rect.left + scrollEdgeThreshold && scrollContainer.scrollLeft > 0) {
        scrollContainer.scrollLeft -= scrollSpeed
      }
      // Check if mouse is near right edge
      else if (e.clientX > rect.right - scrollEdgeThreshold) {
        scrollContainer.scrollLeft += scrollSpeed
      }
    }

    // Use requestAnimationFrame for smooth rendering
    if (resizeRAF.current) {
      cancelAnimationFrame(resizeRAF.current)
    }
    resizeRAF.current = requestAnimationFrame(() => {
      const diff = e.clientX - resizeStartX.current
      // Allow both directions with min width 50px
      const newWidth = Math.max(50, resizeStartWidth.current + diff)

      // Simply update the column width - table will expand/contract accordingly
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }))
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
      // Guard: filter out null/undefined clients
      const columnData = (clients || []).filter(row => row != null).map(row => row[baseKey || columnKey])

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

  // Column drag and drop handlers for reordering
  const handleColumnDragStart = (e, columnKey) => {
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'

    // Create custom drag image showing the full column header
    const headerElement = headerRefs.current[columnKey]
    if (headerElement) {
      // Clone the header element for drag preview
      const clone = headerElement.cloneNode(true)
      clone.style.position = 'absolute'
      clone.style.top = '-9999px'
      clone.style.width = `${headerElement.offsetWidth}px`
      clone.style.backgroundColor = '#2563eb'
      clone.style.padding = '12px 16px'
      clone.style.borderRadius = '6px'
      clone.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      document.body.appendChild(clone)
      e.dataTransfer.setDragImage(clone, headerElement.offsetWidth / 2, 20)
      setTimeout(() => document.body.removeChild(clone), 0)
    }
  }

  const handleColumnDragOver = (e, columnKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (columnKey !== draggedColumn) {
      setDragOverColumn(columnKey)
    }
  }

  const handleColumnDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleColumnDrop = (e, targetColumnKey) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    // Get current order from visibleColumnsList
    const currentOrder = visibleColumnsList.map(col => col.key)
    const draggedIndex = currentOrder.indexOf(draggedColumn)
    const targetIndex = currentOrder.indexOf(targetColumnKey)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null)
      setDragOverColumn(null)
      return
    }

    // Create new order array
    const newOrder = [...currentOrder]
    const [removed] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, removed)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
    setDragOverColumn(null)
  }

  const handleColumnDragEnd = () => {
    setDraggedColumn(null)
    setDragOverColumn(null)
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
        if (!client) return // Guard: skip null/undefined clients
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
    console.log('[Client2] ✅ Checkbox filter cleared (client-side filtering updated)')
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
    if (!temp || temp.value1 === '' || temp.value1 == null) return

    if (temp.operator === 'between' && (temp.value2 === '' || temp.value2 == null)) return

    const filterConfig = {
      operator: temp.operator,
      value1: parseFloat(temp.value1),
      value2: temp.value2 ? parseFloat(temp.value2) : null
    }

    console.log('[Client2] applyNumberFilter called for', columnKey, 'with config:', filterConfig)

    setColumnFilters(prev => {
      const updated = {
        ...prev,
        [`${columnKey}_number`]: filterConfig
      }
      console.log('[Client2] Updated columnFilters:', updated)
      return updated
    })

    setShowFilterDropdown(null)
    setCurrentPage(1)

    // Immediately fetch full dataset with new filter
    setTimeout(() => {
      fetchClients(false)
    }, 0)
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

    console.log('[Client2] applyTextFilter called for', columnKey, 'with config:', filterConfig)

    setColumnFilters(prev => {
      const updated = {
        ...prev,
        [`${columnKey}_text`]: filterConfig
      }
      console.log('[Client2] Updated columnFilters:', updated)
      return updated
    })

    setShowFilterDropdown(null)
    setCurrentPage(1)

    // Immediately fetch full dataset with new filter
    setTimeout(() => {
      fetchClients(false)
    }, 0)
  }

  // Build payload for fetching column values using current table filters (server-side), excluding the current column's header filter
  const buildColumnValuesPayload = (columnKey, page = 1, limit = columnValuesBatchSize) => {
    const payload = {
      page: Number(page) || 1,
      limit: Number(limit) || columnValuesBatchSize
    }
    if (searchQuery && searchQuery.trim()) payload.search = searchQuery.trim()

    // Collect filters like in fetchClients, but skip filters for the same columnKey to avoid self-filtering
    const combinedFilters = []
    let multiOrField = null
    let multiOrValues = []
    let multiOrConflict = false
    const textFilteredFields = new Set()
    const numberFilteredFields = new Set()

    // Table-level filters
    if (filters && filters.length > 0) combinedFilters.push(...filters)

    const columnKeyToAPIField = (colKey) => {
      const fieldMap = {
        lifetimePnL: 'lifetimePnL',
        thisMonthPnL: 'thisMonthPnL',
        thisWeekPnL: 'thisWeekPnL',
        dailyPnL: 'dailyPnL',
        marginLevel: 'marginLevel',
        marginFree: 'marginFree',
        lastAccess: 'lastAccess',
        zipCode: 'zipCode',
        middleName: 'middleName',
        lastName: 'lastName'
      }
      return fieldMap[colKey] || colKey
    }

    // Header filters except the current column
    if (columnFilters && Object.keys(columnFilters).length > 0) {
      Object.entries(columnFilters).forEach(([key, cfg]) => {
        if (key.startsWith(columnKey + '_')) return // skip same column
        if (key.endsWith('_text') && cfg) {
          const uiKey = key.replace('_text', '')
          const field = columnKeyToAPIField(uiKey)
          const opMap = { equal: 'equal', notEqual: 'not_equal', contains: 'contains', doesNotContain: 'not_contains', startsWith: 'starts_with', endsWith: 'ends_with' }
          const op = opMap[cfg.operator] || cfg.operator
          const val = cfg.value
          if (val != null && String(val).length > 0) {
            combinedFilters.push({ field, operator: op, value: String(val).trim() })
            textFilteredFields.add(uiKey)
          }
          return
        }
        if (key.endsWith('_number') && cfg) {
          const uiKey = key.replace('_number', '')
          if (uiKey === columnKey) return
          const field = columnKeyToAPIField(uiKey)
          const op = cfg.operator
          const v1 = cfg.value1
          const v2 = cfg.value2
          const num1 = v1 !== '' && v1 != null ? Number(v1) : null
          const num2 = v2 !== '' && v2 != null ? Number(v2) : null
          if (op === 'between') {
            if (num1 != null && Number.isFinite(num1)) combinedFilters.push({ field, operator: 'greater_than_equal', value: String(num1) })
            if (num2 != null && Number.isFinite(num2)) combinedFilters.push({ field, operator: 'less_than_equal', value: String(num2) })
          } else if (op && num1 != null && Number.isFinite(num1)) {
            combinedFilters.push({ field, operator: op, value: String(num1) })
          }
          numberFilteredFields.add(uiKey)
          return
        }
      })
      Object.entries(columnFilters).forEach(([key, cfg]) => {
        if (key.endsWith('_checkbox') && cfg && Array.isArray(cfg.values) && cfg.values.length > 0) {
          const uiKey = key.replace('_checkbox', '')
          if (uiKey === columnKey) return
          const field = columnKeyToAPIField(uiKey)
          if (textFilteredFields.has(uiKey) || numberFilteredFields.has(uiKey)) return
          const rawValues = cfg.values.map(v => String(v).trim()).filter(v => v.length > 0)
          if (rawValues.length === 0) return
          if (rawValues.length === 1) {
            combinedFilters.push({ field, operator: 'equal', value: rawValues[0] })
          } else {
            // Provide array for backend; treat multi-value as OR by storing values list
            if (multiOrField && multiOrField !== field) multiOrConflict = true
            else { multiOrField = field; multiOrValues = rawValues }
          }
        }
      })
    }
    if (combinedFilters.length > 0) payload.filters = combinedFilters

    // Merge account filters/group/IB
    let mt5AccountsFilter = []
    if (Array.isArray(mt5Accounts) && mt5Accounts.length > 0) mt5AccountsFilter = [...new Set(mt5Accounts.map(Number))]
    if (accountRangeMin && accountRangeMin.trim()) payload.accountRangeMin = parseInt(accountRangeMin.trim())
    if (accountRangeMax && accountRangeMax.trim()) payload.accountRangeMax = parseInt(accountRangeMax.trim())
    if (activeGroup) {
      if (activeGroup.range) {
        payload.accountRangeMin = activeGroup.range.from
        payload.accountRangeMax = activeGroup.range.to
      } else if (activeGroup.loginIds && activeGroup.loginIds.length > 0) {
        const groupAccounts = activeGroup.loginIds.map(id => Number(id))
        if (mt5AccountsFilter.length > 0) {
          const set = new Set(groupAccounts)
          mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a))
        } else {
          mt5AccountsFilter = [...new Set(groupAccounts)]
        }
      }
    }
    if (selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0) {
      const ibAccounts = ibMT5Accounts.map(Number)
      if (mt5AccountsFilter.length > 0) {
        const set = new Set(ibAccounts)
        mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a))
      } else {
        mt5AccountsFilter = [...new Set(ibAccounts)]
      }
    }
    if (mt5AccountsFilter.length > 0) payload.mt5Accounts = mt5AccountsFilter
    return { payload, multiOrField, multiOrValues, multiOrConflict }
  }

  // Fetch column values with search filter (server-side search using dedicated endpoint)
  const fetchColumnValuesWithSearch = async (columnKey, searchQuery = '', forceRefresh = false) => {
    // Only allow API calls for specific columns
    const allowedColumns = ['login', 'name', 'lastName', 'email', 'phone']
    if (!allowedColumns.includes(columnKey)) {
      console.log(`[Client2] Skipping API call for non-whitelisted column: ${columnKey}`)
      // Initialize states to prevent undefined values
      setColumnValues(prev => ({ ...prev, [columnKey]: [] }))
      setColumnValuesLoading(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesLoadingMore(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 0 }))
      setColumnValuesTotalPages(prev => ({ ...prev, [columnKey]: 0 }))
      return
    }

    // Don't fetch if already loading
    if (columnValuesLoading[columnKey]) return
    // Skip for unsupported fields
    if (columnValuesUnsupported[columnKey]) return

    setColumnValuesLoading(prev => ({ ...prev, [columnKey]: true }))
    setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 1 }))
    // Reset scroll gating for this column
    columnScrollUserActionRef.current[columnKey] = false
    columnScrollLastTriggerRef.current[columnKey] = -Infinity
    columnLastScrollTopRef.current[columnKey] = 0

    try {
      // Use dedicated fields API endpoint that searches across ALL data
      const baseParams = {
        fields: columnKey,
        search: searchQuery.trim() || undefined
      }

      // Add quick filter constraints as query params
      if (quickFilters?.hasFloating) {
        baseParams.hasFloating = true
      }
      if (quickFilters?.hasCredit) {
        baseParams.hasCredit = true
      }
      if (quickFilters?.noDeposit) {
        baseParams.noDeposit = true
      }

      // Add group filter if active
      if (activeGroup?.logins && activeGroup.logins.length > 0) {
        baseParams.logins = activeGroup.logins.join(',')
      }

      // Add IB filter if active
      if (selectedIB && ibMT5Accounts && ibMT5Accounts.length > 0) {
        baseParams.ibAccounts = ibMT5Accounts.join(',')
      }

      const setVals = new Set()

      if (searchQuery && searchQuery.trim()) {
        // When searching, fetch first page only and enable lazy loading for more
        const firstParams = { ...baseParams, page: 1, limit: 500 }
        const firstResponse = await brokerAPI.getClientFields(firstParams)
        const extract = (resp) => (resp?.data?.data) || (resp?.data) || resp
        const firstData = extract(firstResponse)

        // Extract values from first page
        const firstClients = firstData?.clients || []
        firstClients.forEach(client => {
          const v = client?.[columnKey]
          if (v !== null && v !== undefined && v !== '') setVals.add(v)
        })

        // Get total pages to determine if there's more data
        const totalPages = Math.max(1, Number(firstData?.pages || firstData?.totalPages || 1))
        const uniqueValues = Array.from(setVals).sort((a, b) => String(a).localeCompare(String(b)))

        setColumnValues(prev => ({ ...prev, [columnKey]: uniqueValues }))
        setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 1 }))
        setColumnValuesTotalPages(prev => ({ ...prev, [columnKey]: totalPages }))
        setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: totalPages > 1 }))
      }
    } catch (err) {
      console.error(`[Client2Page] Error fetching column values with search for ${columnKey}:`, err)
      setColumnValues(prev => ({ ...prev, [columnKey]: [] }))
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesTotalPages(prev => ({ ...prev, [columnKey]: null }))
    } finally {
      setColumnValuesLoading(prev => ({ ...prev, [columnKey]: false }))
    }
  }

  // Fetch column values in batches of 500 (lazy loading) using dedicated fields API
  const fetchColumnValues = async (columnKey, forceRefresh = false) => {
    // Only allow API calls for specific columns
    const allowedColumns = ['login', 'name', 'lastName', 'email', 'phone']
    if (!allowedColumns.includes(columnKey)) {
      console.log(`[Client2] Skipping API call for non-whitelisted column: ${columnKey}`)
      // Initialize states to prevent undefined values
      setColumnValues(prev => ({ ...prev, [columnKey]: [] }))
      setColumnValuesLoading(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesLoadingMore(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 0 }))
      setColumnValuesTotalPages(prev => ({ ...prev, [columnKey]: 0 }))
      return
    }

    // Don't fetch if already loading
    if (columnValuesLoading[columnKey]) return
    // Don't fetch if already loaded (unless forcing refresh)
    if (!forceRefresh && columnValues[columnKey]) return

    setColumnValuesLoading(prev => ({ ...prev, [columnKey]: true }))
    setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 1 }))
    // Reset scroll gating for this column
    columnScrollUserActionRef.current[columnKey] = false
    columnScrollLastTriggerRef.current[columnKey] = -Infinity
    columnLastScrollTopRef.current[columnKey] = 0

    try {
      // Use dedicated fields API endpoint
      const params = {
        fields: columnKey,
        page: 1,
        limit: 500
      }

      // Add quick filter constraints
      if (quickFilters?.hasFloating) {
        params.hasFloating = true
      }
      if (quickFilters?.hasCredit) {
        params.hasCredit = true
      }
      if (quickFilters?.noDeposit) {
        params.noDeposit = true
      }

      // Add group filter if active
      if (activeGroup?.logins && activeGroup.logins.length > 0) {
        params.logins = activeGroup.logins.join(',')
      }

      // Add IB filter if active
      if (selectedIB && ibMT5Accounts && ibMT5Accounts.length > 0) {
        params.ibAccounts = ibMT5Accounts.join(',')
      }

      const response = await brokerAPI.getClientFields(params)
      const extract = (resp) => (resp?.data?.data) || (resp?.data) || resp
      const data = extract(response)

      // Extract unique values from response
      const clients = data?.clients || []
      const setVals = new Set()
      clients.forEach(client => {
        const v = client?.[columnKey]
        if (v !== null && v !== undefined && v !== '') setVals.add(v)
      })

      const uniqueValues = Array.from(setVals).sort((a, b) => String(a).localeCompare(String(b)))
      const pagesNum = Number(data?.pages)
      const hasPagesInfo = Number.isFinite(pagesNum) && pagesNum > 0
      const inferredHasMore = clients.length >= 500
      const totalPages = hasPagesInfo ? pagesNum : null

      console.log(`[Client2] fetchColumnValues complete for ${columnKey}: ${uniqueValues.length} values, page 1${hasPagesInfo ? ` of ${pagesNum}` : ''}`)

      setColumnValues(prev => ({ ...prev, [columnKey]: uniqueValues }))
      setSelectedColumnValues(prev => ({ ...prev, [columnKey]: [] }))
      setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: 1 }))
      setColumnValuesTotalPages(prev => ({ ...prev, [columnKey]: totalPages }))
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: hasPagesInfo ? pagesNum > 1 : inferredHasMore }))
    } catch (err) {
      console.error(`[Client2Page] Error fetching column values for ${columnKey}:`, err)
      setColumnValues(prev => ({ ...prev, [columnKey]: [] }))
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: false }))
      setColumnValuesTotalPages(prev => ({ ...prev, [columnKey]: null }))
    } finally {
      setColumnValuesLoading(prev => ({ ...prev, [columnKey]: false }))
    }
  }

  // Load more column values when scrolling (fetch next 500)
  const fetchMoreColumnValues = async (columnKey) => {
    console.log(`[Client2] fetchMoreColumnValues called for ${columnKey}`)
    console.log(`[Client2] State - loading: ${columnValuesLoadingMore[columnKey]}, hasMore: ${columnValuesHasMore[columnKey]}`)

    // Don't fetch if already loading more
    if (columnValuesLoadingMore[columnKey]) {
      console.log(`[Client2] Already loading more for ${columnKey}, skipping`)
      return
    }
    // Don't fetch if no more values
    if (!columnValuesHasMore[columnKey]) {
      console.log(`[Client2] No more values for ${columnKey}, skipping`)
      return
    }

    const currentPage = columnValuesCurrentPage[columnKey] || 1
    const totalPages = columnValuesTotalPages[columnKey]  // may be null if unknown

    console.log(`[Client2] Page info - current: ${currentPage}, total: ${totalPages ?? 'unknown'}`)

    if (typeof totalPages === 'number' && currentPage >= totalPages) {
      console.log(`[Client2] Current page ${currentPage} >= total pages ${totalPages}, setting hasMore to false`)
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: false }))
      return
    }

    console.log(`[Client2] Fetching page ${currentPage + 1} for ${columnKey}`)
    setColumnValuesLoadingMore(prev => ({ ...prev, [columnKey]: true }))

    try {
      const nextPage = currentPage + 1
      const searchQuery = columnValueSearchDebounce[columnKey] || columnValueSearch[columnKey] || ''

      // Use dedicated fields API endpoint
      const params = {
        fields: columnKey,
        search: searchQuery.trim() || undefined,
        page: nextPage,
        limit: 500
      }

      // Add quick filter constraints
      if (quickFilters?.hasFloating) {
        params.hasFloating = true
      }
      if (quickFilters?.hasCredit) {
        params.hasCredit = true
      }
      if (quickFilters?.noDeposit) {
        params.noDeposit = true
      }

      // Add group filter if active
      if (activeGroup?.logins && activeGroup.logins.length > 0) {
        params.logins = activeGroup.logins.join(',')
      }

      // Add IB filter if active
      if (selectedIB && ibMT5Accounts && ibMT5Accounts.length > 0) {
        params.ibAccounts = ibMT5Accounts.join(',')
      }

      const response = await brokerAPI.getClientFields(params)
      const extract = (resp) => (resp?.data?.data) || (resp?.data) || resp
      const data = extract(response)

      // Extract and merge with existing values
      const clients = data?.clients || []
      const setVals = new Set(columnValues[columnKey] || [])
      clients.forEach(client => {
        const v = client?.[columnKey]
        if (v !== null && v !== undefined && v !== '') setVals.add(v)
      })

      const uniqueValues = Array.from(setVals).sort((a, b) => String(a).localeCompare(String(b)))
      setColumnValues(prev => ({ ...prev, [columnKey]: uniqueValues }))
      setColumnValuesCurrentPage(prev => ({ ...prev, [columnKey]: nextPage }))
      const nextHasMore = (typeof totalPages === 'number') ? (nextPage < totalPages) : (clients.length >= 500)
      setColumnValuesHasMore(prev => ({ ...prev, [columnKey]: nextHasMore }))
    } catch (err) {
      console.error(`[Client2Page] Error fetching more column values for ${columnKey}:`, err)
    } finally {
      setColumnValuesLoadingMore(prev => ({ ...prev, [columnKey]: false }))
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

  // Toggle select only currently visible (filtered) values for the column
  const toggleSelectVisibleColumnValues = (columnKey) => {
    const allValues = columnValues[columnKey] || []
    const searchQ = (columnValueSearch[columnKey] || '').toLowerCase()
    const visible = searchQ ? allValues.filter(v => String(v).toLowerCase().includes(searchQ)) : allValues
    const currentSelected = selectedColumnValues[columnKey] || []
    const allVisibleSelected = visible.length > 0 && visible.every(v => currentSelected.includes(v))

    let nextSelected
    if (allVisibleSelected) {
      // Deselect only the currently visible values
      const visibleSet = new Set(visible)
      nextSelected = currentSelected.filter(v => !visibleSet.has(v))
    } else {
      // Add visible values to the selection
      const merged = new Set([...currentSelected, ...visible])
      nextSelected = Array.from(merged)
    }
    setSelectedColumnValues(prev => ({ ...prev, [columnKey]: nextSelected }))
  }

  // Apply checkbox filter - builds server-side filters using proper API format
  const applyCheckboxFilter = (columnKey) => {
    const selected = selectedColumnValues[columnKey] || []

    console.log('[Client2] ========================================')
    console.log('[Client2] applyCheckboxFilter called')
    console.log('[Client2] columnKey:', columnKey)
    console.log('[Client2] selected values:', selected)
    console.log('[Client2] selected count:', selected.length)
    console.log('[Client2] ========================================')

    if (selected.length === 0) {
      console.log('[Client2] No values selected, clearing filter')
      clearColumnFilter(columnKey)
      return
    }

    setShowFilterDropdown(null)
    setCurrentPage(1)

    // Store filter in state - will be sent to API via fetchClients
    setColumnFilters(prev => {
      const updated = {
        ...prev,
        [`${columnKey}_checkbox`]: { values: selected }
      }
      console.log('[Client2] ✅ Checkbox filter updated:', JSON.stringify(updated, null, 2))
      return updated
    })

    // No need to explicitly call fetchClients - useEffect will handle it when columnFilters changes
  }

  const applySortToColumn = (columnKey, direction) => {
    // Update the columnSortOrder state for UI indication
    setColumnSortOrder({
      [columnKey]: direction // Only one column can be sorted at a time
    })

    // Update sortBy and sortOrder to trigger API call
    setSortBy(columnKey)
    setSortOrder(direction)

    // Reset to first page when sorting changes
    setCurrentPage(1)

    setShowFilterDropdown(null)
  }

  const clearSort = (columnKey) => {
    setColumnSortOrder(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })

    // Clear the API sort states if this was the active sort column
    if (sortBy === columnKey) {
      setSortBy('')
      setSortOrder('asc')
      setCurrentPage(1)
    }
  }

  const getColumnType = (columnKey) => {
    const column = allColumns.find(col => col.key === columnKey)
    return column?.type || 'text'
  }

  // Handle page change
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Trigger immediate fetch for the new page
    // Don't wait for scroll; data fetch happens via useEffect dependency on currentPage
  }

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value))
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
    if (!clients || clients.length === 0) {
      alert('No data to export')
      return
    }

    // Get headers
    const headers = visibleColumnsList.map(col => col.label).join(',')

    // Get rows - filter out null/undefined clients
    const rows = (clients || []).filter(client => client != null).map(client => {
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

  // Face card drag and drop handlers
  const handleCardDragStart = (e, cardKey) => {
    setDraggedCard(cardKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCardDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCardDrop = (e, targetCardKey) => {
    e.preventDefault()

    if (draggedCard && draggedCard !== targetCardKey) {
      const newOrder = [...faceCardOrder]
      const draggedIndex = newOrder.indexOf(draggedCard)
      const targetIndex = newOrder.indexOf(targetCardKey)

      if (draggedIndex !== -1 && targetIndex !== -1) {
        // Swap the positions - matching ClientsPage approach
        newOrder[draggedIndex] = targetCardKey
        newOrder[targetIndex] = draggedCard

        setFaceCardOrder(newOrder)
        localStorage.setItem('client2FaceCardOrder', JSON.stringify(newOrder))
      }
    }
  }

  const handleCardDragEnd = () => {
    setDraggedCard(null)
  }

  // Ensure faceCardOrder always contains all known keys (in case defaults grow over time)
  useEffect(() => {
    try {
      const defaults = [...defaultClient2FaceCardOrder]
      const orderSet = new Set(faceCardOrder)
      let changed = false
      defaults.forEach(k => { if (!orderSet.has(k)) { orderSet.add(k); changed = true } })
      if (changed) {
        const merged = Array.from(orderSet)
        setFaceCardOrder(merged)
        localStorage.setItem('client2FaceCardOrder', JSON.stringify(merged))
      }
    } catch { }
  }, [faceCardOrder])

  const resetClient2FaceCardOrder = () => {
    setFaceCardOrder(defaultClient2FaceCardOrder)
    localStorage.setItem('client2FaceCardOrder', JSON.stringify(defaultClient2FaceCardOrder))
  }

  // Get comprehensive card configuration for dynamic rendering - matches all 57 cards
  const getClient2CardConfig = useCallback((cardKey, totals) => {
    const configs = {
      // COUNT
      totalClients: { label: 'Total Clients', color: 'blue', format: 'integer', getValue: () => totalClients || 0 },
      // A
      assets: { label: 'Assets', color: 'blue', getValue: () => totals?.assets || 0 },

      // B
      balance: { label: 'Balance', color: 'indigo', getValue: () => totals?.balance || 0 },
      blockedCommission: { label: 'Blocked Commission', color: 'gray', getValue: () => totals?.blockedCommission || 0 },
      blockedProfit: { label: 'Blocked Profit', color: 'orange', getValue: () => totals?.blockedProfit || 0, colorCheck: true },

      // C
      commission: { label: 'Commission', color: 'amber', getValue: () => totals?.commission || 0 },
      credit: { label: 'Credit', color: 'emerald', getValue: () => totals?.credit || 0 },

      // D - Daily
      dailyBonusIn: { label: 'Daily Bonus In', color: 'teal', getValue: () => totals?.dailyBonusIn || 0 },
      dailyBonusOut: { label: 'Daily Bonus Out', color: 'red', getValue: () => totals?.dailyBonusOut || 0 },
      dailyCreditIn: { label: 'Daily Credit In', color: 'emerald', getValue: () => totals?.dailyCreditIn || 0 },
      dailyCreditOut: { label: 'Daily Credit Out', color: 'red', getValue: () => totals?.dailyCreditOut || 0 },
      dailyDeposit: { label: 'Daily Deposit', color: 'green', getValue: () => totals?.dailyDeposit || 0 },
      dailyDepositPercent: { label: 'Daily Deposit %', color: 'emerald', getValue: () => computedPercentageTotals?.dailyDeposit || 0 },
      dailyPnL: { label: 'Daily P&L', color: 'cyan', getValue: () => totals?.dailyPnL || 0, colorCheck: true },
      dailySOCompensationIn: { label: 'Daily SO Compensation In', color: 'purple', getValue: () => totals?.dailySOCompensationIn || 0 },
      dailySOCompensationOut: { label: 'Daily SO Compensation Out', color: 'orange', getValue: () => totals?.dailySOCompensationOut || 0 },
      dailyWithdrawal: { label: 'Daily Withdrawal', color: 'red', getValue: () => totals?.dailyWithdrawal || 0 },
      dailyWithdrawalPercent: { label: 'Daily Withdrawal %', color: 'rose', getValue: () => computedPercentageTotals?.dailyWithdrawal || 0 },

      // E
      equity: { label: 'Equity', color: 'purple', getValue: () => totals?.equity || 0 },

      // F
      floating: { label: 'Floating P/L', color: 'cyan', getValue: () => totals?.floating || 0, colorCheck: true },

      // L
      liabilities: { label: 'Liabilities', color: 'red', getValue: () => totals?.liabilities || 0 },

      // L - Lifetime
      lifetimeBonusIn: { label: 'Lifetime Bonus In', color: 'teal', getValue: () => totals?.lifetimeBonusIn || 0 },
      lifetimeBonusOut: { label: 'Lifetime Bonus Out', color: 'red', getValue: () => totals?.lifetimeBonusOut || 0 },
      lifetimeCreditIn: { label: 'Lifetime Credit In', color: 'emerald', getValue: () => totals?.lifetimeCreditIn || 0 },
      lifetimeCreditOut: { label: 'Lifetime Credit Out', color: 'red', getValue: () => totals?.lifetimeCreditOut || 0 },
      lifetimeDeposit: { label: 'Lifetime Deposit', color: 'green', getValue: () => totals?.lifetimeDeposit || 0 },
      lifetimePnL: { label: 'Lifetime P&L', color: 'indigo', getValue: () => totals?.lifetimePnL || 0, colorCheck: true },
      lifetimePnLPercent: { label: 'Lifetime PnL %', color: 'violet', getValue: () => computedPercentageTotals?.lifetimePnL || 0, colorCheck: true },
      lifetimeSOCompensationIn: { label: 'Lifetime SO Compensation In', color: 'purple', getValue: () => totals?.lifetimeSOCompensationIn || 0 },
      lifetimeSOCompensationOut: { label: 'Lifetime SO Compensation Out', color: 'orange', getValue: () => totals?.lifetimeSOCompensationOut || 0 },
      lifetimeWithdrawal: { label: 'Lifetime Withdrawal', color: 'red', getValue: () => totals?.lifetimeWithdrawal || 0 },

      // M
      margin: { label: 'Margin', color: 'yellow', getValue: () => totals?.margin || 0 },
      marginFree: { label: 'Margin Free', color: 'lime', getValue: () => totals?.marginFree || 0 },
      marginInitial: { label: 'Margin Initial', color: 'sky', getValue: () => totals?.marginInitial || 0 },
      marginLevel: { label: 'Margin Level', color: 'pink', getValue: () => totals?.marginLevel || 0 },
      marginMaintenance: { label: 'Margin Maintenance', color: 'violet', getValue: () => totals?.marginMaintenance || 0 },

      // P
      pnl: { label: 'P&L', color: 'cyan', getValue: () => totals?.pnl || 0, colorCheck: true },
      previousEquity: { label: 'Previous Equity', color: 'slate', getValue: () => totals?.previousEquity || 0 },
      profit: { label: 'Profit', color: 'green', getValue: () => totals?.profit || 0, colorCheck: true },

      // S
      soEquity: { label: 'SO Equity', color: 'fuchsia', getValue: () => totals?.soEquity || 0 },
      soLevel: { label: 'SO Level', color: 'rose', getValue: () => totals?.soLevel || 0 },
      soMargin: { label: 'SO Margin', color: 'amber', getValue: () => totals?.soMargin || 0 },
      storage: { label: 'Storage', color: 'gray', getValue: () => totals?.storage || 0 },

      // T - This Month
      thisMonthBonusIn: { label: 'This Month Bonus In', color: 'teal', getValue: () => totals?.thisMonthBonusIn || 0 },
      thisMonthBonusOut: { label: 'This Month Bonus Out', color: 'red', getValue: () => totals?.thisMonthBonusOut || 0 },
      thisMonthCreditIn: { label: 'This Month Credit In', color: 'emerald', getValue: () => totals?.thisMonthCreditIn || 0 },
      thisMonthCreditOut: { label: 'This Month Credit Out', color: 'red', getValue: () => totals?.thisMonthCreditOut || 0 },
      thisMonthDeposit: { label: 'This Month Deposit', color: 'green', getValue: () => totals?.thisMonthDeposit || 0 },
      thisMonthPnL: { label: 'This Month P&L', color: 'blue', getValue: () => totals?.thisMonthPnL || 0, colorCheck: true },
      thisMonthSOCompensationIn: { label: 'This Month SO Compensation In', color: 'purple', getValue: () => totals?.thisMonthSOCompensationIn || 0 },
      thisMonthSOCompensationOut: { label: 'This Month SO Compensation Out', color: 'orange', getValue: () => totals?.thisMonthSOCompensationOut || 0 },
      thisMonthWithdrawal: { label: 'This Month Withdrawal', color: 'red', getValue: () => totals?.thisMonthWithdrawal || 0 },

      // T - This Week
      thisWeekBonusIn: { label: 'This Week Bonus In', color: 'teal', getValue: () => totals?.thisWeekBonusIn || 0 },
      thisWeekBonusOut: { label: 'This Week Bonus Out', color: 'red', getValue: () => totals?.thisWeekBonusOut || 0 },
      thisWeekCreditIn: { label: 'This Week Credit In', color: 'emerald', getValue: () => totals?.thisWeekCreditIn || 0 },
      thisWeekCreditOut: { label: 'This Week Credit Out', color: 'red', getValue: () => totals?.thisWeekCreditOut || 0 },
      thisWeekDeposit: { label: 'This Week Deposit', color: 'green', getValue: () => totals?.thisWeekDeposit || 0 },
      thisWeekPnL: { label: 'This Week P&L', color: 'indigo', getValue: () => totals?.thisWeekPnL || 0, colorCheck: true },
      thisWeekSOCompensationIn: { label: 'This Week SO Compensation In', color: 'purple', getValue: () => totals?.thisWeekSOCompensationIn || 0 },
      thisWeekSOCompensationOut: { label: 'This Week SO Compensation Out', color: 'orange', getValue: () => totals?.thisWeekSOCompensationOut || 0 },
      thisWeekWithdrawal: { label: 'This Week Withdrawal', color: 'red', getValue: () => totals?.thisWeekWithdrawal || 0 },

      // Rebate cards
      availableRebate: { label: 'Available Rebate', color: 'teal', getValue: () => rebateTotals?.availableRebate || 0 },
      availableRebatePercent: { label: 'Available Rebate %', color: 'cyan', getValue: () => rebateTotals?.availableRebatePercent || 0 },
      totalRebate: { label: 'Total Rebate', color: 'emerald', getValue: () => rebateTotals?.totalRebate || 0 },
      totalRebatePercent: { label: 'Total Rebate %', color: 'blue', getValue: () => rebateTotals?.totalRebatePercent || 0 },

      // Calculated PnL cards
      netLifetimePnL: { label: 'Net Lifetime PnL', color: 'violet', getValue: () => (totals?.lifetimePnL || 0) - (rebateTotals?.totalRebate || 0), colorCheck: true },
      netLifetimePnLPercent: { label: 'Net Lifetime PnL %', color: 'purple', getValue: () => (computedPercentageTotals?.lifetimePnL || 0) - (rebateTotals?.totalRebatePercent || 0), colorCheck: true },
      bookPnL: { label: 'Book PnL', color: 'sky', getValue: () => (totals?.lifetimePnL || 0) + (totals?.floating || 0), colorCheck: true },
      bookPnLPercent: { label: 'Book PnL %', color: 'indigo', getValue: () => (totalsPercent?.lifetimePnL || 0) + (totalsPercent?.floating || 0), colorCheck: true }
    }

    return configs[cardKey] || null
  }, [totalClients, rebateTotals, totals, totalsPercent, computedPercentageTotals])

  // Build export payload variants (reuses filter logic from fetchClients)
  const buildExportPayloadVariants = useCallback((percentageFlag = false) => {
    // Base payload mirrors current filters/search/sort
    const base = {
      page: 1,
      limit: 10000
    }
    if (searchQuery && searchQuery.trim()) base.search = searchQuery.trim()

    // Collect filters like in fetchClients
    const combinedFilters = []
    let multiOrField = null
    let multiOrValues = []
    let multiOrConflict = false
    const textFilteredFields = new Set()
    const numberFilteredFields = new Set()
    if (filters && filters.length > 0) {
      combinedFilters.push(...filters)
    }

    // Map UI column keys to API field names
    const columnKeyToAPIField = (colKey) => {
      const fieldMap = {
        lifetimePnL: 'lifetimePnL',
        thisMonthPnL: 'thisMonthPnL',
        thisWeekPnL: 'thisWeekPnL',
        dailyPnL: 'dailyPnL',
        marginLevel: 'marginLevel',
        marginFree: 'marginFree',
        lastAccess: 'lastAccess',
        zipCode: 'zipCode',
        middleName: 'middleName',
        lastName: 'lastName'
      }
      return fieldMap[colKey] || colKey
    }

    // Column header filters
    if (columnFilters && Object.keys(columnFilters).length > 0) {
      Object.entries(columnFilters).forEach(([key, cfg]) => {
        if (key.endsWith('_text') && cfg) {
          const uiKey = key.replace('_text', '')
          const field = columnKeyToAPIField(uiKey)
          const opMap = { equal: 'equal', notEqual: 'not_equal', contains: 'contains', doesNotContain: 'not_contains', startsWith: 'starts_with', endsWith: 'ends_with' }
          const op = opMap[cfg.operator] || cfg.operator
          const val = cfg.value
          if (val != null && String(val).length > 0) {
            combinedFilters.push({ field, operator: op, value: String(val).trim() })
            textFilteredFields.add(uiKey)
          }
          return
        }
        if (key.endsWith('_number') && cfg) {
          const uiKey = key.replace('_number', '')
          const field = columnKeyToAPIField(uiKey)
          const op = cfg.operator
          const v1 = cfg.value1
          const v2 = cfg.value2
          const num1 = v1 !== '' && v1 != null ? Number(v1) : null
          const num2 = v2 !== '' && v2 != null ? Number(v2) : null
          if (op === 'between') {
            if (num1 != null && Number.isFinite(num1)) combinedFilters.push({ field, operator: 'greater_than_equal', value: String(num1) })
            if (num2 != null && Number.isFinite(num2)) combinedFilters.push({ field, operator: 'less_than_equal', value: String(num2) })
          } else if (op && num1 != null && Number.isFinite(num1)) {
            combinedFilters.push({ field, operator: op, value: String(num1) })
          }
          numberFilteredFields.add(uiKey)
          return
        }
      })
      Object.entries(columnFilters).forEach(([key, cfg]) => {
        if (key.endsWith('_checkbox') && cfg && Array.isArray(cfg.values) && cfg.values.length > 0) {
          const uiKey = key.replace('_checkbox', '')
          const field = columnKeyToAPIField(uiKey)
          if (textFilteredFields.has(uiKey) || numberFilteredFields.has(uiKey)) return
          const rawValues = cfg.values.map(v => String(v).trim()).filter(v => v.length > 0)
          if (rawValues.length === 0) return
          if (rawValues.length === 1) {
            combinedFilters.push({ field, operator: 'equal', value: rawValues[0] })
          } else {
            if (multiOrField && multiOrField !== field) multiOrConflict = true
            else { multiOrField = field; multiOrValues = rawValues }
          }
        }
      })
    }
    if (combinedFilters.length > 0) base.filters = combinedFilters
    // Start building the mt5Accounts filter (server-side) for export
    let mt5AccountsFilter = []
    if (Array.isArray(mt5Accounts) && mt5Accounts.length > 0) {
      mt5AccountsFilter = [...new Set(mt5Accounts.map(Number))]
    }
    if (accountRangeMin && accountRangeMin.trim()) base.accountRangeMin = parseInt(accountRangeMin.trim())
    if (accountRangeMax && accountRangeMax.trim()) base.accountRangeMax = parseInt(accountRangeMax.trim())
    if (activeGroup) {
      if (activeGroup.range) {
        base.accountRangeMin = activeGroup.range.from
        base.accountRangeMax = activeGroup.range.to
      } else if (activeGroup.loginIds && activeGroup.loginIds.length > 0) {
        const groupAccounts = activeGroup.loginIds.map(id => Number(id))
        if (mt5AccountsFilter.length > 0) {
          const set = new Set(groupAccounts)
          mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a))
        } else {
          mt5AccountsFilter = [...new Set(groupAccounts)]
        }
      }
    }
    if (selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0) {
      const ibAccounts = ibMT5Accounts.map(Number)
      if (mt5AccountsFilter.length > 0) {
        const set = new Set(ibAccounts)
        mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a))
      } else {
        mt5AccountsFilter = [...new Set(ibAccounts)]
      }
    }
    if (mt5AccountsFilter.length > 0) base.mt5Accounts = mt5AccountsFilter
    if (sortBy) { base.sortBy = sortBy; base.sortOrder = sortOrder }

    // Build payload variants when needed (OR semantics)
    const buildVariants = (b) => {
      if (multiOrField && multiOrValues.length > 1 && !multiOrConflict) {
        return multiOrValues.map(val => {
          const f = Array.isArray(b.filters) ? [...b.filters] : []
          f.push({ field: multiOrField, operator: 'equal', value: val })
          const p = { ...b, filters: f }
          if (percentageFlag && percentModeActive) p.percentage = true
          return p
        })
      }
      const p = { ...b }
      if (percentageFlag && percentModeActive) p.percentage = true
      return [p]
    }
    return buildVariants(base)
  }, [searchQuery, filters, columnFilters, mt5Accounts, accountRangeMin, accountRangeMax, activeGroup, sortBy, sortOrder])

  // Fetch all pages for a single payload
  const fetchAllPagesForPayload = useCallback(async (payload) => {
    // First page
    const first = await brokerAPI.searchClients({ ...payload, page: 1 })
    const dataFirst = first?.data || first
    const pages = Number(dataFirst?.pages || 1)
    let list = dataFirst?.clients || []
    if (pages > 1) {
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => brokerAPI.searchClients({ ...payload, page: i + 2 }))
      )
      rest.forEach(resp => {
        const d = resp?.data || resp
        list = list.concat(d?.clients || [])
      })
    }
    return list
  }, [])

  // Gather full dataset for export matching current filters
  const gatherExportDataset = useCallback(async () => {
    try {
      console.log('[Client2Page] Building export payload variants...')
      const variants = buildExportPayloadVariants(false)
      console.log('[Client2Page] Payload variants:', variants.length, variants)

      // Fetch and merge unique by login
      const clientMap = new Map()
      for (let i = 0; i < variants.length; i++) {
        const p = variants[i]
        console.log(`[Client2Page] Fetching pages for variant ${i + 1}/${variants.length}...`)
        const rows = await fetchAllPagesForPayload(p)
        console.log(`[Client2Page] Got ${rows?.length || 0} rows for variant ${i + 1}`)
        // Guard: filter out null/undefined rows
        if (Array.isArray(rows)) {
          rows.filter(c => c != null).forEach(c => {
            if (c && c.login) clientMap.set(c.login, c)
          })
        }
      }
      let rows = Array.from(clientMap.values())
      console.log('[Client2Page] Merged unique clients:', rows.length)

      // IB filter is applied server-side via mt5Accounts in payload variants

      // Apply table sort if set
      if (sortBy) {
        const dir = sortOrder === 'asc' ? 1 : -1
        rows.sort((a, b) => {
          if (!a || !b) return 0 // Guard
          const av = a[sortBy], bv = b[sortBy]
          if (av == null && bv == null) return 0
          if (av == null) return 1
          if (bv == null) return -1
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
          const as = String(av).toLowerCase(), bs = String(bv).toLowerCase()
          if (as < bs) return -1 * dir
          if (as > bs) return 1 * dir
          return 0
        })
        console.log('[Client2Page] Sorted by', sortBy, sortOrder)
      }

      console.log('[Client2Page] Final export dataset:', rows.length, 'rows')
      return rows
    } catch (err) {
      console.error('[Client2Page] Export dataset error:', err)
      alert('Failed to gather export data: ' + (err.message || 'Unknown error'))
      return []
    }
  }, [buildExportPayloadVariants, fetchAllPagesForPayload, selectedIB, ibMT5Accounts, filterByActiveIB, sortBy, sortOrder])

  // Export to Excel handler (CSV for now)
  const handleExportToExcel = (type) => {
    (async () => {
      try {
        console.log('[Client2Page] Export started, type:', type)
        setShowExportMenu(false)

        console.log('[Client2Page] Gathering export dataset...')
        const allRows = await gatherExportDataset()
        console.log('[Client2Page] Export dataset gathered:', allRows?.length, 'rows')

        if (!allRows || allRows.length === 0) {
          alert('No data to export. Please check your filters and try again.')
          return
        }

        // For "all" export, only include columns that have data in the fetched rows
        let columns = type === 'all' ? allColumns : visibleColumnsList

        if (type === 'all' && allRows.length > 0) {
          // Check which columns actually have data in the first row (sample)
          const sampleRow = allRows[0]
          const columnsWithData = columns.filter(col => {
            // Keep column if it exists in the data (even if value is 0 or false)
            return sampleRow.hasOwnProperty(col.key)
          })
          console.log('[Client2Page] Filtered columns with data:', columnsWithData.length, 'out of', columns.length)
          columns = columnsWithData
        }

        console.log('[Client2Page] Exporting', columns.length, 'columns for', allRows.length, 'rows')

        const headers = columns.map(col => col.label).join(',')
        // Guard: filter out null/undefined clients before mapping
        const rows = (allRows || []).filter(client => client != null).map(client => {
          return columns.map(col => {
            let value = client[col.key]
            if (value === null || value === undefined || value === '') return ''
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
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        const suffix = type === 'all' ? 'all' : 'table'
        link.setAttribute('download', `client2_${suffix}_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        console.log('[Client2Page] Export completed successfully')
      } catch (err) {
        console.error('[Client2Page] Export error:', err)
        alert('Export failed: ' + (err.message || 'Please try again.'))
      }
    })()
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

    // Format epoch timestamps (userLastUpdate, accountLastUpdate)
    if (key === 'userLastUpdate' || key === 'accountLastUpdate') {
      if (!value) return '-'
      const timestamp = parseInt(value)
      if (isNaN(timestamp)) return '-'
      const date = new Date(timestamp)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
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
    <div className="min-h-screen flex overflow-x-hidden overflow-y-auto relative">
      {/* Clean White Background */}
      <div className="absolute inset-0 bg-white"></div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false)
          try { localStorage.setItem('sidebarOpen', JSON.stringify(false)) } catch { }
        }}
        onToggle={() => {
          setSidebarOpen(v => {
            const next = !v
            try { localStorage.setItem('sidebarOpen', JSON.stringify(next)) } catch { }
            return next
          })
        }}
      />

      <main className={`flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden relative z-10 transition-all duration-300 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}>
        <div className="max-w-full mx-auto h-full flex flex-col min-h-0" style={{ zoom: '90%' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-5 border-b-2 border-gradient-to-r from-blue-200 via-indigo-200 to-purple-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-slate-700 hover:text-slate-900 p-2.5 rounded-xl hover:bg-slate-100 border border-slate-300 transition-all shadow-sm hover:shadow"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent tracking-tight">Client 2</h1>
                <p className="text-xs text-slate-500 mt-0.5">Advanced client management & analytics</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter Button (Green/Emerald Theme) */}
              <div className="relative" ref={filterMenuRef}>
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="flex items-center gap-2 px-4 h-10 rounded-xl border-2 border-emerald-400 text-emerald-700 hover:bg-emerald-50 transition-all font-semibold text-sm shadow-sm hover:shadow-md hover:border-emerald-500"
                  title="Filter Options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="relative flex items-center">
                    Filter
                    {((quickFilters?.hasFloating ? 1 : 0) + (quickFilters?.hasCredit ? 1 : 0) + (quickFilters?.noDeposit ? 1 : 0)) > 0 && (
                      <span
                        className="ml-1.5 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold h-5 min-w-5 px-1.5 leading-none shadow-md ring-2 ring-white"
                        title="Active filters count"
                      >
                        {(quickFilters?.hasFloating ? 1 : 0) + (quickFilters?.hasCredit ? 1 : 0) + (quickFilters?.noDeposit ? 1 : 0)}
                      </span>
                    )}
                  </span>
                </button>

                {showFilterMenu && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border-2 border-emerald-400 z-50">
                    <div className="p-4">
                      <div className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        Quick Filters
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer hover:bg-emerald-50 p-3 rounded-lg transition-all border border-transparent hover:border-emerald-200 hover:shadow-sm">
                          <input
                            type="checkbox"
                            checked={quickFilters.hasFloating}
                            onChange={(e) => {
                              setQuickFilters(prev => ({
                                ...prev,
                                hasFloating: e.target.checked
                              }))
                              setCurrentPage(1)
                              // useEffect will handle fetching with updated filters
                            }}
                            className="w-5 h-5 text-emerald-600 border-slate-300 rounded-md focus:ring-emerald-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700">Has Floating</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer hover:bg-emerald-50 p-3 rounded-lg transition-all border border-transparent hover:border-emerald-200 hover:shadow-sm">
                          <input
                            type="checkbox"
                            checked={quickFilters.hasCredit}
                            onChange={(e) => {
                              setQuickFilters(prev => ({
                                ...prev,
                                hasCredit: e.target.checked
                              }))
                              setCurrentPage(1)
                              // useEffect will handle fetching with updated filters
                            }}
                            className="w-5 h-5 text-emerald-600 border-slate-300 rounded-md focus:ring-emerald-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700">Has Credit</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer hover:bg-emerald-50 p-3 rounded-lg transition-all border border-transparent hover:border-emerald-200 hover:shadow-sm">
                          <input
                            type="checkbox"
                            checked={quickFilters.noDeposit}
                            onChange={(e) => {
                              setQuickFilters(prev => ({
                                ...prev,
                                noDeposit: e.target.checked
                              }))
                              setCurrentPage(1)
                              // useEffect will handle fetching with updated filters
                            }}
                            className="w-5 h-5 text-emerald-600 border-slate-300 rounded-md focus:ring-emerald-500 focus:ring-2"
                          />
                          <span className="text-sm font-medium text-slate-700">No Deposit</span>
                        </label>
                      </div>


                    </div>
                  </div>
                )}
              </div>

              {/* Card Filter Button (Pink Theme) */}
              <div className="relative" ref={cardFilterMenuRef}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCardFilterMenu(!showCardFilterMenu)}
                    className="flex items-center gap-2 px-4 h-10 rounded-xl border-2 border-pink-400 text-pink-700 hover:bg-pink-50 transition-all font-semibold text-sm shadow-sm hover:shadow-md hover:border-pink-500"
                    title="Toggle Card Visibility"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    Card Filter
                  </button>

                  {/* Percentage Toggle - Now outside the menu */}
                  <div className="flex items-center gap-2 bg-white border-2 border-pink-400 rounded-xl px-3 h-10 shadow-sm">
                    <span className="text-xs font-medium text-pink-700">%</span>
                    <button
                      onClick={() => setCardFilterPercentMode(v => !v)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors p-0.5 ${cardFilterPercentMode ? 'bg-pink-600' : 'bg-gray-400'
                        }`}
                      title="Toggle percentage cards"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cardFilterPercentMode ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                    <span className="text-xs font-medium text-pink-700">Mode</span>
                  </div>
                </div>

                {showCardFilterMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border-2 border-pink-300 z-[200] max-h-96 overflow-y-auto" style={{
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
                              thisWeekWithdrawal: 'This Week Withdrawal',
                              availableRebate: 'Available Rebate',
                              availableRebatePercent: 'Available Rebate %',
                              totalRebate: 'Total Rebate',
                              totalRebatePercent: 'Total Rebate %',
                              netLifetimePnL: 'Net Lifetime PnL',
                              netLifetimePnLPercent: 'Net Lifetime PnL %',
                              bookPnL: 'Book PnL',
                              bookPnLPercent: 'Book PnL %'
                            }
                            const baseItems = Object.entries(baseLabels).map(([key, label]) => [key, label])
                            // In % Mode we still filter base cards only; percent variants are no longer selectable
                            const items = baseItems
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
                              assets: 'Assets', balance: 'Balance', blockedCommission: 'Blocked Commission', blockedProfit: 'Blocked Profit', commission: 'Commission', credit: 'Credit', dailyBonusIn: 'Daily Bonus In', dailyBonusOut: 'Daily Bonus Out', dailyCreditIn: 'Daily Credit In', dailyCreditOut: 'Daily Credit Out', dailyDeposit: 'Daily Deposit', dailyPnL: 'Daily P&L', dailySOCompensationIn: 'Daily SO Compensation In', dailySOCompensationOut: 'Daily SO Compensation Out', dailyWithdrawal: 'Daily Withdrawal', equity: 'Equity', floating: 'Floating', liabilities: 'Liabilities', lifetimeBonusIn: 'Lifetime Bonus In', lifetimeBonusOut: 'Lifetime Bonus Out', lifetimeCreditIn: 'Lifetime Credit In', lifetimeCreditOut: 'Lifetime Credit Out', lifetimeDeposit: 'Lifetime Deposit', lifetimePnL: 'Lifetime P&L', lifetimeSOCompensationIn: 'Lifetime SO Compensation In', lifetimeSOCompensationOut: 'Lifetime SO Compensation Out', lifetimeWithdrawal: 'Lifetime Withdrawal', margin: 'Margin', marginFree: 'Margin Free', marginInitial: 'Margin Initial', marginLevel: 'Margin Level', marginMaintenance: 'Margin Maintenance', soEquity: 'SO Equity', soLevel: 'SO Level', soMargin: 'SO Margin', pnl: 'P&L', previousEquity: 'Previous Equity', profit: 'Profit', storage: 'Storage', thisMonthBonusIn: 'This Month Bonus In', thisMonthBonusOut: 'This Month Bonus Out', thisMonthCreditIn: 'This Month Credit In', thisMonthCreditOut: 'This Month Credit Out', thisMonthDeposit: 'This Month Deposit', thisMonthPnL: 'This Month P&L', thisMonthSOCompensationIn: 'This Month SO Compensation In', thisMonthSOCompensationOut: 'This Month SO Compensation Out', thisMonthWithdrawal: 'This Month Withdrawal', thisWeekBonusIn: 'This Week Bonus In', thisWeekBonusOut: 'This Week Bonus Out', thisWeekCreditIn: 'This Week Credit In', thisWeekCreditOut: 'This Week Credit Out', thisWeekDeposit: 'This Week Deposit', thisWeekPnL: 'This Week P&L', thisWeekSOCompensationIn: 'This Week SO Compensation In', thisWeekSOCompensationOut: 'This Week SO Compensation Out', thisWeekWithdrawal: 'This Week Withdrawal', availableRebate: 'Available Rebate', totalRebate: 'Total Rebate', netLifetimePnL: 'Net Lifetime PnL', bookPnL: 'Book PnL'
                            }
                            const baseItems = Object.entries(baseLabels).map(([key, label]) => [key, label])
                            const items = baseItems
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
                            totalClients: 'Total Clients',
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
                            thisWeekWithdrawal: 'This Week Withdrawal',
                            availableRebate: 'Available Rebate',
                            totalRebate: 'Total Rebate',
                            netLifetimePnL: 'Net Lifetime PnL',
                            bookPnL: 'Book PnL'
                          }
                          // Build items based on toggle: only non-percent OR only percent
                          const baseItems = Object.entries(baseLabels).map(([key, label]) => [key, label])
                          // Always show base items only; % view uses these as the source of which cards are shown
                          return baseItems
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
                onClick={() => setShowFaceCards(v => !v)}
                className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-all shadow-sm text-sm font-semibold h-10 ${showFaceCards
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 text-blue-700 hover:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400'
                  }`}
                title={showFaceCards ? "Hide cards" : "Show cards"}
              >
                <span>Cards</span>
                <div className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${showFaceCards ? 'bg-blue-600' : 'bg-slate-400'
                  }`}>
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${showFaceCards ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                  />
                </div>
              </button>

              {/* Refresh Button */}
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`text-blue-600 hover:text-blue-700 p-2 rounded-xl border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50 bg-white transition-all shadow-sm h-10 w-10 flex items-center justify-center ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Refresh clients data"
              >
                <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Excel Export with Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="text-emerald-600 hover:text-emerald-700 p-2 rounded-xl border-2 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 bg-white transition-all shadow-sm h-10 w-10 flex items-center justify-center"
                  title="Download as Excel (CSV)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border-2 border-emerald-300 z-50 overflow-hidden">
                    <div className="py-1.5">
                      <button
                        onClick={() => handleExportToExcel('table')}
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Table View
                      </button>
                      <button
                        onClick={() => handleExportToExcel('all')}
                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="mb-3" ref={faceCardsRef}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-700">Summary Statistics {cardFilterPercentMode ? '(Percentage Mode)' : ''}</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetClient2FaceCardOrder}
                    className="px-2 py-1 text-[10px] font-semibold rounded border border-blue-300 text-blue-600 hover:bg-blue-50"
                    title="Reset face cards to default order"
                  >
                    Reset Order
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                {faceCardOrder.map((cardKey) => {
                  // Determine which card variant to show based on percentage mode
                  let displayCardKey = cardKey

                  // Switch to percentage variants when in percentage mode
                  if (cardFilterPercentMode) {
                    if (cardKey === 'availableRebate') displayCardKey = 'availableRebatePercent'
                    if (cardKey === 'totalRebate') displayCardKey = 'totalRebatePercent'
                    if (cardKey === 'netLifetimePnL') displayCardKey = 'netLifetimePnLPercent'
                    if (cardKey === 'bookPnL') displayCardKey = 'bookPnLPercent'
                  }

                  // Skip percentage variants in card order (they're accessed via switching above)
                  if (cardKey.endsWith('Percent')) return null

                  // Use totalsPercent when in percentage mode, otherwise use totals
                  const dataSource = cardFilterPercentMode ? totalsPercent : totals
                  const card = getClient2CardConfig(displayCardKey, dataSource)
                  if (!card || cardVisibility[cardKey] === false) return null

                  // Add % to label when in percentage mode (except for cards that already have it)
                  const displayLabel = cardFilterPercentMode && !card.label.includes('%')
                    ? `${card.label} %`
                    : card.label

                  // Use the card's getValue directly (already handles percentage calculations)
                  const rawValue = card.getValue()
                  // Clean, professional color scheme
                  let textColorClass = 'text-slate-700'
                  let labelColorClass = 'text-slate-500'
                  
                  if (card.colorCheck) {
                    if (rawValue >= 0) {
                      textColorClass = 'text-emerald-600'
                      labelColorClass = 'text-emerald-500'
                    } else {
                      textColorClass = 'text-rose-600'
                      labelColorClass = 'text-rose-500'
                    }
                  }
                  return (
                    <div
                      key={cardKey}
                      className={`bg-white rounded-xl shadow-sm border border-slate-200 p-3 hover:shadow-md transition-all duration-200 cursor-move hover:border-slate-300 hover:-translate-y-0.5`}
                      draggable
                      onDragStart={(e) => handleCardDragStart(e, cardKey)}
                      onDragOver={handleCardDragOver}
                      onDrop={(e) => handleCardDrop(e, cardKey)}
                      onDragEnd={handleCardDragEnd}
                      style={{ opacity: draggedCard === cardKey ? 0.5 : 1 }}
                    >
                      <div className={`text-[10px] font-semibold ${labelColorClass} mb-1.5 uppercase tracking-wide`}>
                        {displayLabel}
                      </div>
                      <div className={`text-base font-bold ${textColorClass} flex items-center gap-1`}>
                        {card.colorCheck && (
                          rawValue >= 0 ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )
                        )}
                        {card.format === 'integer'
                          ? formatIndianNumber(String(Math.round(rawValue || 0)))
                          : formatIndianNumber((rawValue || 0).toFixed(2))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1">
            {/* Pagination Controls - Top - Only show when there's data */}
            {clients && clients.length > 0 && (
            <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl shadow-sm border-2 border-slate-200 p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Show:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(e.target.value)}
                  className="px-2 py-1 text-xs font-semibold border-2 border-slate-300 rounded-lg bg-white text-slate-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 cursor-pointer transition-all shadow-sm"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                </select>
                <span className="text-xs font-semibold text-slate-600">entries</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Page Navigation */}
                <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`p-1.5 rounded-lg transition-all shadow-sm ${currentPage === 1
                          ? 'text-slate-300 bg-slate-100 cursor-not-allowed border-2 border-slate-200'
                          : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-white'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <span className="text-xs font-bold text-white px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-md">
                      Page {currentPage} of {totalPages}
                    </span>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`p-1.5 rounded-lg transition-all shadow-sm ${currentPage === totalPages
                          ? 'text-slate-300 bg-slate-100 cursor-not-allowed border-2 border-slate-200'
                          : 'text-blue-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-white'
                        }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                {/* Columns Selector Button */}
                <div className="relative" ref={columnSelectorRef}>
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="text-amber-700 hover:text-amber-800 px-2.5 py-1 rounded-lg hover:bg-amber-50 border-2 border-amber-300 hover:border-amber-500 transition-all inline-flex items-center gap-1.5 text-xs font-semibold bg-white shadow-sm"
                    title="Show/Hide Columns"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                    </svg>
                    Columns
                  </button>
                </div>

                {/* Search Bar */}
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search login, name, email..."
                      className="w-64 pl-3 pr-8 py-1 text-xs font-medium border-2 border-slate-300 rounded-lg bg-white text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all shadow-sm placeholder:text-slate-400"
                    />
                    {/* Inline Clear X Icon */}
                    {searchInput && (
                      <button
                        onClick={() => {
                          setSearchInput('')
                          setSearchQuery('')
                          setCurrentPage(1)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Clear search"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Search Button */}
                  <button
                    onClick={handleSearch}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm text-xs font-semibold"
                    title="Search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>
            )}

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

            {/* Table - Show table with progress bar for all loading states */}
            {(clients.length > 0 || (initialLoad && loading)) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col" ref={tableContainerRef} style={{ height: showFaceCards ? '470px' : '650px' }}>
                {/* Table Container with Vertical + Horizontal Scroll (single scroll context) */}
                <div className="overflow-auto relative table-scroll-container h-full" ref={hScrollRef} style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#9ca3af #e5e7eb',
                  position: 'relative'
                }}>
                  <style>{`
                  /* Table cell boundary enforcement */
                  table {
                    border-collapse: separate;
                    border-spacing: 0;
                  }
                  
                  table th, table td {
                    box-sizing: border-box;
                    position: relative;
                  }
                  
                  /* Ensure text doesn't overflow cell boundaries */
                  table td > *, table th > * {
                    max-width: 100%;
                  }
                  
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
                  
                  /* Horizontal scrollbar styling */
                  .overflow-x-auto::-webkit-scrollbar {
                    height: 12px;
                  }
                  .overflow-x-auto::-webkit-scrollbar-track {
                    background: #f3f4f6;
                    border-radius: 5px;
                  }
                  .overflow-x-auto::-webkit-scrollbar-thumb {
                    background: #9ca3af;
                    border-radius: 5px;
                    border: 2px solid #f3f4f6;
                  }
                  .overflow-x-auto::-webkit-scrollbar-thumb:hover {
                    background: #6b7280;
                  }
                  
                  /* Sticky horizontal scrollbar styling - always visible */
                  .overflow-x-scroll::-webkit-scrollbar {
                    height: 14px;
                  }
                  .overflow-x-scroll::-webkit-scrollbar-track {
                    background: #e5e7eb;
                    border-radius: 0;
                  }
                  .overflow-x-scroll::-webkit-scrollbar-thumb {
                    background: #6b7280;
                    border-radius: 4px;
                    border: 2px solid #e5e7eb;
                  }
                  .overflow-x-scroll::-webkit-scrollbar-thumb:hover {
                    background: #4b5563;
                  }
                  .overflow-x-scroll::-webkit-scrollbar-thumb:active {
                    background: #374151;
                  }
                  
                  /* Hide-scrollbar utility for non-sticky main horizontal scrollbar */
                  .hide-scrollbar {
                    -ms-overflow-style: none; /* IE and Edge */
                    scrollbar-width: none; /* Firefox */
                  }
                  .hide-scrollbar::-webkit-scrollbar {
                    display: none; /* Chrome, Safari, Opera */
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
                    background: #2563eb; /* tailwind blue-600 - matches table header */
                    border-radius: 2px;
                    animation: headerSlide 0.9s linear infinite;
                  }
                `}</style>

                  {/* Table */}
                  <table ref={tableRef} className="divide-y divide-gray-200" style={{
                    tableLayout: 'fixed',
                    width: `${totalTableWidth}px`,
                    minWidth: '100%'
                  }}>
                    <colgroup>
                      {visibleColumnsList.map(col => (
                        <col key={`col-${col.key}`} style={{ width: `${getDefaultColumnWidth(col)}px` }} />
                      ))}
                    </colgroup>
                    <thead className="bg-blue-600 sticky top-0 z-50" style={{ position: 'sticky', top: 0, zIndex: 50 }}>
                      <tr>
                        {visibleColumnsList.map(col => {
                          const filterCount = getActiveFilterCount(col.key)
                          const isDragging = draggedColumn === col.key
                          const isDragOver = dragOverColumn === col.key
                          const isResizing = resizingColumn === col.key
                          return (
                            <th
                              key={col.key}
                              ref={(el) => { if (!headerRefs.current) headerRefs.current = {}; headerRefs.current[col.key] = el }}
                              className={`px-2 py-3 text-left text-xs font-bold text-white uppercase tracking-wider bg-blue-600 hover:bg-blue-700 transition-all select-none relative cursor-pointer ${isDragging ? 'opacity-50' : ''
                                } ${isDragOver ? 'border-l-4 border-yellow-400' : ''} ${isResizing ? 'bg-blue-700 ring-2 ring-yellow-400' : ''}`}
                              onClick={() => handleSort(col.key)}
                              onDragOver={(e) => handleColumnDragOver(e, col.key)}
                              onDragLeave={handleColumnDragLeave}
                              onDrop={(e) => handleColumnDrop(e, col.key)}
                              style={{
                                minWidth: '80px',
                                overflow: 'hidden',
                                backgroundColor: '#2563eb',
                                position: 'sticky',
                                top: 0
                              }}
                            >
                              <div className="flex items-center gap-2 justify-between min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Drag Handle Area - larger clickable area on left side */}
                                  <div
                                    className="flex items-center gap-2 cursor-move hover:opacity-80 py-1 -ml-2 pl-2 pr-1"
                                    draggable={!resizingColumn}
                                    onDragStart={(e) => {
                                      e.stopPropagation()
                                      handleColumnDragStart(e, col.key)
                                    }}
                                    onDragEnd={handleColumnDragEnd}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Drag to reorder column"
                                  >
                                    <svg
                                      className="w-3 h-3 text-white/60 flex-shrink-0"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
                                    </svg>
                                  </div>
                                  <span
                                    className="truncate"
                                    title={col.label}
                                  >
                                    {col.label}
                                  </span>
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

                                        // Fetch column values for ALL columns (including login) - always refresh to ensure fresh data
                                        const columnType = getColumnType(col.key)
                                        // Always fetch values for checkbox filtering with forceRefresh=true to avoid "No values available"
                                        fetchColumnValues(col.key, true)
                                        // Initialize selectedColumnValues: if there's an active checkbox filter, restore it; otherwise start empty
                                        const existingCheckboxFilter = columnFilters[`${col.key}_checkbox`]
                                        const initialSelection = existingCheckboxFilter?.values || []
                                        setSelectedColumnValues(prev => ({ ...prev, [col.key]: initialSelection }))
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
                                    const isNumeric = columnType === 'float' || columnType === 'integer'
                                    const isInteger = columnType === 'integer'

                                    // Initialize temp state for numeric filter if needed
                                    if (isNumeric && !numericFilterTemp[columnKey]) {
                                      initNumericFilterTemp(columnKey)
                                    }
                                    const tempFilter = numericFilterTemp[columnKey] || { operator: 'equal', value1: '', value2: '' }

                                    return createPortal(
                                      <div
                                        ref={filterPanelRef}
                                        tabIndex={0}
                                        className="fixed bg-white border-2 border-slate-300 rounded-lg shadow-2xl flex flex-col text-[11px]"
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onWheel={(e) => e.stopPropagation()}
                                        onScroll={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault()
                                            if (isNumeric) {
                                              applyNumberFilter(columnKey)
                                            } else {
                                              applyCheckboxFilter(columnKey)
                                            }
                                            setShowFilterDropdown(null)
                                          }
                                        }}
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
                                                          onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                              e.preventDefault()
                                                              applyNumberFilter(columnKey)
                                                              const menu = document.getElementById(`number-filter-menu-${columnKey}`)
                                                              if (menu) menu.classList.add('hidden')
                                                            }
                                                          }}
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
                                                            onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                e.preventDefault()
                                                                applyNumberFilter(columnKey)
                                                                const menu = document.getElementById(`number-filter-menu-${columnKey}`)
                                                                if (menu) menu.classList.add('hidden')
                                                              }
                                                            }}
                                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                          />
                                                        </div>
                                                      )}

                                                      {/* Apply Button */}
                                                      <div className="flex gap-2 pt-2 border-t border-gray-200">
                                                        <button
                                                          onClick={() => {
                                                            applyNumberFilter(columnKey)
                                                            const menu = document.getElementById(`number-filter-menu-${columnKey}`)
                                                            if (menu) menu.classList.add('hidden')
                                                          }}
                                                          className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                                        >
                                                          OK
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              {/* Checkbox Value List - Also for numeric columns */}
                                              <div className="flex-1 overflow-hidden flex flex-col">
                                                {/* Search Bar */}
                                                <div className="px-3 py-2 border-b border-gray-200">
                                                  <input
                                                    type="text"
                                                    placeholder="Search values..."
                                                    value={columnValueSearch[columnKey] || ''}
                                                    onChange={(e) => setColumnValueSearch(prev => ({ ...prev, [columnKey]: e.target.value }))}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                  />
                                                </div>

                                                {/* Select Visible Checkbox */}
                                                {columnValuesUnsupported[columnKey] ? null : (
                                                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                    {(() => {
                                                      const allVals = columnValues[columnKey] || []
                                                      const searchQ = (columnValueSearch[columnKey] || '').toLowerCase()
                                                      const visibleVals = searchQ ? allVals.filter(v => String(v).toLowerCase().includes(searchQ)) : allVals
                                                      const selected = selectedColumnValues[columnKey] || []
                                                      const allVisibleSelected = visibleVals.length > 0 && visibleVals.every(v => selected.includes(v))
                                                      const hasActiveSearch = columnValueSearch[columnKey] && columnValueSearch[columnKey].trim().length > 0
                                                      return (
                                                        <>
                                                          <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                              type="checkbox"
                                                              checked={allVisibleSelected}
                                                              onChange={() => toggleSelectVisibleColumnValues(columnKey)}
                                                              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span className="text-xs font-bold text-gray-700">Select visible ({visibleVals.length})</span>
                                                          </label>
                                                        </>
                                                      )
                                                    })()}
                                                  </div>
                                                )}

                                                {/* Values List - Lazy loading with scroll detection */}
                                                <div
                                                  className="flex-1 overflow-y-auto px-3 py-2"
                                                  onWheel={() => { columnScrollUserActionRef.current[columnKey] = true }}
                                                  onTouchMove={() => { columnScrollUserActionRef.current[columnKey] = true }}
                                                  onMouseDown={() => { columnScrollUserActionRef.current[columnKey] = true }}
                                                  onScroll={(e) => {
                                                    const target = e.currentTarget
                                                    const scrollTop = target.scrollTop
                                                    const scrollHeight = target.scrollHeight
                                                    const clientHeight = target.clientHeight
                                                    const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100

                                                    console.log(`[Client2] Scroll event - ${columnKey}: ${scrollPercentage.toFixed(1)}%, hasMore: ${columnValuesHasMore[columnKey]}, loading: ${columnValuesLoadingMore[columnKey]}`)

                                                    // Load more when scrolled to bottom
                                                    if (scrollTop + clientHeight >= scrollHeight - 5) {
                                                      console.log(`[Client2] Reached bottom for ${columnKey}`)
                                                      const userScrolled = !!columnScrollUserActionRef.current[columnKey]
                                                      const lastTop = columnScrollLastTriggerRef.current[columnKey] ?? -Infinity
                                                      if (!userScrolled) {
                                                        console.log(`[Client2] Ignoring: no manual scroll detected`)
                                                        return
                                                      }
                                                      if (scrollTop <= lastTop) {
                                                        console.log(`[Client2] Waiting for scroll beyond last trigger`)
                                                        return
                                                      }
                                                      if (!columnValuesLoadingMore[columnKey] && columnValuesHasMore[columnKey]) {
                                                        console.log(`[Client2] Triggering fetchMore for ${columnKey}`)
                                                        fetchMoreColumnValues(columnKey)
                                                        columnScrollUserActionRef.current[columnKey] = false
                                                        columnScrollLastTriggerRef.current[columnKey] = scrollTop
                                                      } else {
                                                        console.log(`[Client2] NOT triggering - loadingMore: ${columnValuesLoadingMore[columnKey]}, hasMore: ${columnValuesHasMore[columnKey]}`)
                                                      }
                                                    }
                                                  }}
                                                >
                                                  {columnValuesLoading[columnKey] ? (
                                                    <div className="py-8 text-center">
                                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                      <p className="text-xs text-gray-500 mt-2">Loading values...</p>
                                                    </div>
                                                  ) : (() => {
                                                    const allVals = columnValues[columnKey] || []
                                                    const selected = selectedColumnValues[columnKey] || []
                                                    const searchQ = (columnValueSearch[columnKey] || '').toLowerCase()
                                                    // Values are already filtered server-side
                                                    const filteredVals = allVals

                                                    return (
                                                      <>
                                                        {filteredVals.length > 0 ? (
                                                          <div className="space-y-1">
                                                            {filteredVals.map((value) => (
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
                                                            {/* Loading more indicator */}
                                                            {columnValuesLoadingMore[columnKey] && (
                                                              <div className="py-4 text-center">
                                                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                                <p className="text-xs text-gray-500 mt-1">Loading more...</p>
                                                              </div>
                                                            )}
                                                            {/* No more values indicator */}
                                                            {!columnValuesHasMore[columnKey] && allVals.length > 0 && (
                                                              <div className="py-2 text-xs text-gray-400 text-center italic">
                                                                All values loaded
                                                              </div>
                                                            )}
                                                          </div>
                                                        ) : (
                                                          <div className="py-8 text-xs text-gray-500 text-center">
                                                            {searchQ ? 'No matching values found' : 'No values available'}
                                                          </div>
                                                        )}
                                                      </>
                                                    )
                                                  })()}
                                                </div>
                                              </div>

                                              {/* OK/Close Buttons */}
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
                                                  onClick={() => setShowFilterDropdown(null)}
                                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                                >
                                                  Close
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
                                          const loadingMore = columnValuesLoadingMore[columnKey]
                                          const hasMore = columnValuesHasMore[columnKey]
                                          const selected = selectedColumnValues[columnKey] || []
                                          const searchQuery = columnValueSearch[columnKey] || ''

                                          // Values are already filtered server-side based on search
                                          const filteredValues = allValues

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
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        applyTextFilter(columnKey)
                                                        const menu = document.getElementById(`text-filter-menu-${columnKey}`)
                                                        if (menu) menu.classList.add('hidden')
                                                        setShowFilterDropdown(null)
                                                      }
                                                    }}
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
                                                                onKeyDown={(e) => {
                                                                  if (e.key === 'Enter') {
                                                                    e.preventDefault()
                                                                    applyTextFilter(columnKey)
                                                                    const menu = document.getElementById(`text-filter-menu-${columnKey}`)
                                                                    if (menu) menu.classList.add('hidden')
                                                                    setShowFilterDropdown(null)
                                                                  }
                                                                }}
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
                                                                onKeyDown={(e) => {
                                                                  if (e.key === 'Enter') {
                                                                    e.preventDefault()
                                                                    applyTextFilter(columnKey)
                                                                    const menu = document.getElementById(`text-filter-menu-${columnKey}`)
                                                                    if (menu) menu.classList.add('hidden')
                                                                    setShowFilterDropdown(null)
                                                                  }
                                                                }}
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
                                                                  setShowFilterDropdown(null)
                                                                }}
                                                                className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700"
                                                              >
                                                                OK
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
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        applyCheckboxFilter(columnKey)
                                                        setShowFilterDropdown(null)
                                                      }
                                                    }}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500 text-gray-900"
                                                  />
                                                </div>

                                                {/* Select Visible Checkbox */}
                                                {columnValuesUnsupported[columnKey] ? null : (
                                                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                    {(() => {
                                                      const searchQ = (columnValueSearch[columnKey] || '').toLowerCase()
                                                      const visibleVals = searchQ ? allValues.filter(v => String(v).toLowerCase().includes(searchQ)) : allValues
                                                      const allVisibleSelected = visibleVals.length > 0 && visibleVals.every(v => selected.includes(v))
                                                      const hasActiveSearch = searchQuery && searchQuery.trim().length > 0
                                                      return (
                                                        <>
                                                          <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                              type="checkbox"
                                                              checked={allVisibleSelected}
                                                              onChange={() => toggleSelectVisibleColumnValues(columnKey)}
                                                              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span className="text-xs font-bold text-gray-700">Select visible ({visibleVals.length})</span>
                                                          </label>
                                                        </>
                                                      )
                                                    })()}
                                                  </div>
                                                )}

                                                {/* Values List - Lazy loading with scroll detection */}
                                                <div
                                                  className="flex-1 overflow-y-auto px-3 py-2"
                                                  onWheel={() => { columnScrollUserActionRef.current[columnKey] = true }}
                                                  onTouchMove={() => { columnScrollUserActionRef.current[columnKey] = true }}
                                                  onMouseDown={() => { columnScrollUserActionRef.current[columnKey] = true }}
                                                  onScroll={(e) => {
                                                    const target = e.currentTarget
                                                    const scrollTop = target.scrollTop
                                                    const scrollHeight = target.scrollHeight
                                                    const clientHeight = target.clientHeight
                                                    const scrollPercentage = ((scrollTop + clientHeight) / scrollHeight) * 100

                                                    console.log(`[Client2] Scroll event - ${columnKey}: ${scrollPercentage.toFixed(1)}%, hasMore: ${columnValuesHasMore[columnKey]}, loading: ${columnValuesLoadingMore[columnKey]}`)

                                                    // Load more when scrolled to bottom
                                                    if (scrollTop + clientHeight >= scrollHeight - 5) {
                                                      console.log(`[Client2] Reached bottom for ${columnKey}`)
                                                      const userScrolled = !!columnScrollUserActionRef.current[columnKey]
                                                      const lastTop = columnScrollLastTriggerRef.current[columnKey] ?? -Infinity
                                                      if (!userScrolled) {
                                                        console.log(`[Client2] Ignoring: no manual scroll detected`)
                                                        return
                                                      }
                                                      if (scrollTop <= lastTop) {
                                                        console.log(`[Client2] Waiting for scroll beyond last trigger`)
                                                        return
                                                      }
                                                      if (!columnValuesLoadingMore[columnKey] && columnValuesHasMore[columnKey]) {
                                                        console.log(`[Client2] Triggering fetchMore for ${columnKey}`)
                                                        fetchMoreColumnValues(columnKey)
                                                        columnScrollUserActionRef.current[columnKey] = false
                                                        columnScrollLastTriggerRef.current[columnKey] = scrollTop
                                                      } else {
                                                        console.log(`[Client2] NOT triggering - loadingMore: ${columnValuesLoadingMore[columnKey]}, hasMore: ${columnValuesHasMore[columnKey]}`)
                                                      }
                                                    }
                                                  }}
                                                >
                                                  {loading ? (
                                                    <div className="py-8 text-center">
                                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                      <p className="text-xs text-gray-500 mt-2">Loading values...</p>
                                                    </div>
                                                  ) : (
                                                    <>
                                                      {filteredValues.length > 0 ? (
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
                                                          {/* Loading more indicator */}
                                                          {columnValuesLoadingMore[columnKey] && (
                                                            <div className="py-4 text-center">
                                                              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                              <p className="text-xs text-gray-500 mt-1">Loading more...</p>
                                                            </div>
                                                          )}
                                                          {/* No more values indicator */}
                                                          {!columnValuesHasMore[columnKey] && allValues.length > 0 && (
                                                            <div className="py-2 text-xs text-gray-400 text-center italic">
                                                              All values loaded
                                                            </div>
                                                          )}
                                                        </div>
                                                      ) : (
                                                        <div className="py-8 text-xs text-gray-500 text-center">
                                                          {searchQuery ? 'No matching values found' : 'No values available'}
                                                        </div>
                                                      )}
                                                    </>
                                                  )}
                                                </div>
                                              </div>

                                              {/* OK/Close Buttons */}
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
                                                  onClick={() => setShowFilterDropdown(null)}
                                                  className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                                >
                                                  Close
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
                                className="absolute top-0 right-0 h-full w-4 cursor-col-resize select-none z-30 hover:bg-blue-400/40 active:bg-blue-600/60 transition-colors"
                                style={{
                                  userSelect: 'none',
                                  touchAction: 'none',
                                  pointerEvents: 'auto',
                                  marginRight: '-2px'
                                }}
                                title="Drag to resize • Double-click to auto-fit"
                                draggable={false}
                              >
                                <div className="absolute right-[2px] top-0 w-[3px] h-full bg-white/40 hover:bg-blue-400 active:bg-blue-600 transition-colors shadow-sm"></div>
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>

                    {/* YouTube-style Loading Progress Bar - Below table header */}
                    {(loading || isRefreshing) && (
                      <thead className="sticky z-40" style={{ top: '48px' }}>
                        <tr>
                          <th colSpan={visibleColumnsList.length} className="p-0" style={{ height: '3px' }}>
                            <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                              <style>{`
                                @keyframes headerSlide {
                                  0% { transform: translateX(-100%); }
                                  100% { transform: translateX(400%); }
                                }
                                .header-loading-bar {
                                  width: 30%;
                                  height: 100%;
                                  background: #2563eb;
                                  animation: headerSlide 0.9s linear infinite;
                                }
                              `}</style>
                              <div className="header-loading-bar absolute top-0 left-0 h-full" />
                            </div>
                          </th>
                        </tr>
                      </thead>
                    )}

                    <tbody className="bg-white divide-y divide-gray-200" key={`tbody-${animationKey}`}>
                      {/* Always show actual data rows with staggered fade-in */}
                      {/* Guard: filter out null/undefined clients */}
                      {(sortedClients || []).filter(client => client != null && client.login != null).map((client, idx) => (
                        <tr
                          key={`${client.login}-${animationKey}-${idx}`}
                          className="hover:bg-blue-50 transition-colors"
                          style={{
                            opacity: 0,
                            animation: `fadeIn 0.2s ease-out forwards ${idx * 20}ms`
                          }}
                        >
                          {visibleColumnsList.map(col => {
                            const cellValue = formatValue(col.key, client?.[col.key])
                            const rawValue = client?.[col.key]

                            // Special handling for login column - make it blue
                            if (col.key === 'login') {
                              return (
                                <td
                                  key={col.key}
                                  className="px-4 py-3 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer hover:underline transition-all"
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleViewClientDetails(client)
                                  }}
                                  title={`${cellValue} - Click to view details`}
                                >
                                  {cellValue}
                                </td>
                              )
                            }

                            // Regular columns
                            return (
                              <td
                                key={col.key}
                                className={`px-4 py-3 text-sm ${getValueColorClass(col.key, rawValue) || 'text-gray-900'}`}
                                data-col={col.key}
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                                title={cellValue}
                              >
                                {cellValue}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Removed duplicate sticky horizontal scrollbar to keep a single native scrollbar */}
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
          // Use fetchClients for consistency with ClientsPage so modal-triggered updates refresh server-side dataset
          onClientUpdate={fetchClients}
          allPositionsCache={cachedPositions}
          onCacheUpdate={() => { /* Positions managed by DataContext; no local update needed */ }}
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





