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
    try { localStorage.setItem('client2ColumnValuesBatchSize', String(columnValuesBatchSize)) } catch {}
  }, [columnValuesBatchSize])
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
  const [selectedColumnValues, setSelectedColumnValues] = useState({}) // Track selected values for checkbox filters
  const [columnValueSearch, setColumnValueSearch] = useState({}) // Search query for column value filters
  const [quickFilters, setQuickFilters] = useState({
    hasFloating: false,
    hasCredit: false,
    noDeposit: false
  })
  const [draggedCard, setDraggedCard] = useState(null) // For face card drag and drop
  
  // Define default face card order for Client2 (matching all available cards in the actual rendering)
  const defaultClient2FaceCardOrder = [
    'totalClients', 'assets', 'balance', 'blockedCommission', 'blockedProfit', 'commission', 'credit',
    'dailyBonusIn', 'dailyBonusOut', 'dailyCreditIn', 'dailyCreditOut', 'dailyDeposit', 'dailyPnL',
    'dailySOCompensationIn', 'dailySOCompensationOut', 'dailyWithdrawal',
    'equity', 'floating', 'liabilities',
    'lifetimeBonusIn', 'lifetimeBonusOut', 'lifetimeCreditIn', 'lifetimeCreditOut', 'lifetimeDeposit', 'lifetimePnL',
    'lifetimeSOCompensationIn', 'lifetimeSOCompensationOut', 'lifetimeWithdrawal',
    'margin', 'marginFree', 'marginInitial', 'marginLevel', 'marginMaintenance',
    'soEquity', 'soLevel', 'soMargin', 'pnl', 'previousEquity', 'profit', 'storage',
    'thisMonthBonusIn', 'thisMonthBonusOut', 'thisMonthCreditIn', 'thisMonthCreditOut', 'thisMonthDeposit', 'thisMonthPnL',
    'thisMonthSOCompensationIn', 'thisMonthSOCompensationOut', 'thisMonthWithdrawal',
    'thisWeekBonusIn', 'thisWeekBonusOut', 'thisWeekCreditIn', 'thisWeekCreditOut', 'thisWeekDeposit', 'thisWeekPnL',
    'thisWeekSOCompensationIn', 'thisWeekSOCompensationOut', 'thisWeekWithdrawal'
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
  const tableContainerRef = useRef(null)
  const [resizingColumn, setResizingColumn] = useState(null)
  const [tableHeight, setTableHeight] = useState('calc(100vh - 280px)')

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
      thisWeekWithdrawalPercent: false
    }
  }
  
  const [cardVisibility, setCardVisibility] = useState(getInitialCardVisibility)
  // Global percentage view disabled; use per-field % cards instead
  const showPercentage = false

  // If % mode toggle is ON or any % face card is enabled, send percentage=true in the request
  const percentModeActive = useMemo(() => {
    const anyPercentCard = Object.entries(cardVisibility || {}).some(([key, value]) => key.endsWith('Percent') && value !== false)
    return cardFilterPercentMode || anyPercentCard
  }, [cardFilterPercentMode, cardVisibility])
  
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
  
  // Calculate dynamic table height based on available space
  useEffect(() => {
    const calculateHeight = () => {
      if (tableContainerRef.current) {
        const rect = tableContainerRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const availableHeight = viewportHeight - rect.top - 20 // 20px padding at bottom
        setTableHeight(`${Math.max(400, availableHeight)}px`)
      }
    }

    calculateHeight()
    window.addEventListener('resize', calculateHeight)
    
    // Recalculate when face cards visibility changes
    const timeout = setTimeout(calculateHeight, 100)
    
    return () => {
      window.removeEventListener('resize', calculateHeight)
      clearTimeout(timeout)
    }
  }, [showFaceCards, filters.length])
  
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
    { key: 'dailyPnL_percentage', label: 'Daily PnL %', type: 'float' },
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
  
  // Fetch clients data
  const fetchClients = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true)
      }
      setError('')
      
      // Build request payload - always include page/limit as per API contract
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
  // Track a single field that has multiple checkbox values selected (to emulate OR semantics)
  let multiOrField = null
  let multiOrValues = []
  let multiOrConflict = false
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

      // Map column header filters to API filters
      // Checkbox values: if multiple selected for one field, we'll OR them via multiple requests
      if (columnFilters && Object.keys(columnFilters).length > 0) {
        Object.entries(columnFilters).forEach(([key, cfg]) => {
          // Text filters first (record fields)
          if (key.endsWith('_text') && cfg) {
            const uiKey = key.replace('_text', '')
            const field = columnKeyToAPIField(uiKey)
            const opMap = {
              equal: 'equal',
              notEqual: 'not_equal',
              contains: 'contains',
              doesNotContain: 'not_contains',
              startsWith: 'starts_with',
              endsWith: 'ends_with'
            }
            const op = opMap[cfg.operator] || cfg.operator
            const val = cfg.value
            if (val != null && String(val).length > 0) {
              combinedFilters.push({ field, operator: op, value: String(val).trim() })
              textFilteredFields.add(uiKey)
            }
            return
          }
          // Numeric filters (record fields)
          if (key.endsWith('_number') && cfg) {
            const uiKey = key.replace('_number', '')
            const field = columnKeyToAPIField(uiKey)
            const op = cfg.operator
            const v1 = cfg.value1
            const v2 = cfg.value2
            const num1 = v1 !== '' && v1 != null ? Number(v1) : null
            const num2 = v2 !== '' && v2 != null ? Number(v2) : null
            if (op === 'between') {
              if (num1 != null && Number.isFinite(num1)) {
                combinedFilters.push({ field, operator: 'greater_than_equal', value: String(num1) })
              }
              if (num2 != null && Number.isFinite(num2)) {
                combinedFilters.push({ field, operator: 'less_than_equal', value: String(num2) })
              }
            } else if (op && num1 != null && Number.isFinite(num1)) {
              combinedFilters.push({ field, operator: op, value: String(num1) })
            }
            numberFilteredFields.add(uiKey)
            return
          }
        })
        // Second pass for checkbox values; skip if field already has text/number filter
        Object.entries(columnFilters).forEach(([key, cfg]) => {
          if (key.endsWith('_checkbox') && cfg && Array.isArray(cfg.values) && cfg.values.length > 0) {
            const uiKey = key.replace('_checkbox', '')
            const field = columnKeyToAPIField(uiKey)
            if (textFilteredFields.has(uiKey) || numberFilteredFields.has(uiKey)) {
              return // Don't combine checkbox with text/number for same field
            }
            if (cfg.values.length === 1) {
              // Single selection → simple equality filter
              combinedFilters.push({ field, operator: 'equal', value: cfg.values[0] })
            } else {
              // Multiple selections for this field
              if (multiOrField && multiOrField !== field) {
                multiOrConflict = true // More than one field needs OR; we'll fallback to AND behavior
              } else {
                multiOrField = field
                multiOrValues = cfg.values
              }
            }
          }
        })
      }

      if (combinedFilters.length > 0) {
        payload.filters = combinedFilters
      }
      
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
          console.log('[Client2] Applying range group filter:', activeGroup.range)
        } else if (activeGroup.loginIds && activeGroup.loginIds.length > 0) {
          // Manual selection group: merge/intersect with any existing list
          const groupAccounts = activeGroup.loginIds.map(id => Number(id))
          if (mt5AccountsFilter.length > 0) {
            const set = new Set(groupAccounts)
            mt5AccountsFilter = mt5AccountsFilter.filter(a => set.has(a)) // intersection
          } else {
            mt5AccountsFilter = [...new Set(groupAccounts)]
          }
          console.log('[Client2] Applying manual group filter:', groupAccounts.length, 'accounts')
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

      // Assign final mt5Accounts if any
      if (mt5AccountsFilter.length > 0) {
        payload.mt5Accounts = mt5AccountsFilter
      }
      
      // Add sorting if present
      if (sortBy) {
        payload.sortBy = sortBy
        payload.sortOrder = sortOrder
      }

      // Determine whether any normal and/or percent face cards are enabled
      const anyNormal = Object.entries(cardVisibility || {}).some(([key, value]) => !key.endsWith('Percent') && value !== false)
      const anyPercent = percentModeActive

      // Helper: build payload variants to emulate OR within a single field (if applicable)
      const buildPayloadVariants = (base, percentageFlag) => {
        if (multiOrField && multiOrValues.length > 1 && !multiOrConflict) {
          // Create a variant per value by appending an equality filter for this value
          return multiOrValues.map((val) => {
            const f = Array.isArray(base.filters) ? [...base.filters] : []
            f.push({ field: multiOrField, operator: 'equal', value: val })
            const p = { ...base, filters: f }
            if (percentageFlag) p.percentage = true
            return p
          })
        }
        const p = { ...base }
        if (percentageFlag) p.percentage = true
        return [p]
      }

      const payloadNormalVariants = buildPayloadVariants(payload, false)
      const payloadPercentVariants = buildPayloadVariants(payload, true)

      // Fetch based on selection: both → fetch both; otherwise fetch one
      if (anyNormal && anyPercent) {
        // Normal variants
  // Debug: log outgoing payload(s)
  try { console.debug('[Client2] search payload (normal):', payloadNormalVariants) } catch {}
  const normalResponses = await Promise.all(payloadNormalVariants.map(p => brokerAPI.searchClients(p)))
        // Merge clients (union by login) and sum totals
        const clientMap = new Map()
        let mergedTotals = {}
        let mergedTotalCount = 0
        let pages = 1
        normalResponses.forEach((resp) => {
          const data = resp?.data || resp
          const list = data?.clients || []
          // SAFETY: Filter out null/undefined clients before adding to map
          list.filter(c => c != null && c.login != null).forEach(c => { 
            if (!clientMap.has(c.login)) clientMap.set(c.login, c) 
          })
          const t = data?.totals || {}
          Object.entries(t).forEach(([k, v]) => {
            if (typeof v === 'number') mergedTotals[k] = (mergedTotals[k] || 0) + v
          })
          mergedTotalCount += Number(data?.total || list.length || 0)
          pages = Math.max(pages, Number(data?.pages || 1))
        })
  const unionClients = Array.from(clientMap.values())
  // Server-side total count across variants (sums per-variant totals; safe because OR is for a single scalar field)
  const serverTotal = mergedTotalCount || 0
  // Slice for current page
  const total = unionClients.length
        const start = (currentPage - 1) * (itemsPerPage || 50)
        const end = start + (itemsPerPage || 50)
        // SAFETY: Final filter before setting state
        const safeClients = unionClients.slice(start, end).filter(c => c != null && c.login != null)
        if (safeClients.length < unionClients.slice(start, end).length) {
          console.warn('[Client2Page] Filtered out invalid clients from API response')
        }
  setClients(safeClients)
  // Prefer server-reported total when available; fallback to union length
  const effectiveTotal = serverTotal > 0 ? serverTotal : total
  setTotalClients(effectiveTotal)
  setTotalPages(Math.max(1, Math.ceil(effectiveTotal / (itemsPerPage || 50))))
        setTotals(mergedTotals)
        setError('')

        // Percent variants (sum totals only)
  try { console.debug('[Client2] search payload (percent):', payloadPercentVariants) } catch {}
  const percentResponses = await Promise.all(payloadPercentVariants.map(p => brokerAPI.searchClients(p)))
        let mergedPercentTotals = {}
        let percentTotalCount = 0
        percentResponses.forEach((resp) => {
          const t = (resp?.data || resp)?.totals || {}
          Object.entries(t).forEach(([k, v]) => {
            if (typeof v === 'number') mergedPercentTotals[k] = (mergedPercentTotals[k] || 0) + v
          })
          const d = resp?.data || resp
          percentTotalCount += Number(d?.total || d?.clients?.length || 0)
        })
        setTotalsPercent(mergedPercentTotals)
        // Prefer server-reported total across variants
        if (percentTotalCount > 0) {
          setTotalClients(percentTotalCount)
          setTotalPages(Math.max(1, Math.ceil(percentTotalCount / (itemsPerPage || 50))))
        }
      } else if (anyPercent) {
        // Percent only
  try { console.debug('[Client2] search payload (percent only):', payloadPercentVariants) } catch {}
  const percentResponses = await Promise.all(payloadPercentVariants.map(p => brokerAPI.searchClients(p)))
        // Use first response's clients for table (percent mode only shows percent dataset)
        const first = percentResponses[0]
        const data = first?.data || first
        // SAFETY: Filter out null/undefined clients before setting state
        const rawClients = data?.clients || []
        const safeClients = rawClients.filter(c => c != null && c.login != null)
        if (safeClients.length < rawClients.length) {
          console.warn('[Client2Page] Filtered out invalid clients from percent-only API response')
        }
        setClients(safeClients)
        setTotalClients(data?.total || data?.clients?.length || 0)
        setTotalPages(data?.pages || 1)
        // Merge percent totals across variants
        let mergedPercentTotals = {}
        percentResponses.forEach((resp) => {
          const t = (resp?.data || resp)?.totals || {}
          Object.entries(t).forEach(([k, v]) => {
            if (typeof v === 'number') mergedPercentTotals[k] = (mergedPercentTotals[k] || 0) + v
          })
        })
        setTotals({})
        setTotalsPercent(mergedPercentTotals)
        setError('')
      } else {
        // Normal only
  try { console.debug('[Client2] search payload (normal only):', payloadNormalVariants) } catch {}
  const normalResponses = await Promise.all(payloadNormalVariants.map(p => brokerAPI.searchClients(p)))
        const clientMap = new Map()
        let mergedTotals = {}
        normalResponses.forEach((resp) => {
          const data = resp?.data || resp
          const list = data?.clients || []
          // SAFETY: Filter out null/undefined clients before adding to map
          list.filter(c => c != null && c.login != null).forEach(c => { 
            if (!clientMap.has(c.login)) clientMap.set(c.login, c) 
          })
          const t = data?.totals || {}
          Object.entries(t).forEach(([k, v]) => {
            if (typeof v === 'number') mergedTotals[k] = (mergedTotals[k] || 0) + v
          })
          mergedTotalCount += Number(data?.total || list.length || 0)
        })
        const unionClients = Array.from(clientMap.values())
        const serverTotal = mergedTotalCount || 0
        const total = unionClients.length
        const start = (currentPage - 1) * (itemsPerPage || 100)
        const end = start + (itemsPerPage || 100)
        // SAFETY: Final filter before setting state
        const safeClients = unionClients.slice(start, end).filter(c => c != null && c.login != null)
        if (safeClients.length < unionClients.slice(start, end).length) {
          console.warn('[Client2Page] Filtered out invalid clients from normal-only API response')
        }
  setClients(safeClients)
  const effectiveTotal = serverTotal > 0 ? serverTotal : total
  setTotalClients(effectiveTotal)
  setTotalPages(Math.max(1, Math.ceil(effectiveTotal / (itemsPerPage || 100))))
        setTotals(mergedTotals)
        setTotalsPercent({})
        setError('')
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
  }, [currentPage, itemsPerPage, searchQuery, filters, columnFilters, mt5Accounts, accountRangeMin, accountRangeMax, sortBy, sortOrder, percentModeActive, activeGroup, selectedIB, ibMT5Accounts])
  
  // Clear cached column values when filters change (IB, group, accounts, filters, search)
  // This ensures column value dropdowns always fetch fresh data from API
  useEffect(() => {
    setColumnValues({})
    setSelectedColumnValues({})
  }, [selectedIB, ibMT5Accounts, activeGroup, mt5Accounts, accountRangeMin, accountRangeMax, filters, searchQuery])
  
  // Refetch when any percent face card visibility toggles
  useEffect(() => {
    fetchClients(false)
  }, [percentModeActive, fetchClients])
  
  // Client-side filtering only (sorting is done by API)
  const sortedClients = useMemo(() => {
    // Guard: ensure clients is an array and filter out null/undefined entries
    if (!Array.isArray(clients)) return []
    let filtered = clients.filter(c => c != null)
    
    // Apply quick filters first
    if (quickFilters.hasFloating) {
      filtered = filtered.filter(client => {
        if (!client) return false
        const floatingValue = parseFloat(client.floating) || 0
        return floatingValue > 0
      })
    }
    
    if (quickFilters.hasCredit) {
      filtered = filtered.filter(client => {
        if (!client) return false
        const creditValue = parseFloat(client.credit) || 0
        return creditValue > 0
      })
    }
    
    if (quickFilters.noDeposit) {
      filtered = filtered.filter(client => {
        if (!client) return false
        const depositValue = parseFloat(client.lifetimeDeposit) || 0
        return depositValue === 0
      })
    }
    
    // Column header filters and IB filter are applied on the server. Skip client-side filtering here.
    
    // Sorting is handled by the API via sortBy and sortOrder state
    // No client-side sorting needed as data comes pre-sorted from backend
    
    return filtered
  }, [clients, quickFilters])
  
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
    setCurrentPage(1)
    fetchClients(false)
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
    
    setColumnFilters(prev => ({
      ...prev,
      [`${columnKey}_number`]: filterConfig
    }))
    
    setShowFilterDropdown(null)
    setCurrentPage(1)
    fetchClients(false)
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
    setCurrentPage(1)
    fetchClients(false)
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
          if (cfg.values.length === 1) {
            combinedFilters.push({ field, operator: 'equal', value: cfg.values[0] })
          } else {
            if (multiOrField && multiOrField !== field) multiOrConflict = true
            else { multiOrField = field; multiOrValues = cfg.values }
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

  // Fetch ALL unique column values from server (fetch all pages to get complete dataset)
  const fetchColumnValues = async (columnKey, forceRefresh = false) => {
    // Don't fetch if already loading
    if (columnValuesLoading[columnKey]) return
    // Don't fetch if already loaded (unless forcing refresh)
    if (!forceRefresh && columnValues[columnKey]) return
    
    setColumnValuesLoading(prev => ({ ...prev, [columnKey]: true }))
    
    try {
      // Use a large page size to minimize number of requests
      const { payload, multiOrField, multiOrValues, multiOrConflict } = buildColumnValuesPayload(columnKey, 1, 1000)

      // Build payload variants to honor OR semantics for a single field
      const buildVariants = (b) => {
        if (multiOrField && multiOrValues.length > 1 && !multiOrConflict) {
          return multiOrValues.map(val => ({ ...b, filters: [...(b.filters || []), { field: multiOrField, operator: 'equal', value: val }] }))
        }
        return [b]
      }

      // Fetch page 1 to discover total pages
      const variants = buildVariants(payload)
      const responses = await Promise.all(variants.map(p => brokerAPI.searchClients(p)))
      const setVals = new Set()
      let maxPages = 1
      responses.forEach(resp => {
        const d = resp?.data || resp
        const rows = d?.clients || []
        rows.forEach(row => {
          const v = row?.[columnKey]
          if (v !== null && v !== undefined && v !== '') setVals.add(v)
        })
        maxPages = Math.max(maxPages, Number(d?.pages || 1))
      })

      // Fetch ALL remaining pages to get complete dataset
      if (maxPages > 1) {
        const remainingPages = Array.from({ length: maxPages - 1 }, (_, i) => i + 2) // pages 2..maxPages
        const allVariants = remainingPages.flatMap(pg => buildVariants({ ...payload, page: pg }))
        const allResponses = await Promise.all(allVariants.map(p => brokerAPI.searchClients(p)))
        allResponses.forEach(resp => {
          const d = resp?.data || resp
          const rows = d?.clients || []
          rows.forEach(row => {
            const v = row?.[columnKey]
            if (v !== null && v !== undefined && v !== '') setVals.add(v)
          })
        })
      }

      const uniqueValues = Array.from(setVals).sort((a, b) => String(a).localeCompare(String(b)))
      setColumnValues(prev => ({ ...prev, [columnKey]: uniqueValues }))
      setSelectedColumnValues(prev => ({ ...prev, [columnKey]: [] }))
      // No pagination state needed anymore since we load everything
    } catch (err) {
      console.error(`[Client2Page] Error fetching column values for ${columnKey}:`, err)
    } finally {
      setColumnValuesLoading(prev => ({ ...prev, [columnKey]: false }))
    }
  }

  // No longer needed - we fetch all values upfront now
  // const fetchMoreColumnValues = async (columnKey) => { ... }

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
    } catch {}
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
      dailyPnL: { label: 'Daily P&L', color: 'cyan', getValue: () => totals?.dailyPnL || 0, colorCheck: true },
      dailySOCompensationIn: { label: 'Daily SO Compensation In', color: 'purple', getValue: () => totals?.dailySOCompensationIn || 0 },
      dailySOCompensationOut: { label: 'Daily SO Compensation Out', color: 'orange', getValue: () => totals?.dailySOCompensationOut || 0 },
      dailyWithdrawal: { label: 'Daily Withdrawal', color: 'red', getValue: () => totals?.dailyWithdrawal || 0 },
      
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
      thisWeekWithdrawal: { label: 'This Week Withdrawal', color: 'red', getValue: () => totals?.thisWeekWithdrawal || 0 }
    }
    
    return configs[cardKey] || null
  }, [totalClients])
  
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
          if (cfg.values.length === 1) {
            combinedFilters.push({ field, operator: 'equal', value: cfg.values[0] })
          } else {
            if (multiOrField && multiOrField !== field) multiOrConflict = true
            else { multiOrField = field; multiOrValues = cfg.values }
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
          if (percentageFlag) p.percentage = true
          return p
        })
      }
      const p = { ...b }
      if (percentageFlag) p.percentage = true
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
                <div className="flex items-center gap-2">
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
                  
                  {/* Percentage Toggle - Now outside the menu */}
                  <div className="flex items-center gap-2 bg-white border-2 border-pink-300 rounded-lg px-2 h-9">
                    <span className="text-xs font-medium text-pink-700">%</span>
                    <button
                      onClick={() => setCardFilterPercentMode(v => !v)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors p-0.5 ${
                        cardFilterPercentMode ? 'bg-pink-600' : 'bg-gray-400'
                      }`}
                      title="Toggle percentage cards"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          cardFilterPercentMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                    <span className="text-xs font-medium text-pink-700">Mode</span>
                  </div>
                </div>
                
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
                              assets: 'Assets', balance: 'Balance', blockedCommission: 'Blocked Commission', blockedProfit: 'Blocked Profit', commission: 'Commission', credit: 'Credit', dailyBonusIn: 'Daily Bonus In', dailyBonusOut: 'Daily Bonus Out', dailyCreditIn: 'Daily Credit In', dailyCreditOut: 'Daily Credit Out', dailyDeposit: 'Daily Deposit', dailyPnL: 'Daily P&L', dailySOCompensationIn: 'Daily SO Compensation In', dailySOCompensationOut: 'Daily SO Compensation Out', dailyWithdrawal: 'Daily Withdrawal', equity: 'Equity', floating: 'Floating', liabilities: 'Liabilities', lifetimeBonusIn: 'Lifetime Bonus In', lifetimeBonusOut: 'Lifetime Bonus Out', lifetimeCreditIn: 'Lifetime Credit In', lifetimeCreditOut: 'Lifetime Credit Out', lifetimeDeposit: 'Lifetime Deposit', lifetimePnL: 'Lifetime P&L', lifetimeSOCompensationIn: 'Lifetime SO Compensation In', lifetimeSOCompensationOut: 'Lifetime SO Compensation Out', lifetimeWithdrawal: 'Lifetime Withdrawal', margin: 'Margin', marginFree: 'Margin Free', marginInitial: 'Margin Initial', marginLevel: 'Margin Level', marginMaintenance: 'Margin Maintenance', soEquity: 'SO Equity', soLevel: 'SO Level', soMargin: 'SO Margin', pnl: 'P&L', previousEquity: 'Previous Equity', profit: 'Profit', storage: 'Storage', thisMonthBonusIn: 'This Month Bonus In', thisMonthBonusOut: 'This Month Bonus Out', thisMonthCreditIn: 'This Month Credit In', thisMonthCreditOut: 'This Month Credit Out', thisMonthDeposit: 'This Month Deposit', thisMonthPnL: 'This Month P&L', thisMonthSOCompensationIn: 'This Month SO Compensation In', thisMonthSOCompensationOut: 'This Month SO Compensation Out', thisMonthWithdrawal: 'This Month Withdrawal', thisWeekBonusIn: 'This Week Bonus In', thisWeekBonusOut: 'This Week Bonus Out', thisWeekCreditIn: 'This Week Credit In', thisWeekCreditOut: 'This Week Credit Out', thisWeekDeposit: 'This Week Deposit', thisWeekPnL: 'This Week P&L', thisWeekSOCompensationIn: 'This Week SO Compensation In', thisWeekSOCompensationOut: 'This Week SO Compensation Out', thisWeekWithdrawal: 'This Week Withdrawal'
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
                            thisWeekWithdrawal: 'This Week Withdrawal'
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
                {/* Show regular cards when NOT in percentage mode - DYNAMIC RENDERING */}
                {!cardFilterPercentMode && (
                  <>
                    {faceCardOrder.map((cardKey) => {
                      const card = getClient2CardConfig(cardKey, totals)
                      
                      // Skip if card config not found or card is hidden
                      if (!card || cardVisibility[cardKey] === false) return null
                      
                      // Get value
                      const value = card.getValue()
                      
                      // Determine colors based on value if colorCheck is true
                      let textColorClass = `text-${card.color}-700`
                      let borderColorClass = `border-${card.color}-200`
                      let labelColorClass = `text-${card.color}-600`
                      
                      if (card.colorCheck) {
                        if (value >= 0) {
                          textColorClass = 'text-green-700'
                          borderColorClass = 'border-green-200'
                          labelColorClass = 'text-green-600'
                        } else {
                          textColorClass = 'text-red-700'
                          borderColorClass = 'border-red-200'
                          labelColorClass = 'text-red-600'
                        }
                      }
                      
                      return (
                        <div
                          key={cardKey}
                          className={`bg-white rounded-lg shadow-sm border-2 ${borderColorClass} p-2 hover:shadow-md transition-all duration-200 cursor-move hover:scale-105 active:scale-95`}
                          draggable
                          onDragStart={(e) => handleCardDragStart(e, cardKey)}
                          onDragOver={handleCardDragOver}
                          onDrop={(e) => handleCardDrop(e, cardKey)}
                          onDragEnd={handleCardDragEnd}
                          style={{ 
                            opacity: draggedCard === cardKey ? 0.5 : 1
                          }}
                        >
                          <div className={`text-[10px] font-medium ${labelColorClass} mb-1`}>
                            {card.label}
                          </div>
                          <div className={`text-sm font-bold ${textColorClass}`}>
                            {card.format === 'integer'
                              ? formatIndianNumber(String(Math.round(value || 0)))
                              : formatIndianNumber((value || 0).toFixed(2))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}

                {/* Percentage view section - dynamically rendered */}

                {/* Show percentage cards when IN percentage mode */}
                {cardFilterPercentMode && (() => {
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
                    // Show percentage for whatever base face cards are currently visible
                    if (cardVisibility[key] === false) return null
                    return (
                      <div key={`percent-${key}`} className="bg-white rounded-lg shadow-sm border-2 border-pink-200 p-2 hover:shadow-md transition-shadow">
                        <div className="text-[10px] font-medium text-pink-600 mb-1">{label} %</div>
                        <div className="text-sm font-bold text-pink-700">
                          {`${formatIndianNumber(((totalsPercent?.[key]) || 0).toFixed(2))}%`}
                        </div>
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
                <div className="relative">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search login, name, email..."
                    className="w-64 pl-3 pr-8 py-1.5 text-xs font-medium border-2 border-gray-300 rounded-md bg-white text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
                  />
                  {/* Inline Clear X Icon */}
                  {searchInput && (
                    <button
                      onClick={() => {
                        setSearchInput('')
                        setSearchQuery('')
                        setCurrentPage(1)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col" ref={tableContainerRef}>
              {/* Table Container with Vertical Scroll */}
              <div className="overflow-y-auto flex-1" style={{ 
                scrollbarWidth: 'thin',
                scrollbarColor: '#9ca3af #e5e7eb',
                height: tableHeight,
                maxHeight: tableHeight,
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
                    background: #22c55e; /* tailwind green-500 */
                    border-radius: 2px;
                    animation: headerSlide 0.9s linear infinite;
                  }
                `}</style>
                
                {/* Horizontal Scroll for Table - Always Visible */}
                <div className="overflow-x-auto relative table-scroll-container hide-scrollbar" ref={hScrollRef} style={{
                  scrollbarWidth: 'none',
                  scrollbarColor: '#6b7280 #e5e7eb'
                }}>
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
                    <thead className="bg-blue-600 sticky top-0 z-50">
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
                              className={`px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-move bg-blue-600 hover:bg-blue-700 active:bg-blue-700 transition-all select-none relative ${
                                isDragging ? 'opacity-50' : ''
                              } ${isDragOver ? 'border-l-4 border-yellow-400' : ''} ${isResizing ? 'bg-blue-700 ring-2 ring-yellow-400' : ''}`}
                              draggable={!resizingColumn}
                              onDragStart={(e) => handleColumnDragStart(e, col.key)}
                              onDragOver={(e) => handleColumnDragOver(e, col.key)}
                              onDragLeave={handleColumnDragLeave}
                              onDrop={(e) => handleColumnDrop(e, col.key)}
                              onDragEnd={handleColumnDragEnd}
                              style={{ 
                                minWidth: '80px',
                                overflow: 'hidden'
                              }}
                            >
                              <div className="flex items-center gap-2 justify-between min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  {/* Drag Handle Icon */}
                                  <svg 
                                    className="w-3 h-3 text-white/60 flex-shrink-0" 
                                    fill="currentColor" 
                                    viewBox="0 0 20 20"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"></path>
                                  </svg>
                                  <span 
                                    onClick={() => handleSort(col.key)}
                                    className="cursor-pointer truncate"
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
                                        
                                        // Fetch column values for ALL columns (including login)
                                        const columnType = getColumnType(col.key)
                                        // Always fetch values for checkbox filtering
                                        fetchColumnValues(col.key)
                                        // Ensure selectedColumnValues for this column starts empty
                                        if (!selectedColumnValues[col.key]) {
                                          setSelectedColumnValues(prev => ({ ...prev, [col.key]: [] }))
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

                                                {/* Select All Checkbox */}
                                                <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                                                  <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                      type="checkbox"
                                                      checked={(selectedColumnValues[columnKey] || []).length === (columnValues[columnKey] || []).length && (columnValues[columnKey] || []).length > 0}
                                                      onChange={() => toggleSelectAllColumnValues(columnKey)}
                                                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-xs font-bold text-gray-700">SELECT ALL ({(columnValues[columnKey] || []).length} values)</span>
                                                  </label>
                                                </div>

                                                {/* Values List - All values loaded, no pagination */}
                                                <div className="flex-1 overflow-y-auto px-3 py-2">
                                                  {columnValuesLoading[columnKey] ? (
                                                    <div className="py-8 text-center">
                                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                      <p className="text-xs text-gray-500 mt-2">Loading all values...</p>
                                                    </div>
                                                  ) : (() => {
                                                    const allVals = columnValues[columnKey] || []
                                                    const searchQ = columnValueSearch[columnKey] || ''
                                                    const selected = selectedColumnValues[columnKey] || []
                                                    const filteredVals = searchQ
                                                      ? allVals.filter(v => String(v).toLowerCase().includes(searchQ.toLowerCase()))
                                                      : allVals
                                                    
                                                    return filteredVals.length > 0 ? (
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
                                                      </div>
                                                    ) : (
                                                      <div className="py-8 text-xs text-gray-500 text-center">
                                                        {searchQ ? 'No matching values found' : 'No values available'}
                                                      </div>
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
                                                    <span className="text-xs font-bold text-gray-700">SELECT ALL ({allValues.length} values)</span>
                                                  </label>
                                                </div>

                                                {/* Values List - All values loaded, no pagination */}
                                                <div className="flex-1 overflow-y-auto px-3 py-2">
                                                  {loading ? (
                                                    <div className="py-8 text-center">
                                                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                                      <p className="text-xs text-gray-500 mt-2">Loading all values...</p>
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
                              <td key={col.key} data-col={col.key} className="px-4 py-3" style={{ overflow: 'hidden' }}>
                                <div className="h-4 skeleton-shimmer w-full"></div>
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        // Actual data rows with staggered fade-in
                        // Guard: filter out null/undefined clients
                        (sortedClients || []).filter(client => client != null && client.login != null).map((client, idx) => (
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Sticky Horizontal Scrollbar at Bottom - Always Visible */}
              <div 
                ref={stickyScrollRef}
                className="sticky bottom-0 overflow-x-scroll bg-gray-50 border-t border-gray-300"
                style={{
                  height: '17px',
                  zIndex: 20,
                  pointerEvents: 'auto',
                  cursor: 'default'
                }}
              >
                <div style={{ 
                  width: `${totalTableWidth}px`,
                  height: '1px',
                  pointerEvents: 'none'
                }}></div>
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





