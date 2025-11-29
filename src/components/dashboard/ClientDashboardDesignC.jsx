import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import FilterModal from '../FilterModal'
import IBFilterModal from '../IBFilterModal'
import GroupModal from '../GroupModal'
import LoginGroupsModal from '../LoginGroupsModal'
import LoginGroupModal from '../LoginGroupModal'
import { useData } from '../../contexts/DataContext'
import { useIB } from '../../contexts/IBContext'
import { useGroups } from '../../contexts/GroupContext'

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ClientDashboardDesignC() {
  const navigate = useNavigate()
  const { clients: normalizedClients, rawClients, clientStats, lastWsReceiveAt } = useData()
  // Use rawClients (unnormalized) to match desktop ClientsPage behavior
  // rawClients contains data without frontend USC normalization - backend handles USC
  const clients = rawClients.length > 0 ? rawClients : normalizedClients
  const { selectedIB, ibMT5Accounts, selectIB, clearIBSelection } = useIB()
  const { groups, deleteGroup, getActiveGroupFilter, setActiveGroupFilter, filterByActiveGroup, activeGroupFilters } = useGroups()
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [showPercent, setShowPercent] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isIBFilterOpen, setIsIBFilterOpen] = useState(false)
  const [isGroupOpen, setIsGroupOpen] = useState(false)
  const [isLoginGroupsOpen, setIsLoginGroupsOpen] = useState(false)
  const [isLoginGroupModalOpen, setIsLoginGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)
  const columnDropdownRef = useRef(null)
  const [filters, setFilters] = useState({ hasFloating: false, hasCredit: false, noDeposit: false })
  const carouselRef = useRef(null)
  const itemsPerPage = 12
  
  // Redirect to desktop view on desktop viewport
  useEffect(() => {
    const checkDesktop = () => {
      const isDesktopView = window.innerWidth > 768
      if (isDesktopView) {
        navigate('/clients')
      }
    }
    
    // Check on mount
    checkDesktop()
    
    // Check on resize
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [navigate])
  
  // Available columns for the table - matching desktop ClientsPage columns
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    name: true,
    lastName: false,
    middleName: false,
    email: false,
    phone: false,
    group: false,
    country: false,
    city: false,
    state: false,
    address: false,
    zipCode: false,
    clientID: false,
    balance: true,
    credit: false,
    equity: true,
    margin: false,
    marginFree: false,
    marginLevel: false,
    marginInitial: false,
    marginMaintenance: false,
    marginLeverage: false,
    leverage: false,
    profit: true,
    pnl: false,
    currency: false,
    currencyDigits: false,
    applied_percentage: false,
    applied_percentage_is_custom: false,
    assets: false,
    liabilities: false,
    blockedCommission: false,
    blockedProfit: false,
    storage: false,
    company: false,
    comment: false,
    color: false,
    agent: false,
    leadCampaign: false,
    leadSource: false,
    soActivation: false,
    soEquity: false,
    soLevel: false,
    soMargin: false,
    soTime: false,
    status: false,
    mqid: false,
    language: false,
    registration: false,
    lastAccess: false,
    lastUpdate: false,
    accountLastUpdate: false,
    userLastUpdate: false,
    rights: false,
    rightsMask: false,
    dailyDeposit: false,
    dailyWithdrawal: false,
    lifetimePnL: false,
    thisMonthPnL: false,
    thisWeekPnL: false
  })
  const [columnSearchQuery, setColumnSearchQuery] = useState('')

  // Filter clients based on applied filters
  const getFilteredClients = () => {
    if (!Array.isArray(clients)) return []
    
    let filtered = [...clients]

    // Apply group filter first (if active)
    filtered = filterByActiveGroup(filtered, 'login', 'dashboard')

    if (filters.hasFloating) {
      // Filter clients who have floating positions (non-zero)
      filtered = filtered.filter(c => c && c.floating && Math.abs(c.floating) > 0)
    }

    if (filters.hasCredit) {
      // Filter clients who have credit (positive or negative, but not zero)
      filtered = filtered.filter(c => {
        if (!c) return false
        const credit = Number(c.credit)
        return Number.isFinite(credit) && credit !== 0
      })
    }

    if (filters.noDeposit) {
      // Filter clients whose Lifetime Deposit is zero (no deposit history)
      filtered = filtered.filter(c => {
        if (!c) return false
        const lifeDep = Number(c.lifetimeDeposit)
        return !(Number.isFinite(lifeDep) ? lifeDep !== 0 : false)
      })
    }

    // Apply IB Filter if selected
    if (selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0) {
      // ibMT5Accounts is already an array of mt5_id numbers
      const ibLoginSet = new Set(ibMT5Accounts.map(id => String(id)))
      filtered = filtered.filter(c => {
        const clientLogin = String(c.login || c.clientID || c.mqid || '')
        return ibLoginSet.has(clientLogin)
      })
    }

    return filtered
  }

  const filteredClients = useMemo(() => getFilteredClients(), [clients, filters, lastWsReceiveAt, selectedIB, ibMT5Accounts, filterByActiveGroup, activeGroupFilters])
  const totalPages = Math.ceil((filteredClients?.length || 0) / itemsPerPage)

  // Export functions
  const exportTableColumns = () => {
    // Export only visible table columns (from filtered data if filters applied)
    const dataToExport = (Object.values(filters).some(f => f)) ? filteredClients : clients
    
    if (!Array.isArray(dataToExport) || dataToExport.length === 0) {
      alert('No data available to export')
      return
    }
    
    const tableData = dataToExport.map(client => ({
      Login: client.login || '',
      Name: client.name || client.fullName || client.clientName || client.email || client.login || '',
      'Equity (USD)': formatNum(client.equity || 0),
      'Balance (USD)': formatNum(client.balance || 0),
      'Floating (USD)': formatNum(client.floating || client.profit || 0)
    }))
    
    // Create CSV content
    const headers = Object.keys(tableData[0] || {})
    const csvContent = [
      headers.join(','),
      ...tableData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n')
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients_table_columns.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    setIsColumnDropdownOpen(false)
  }

  const exportAllColumns = () => {
    // Export all available columns (from filtered data if filters applied)
    const dataToExport = (Object.values(filters).some(f => f)) ? filteredClients : clients
    
    if (!Array.isArray(dataToExport) || dataToExport.length === 0) {
      alert('No data available to export')
      return
    }
    
    const allData = dataToExport.map(client => ({
      Login: client.login || '',
      Name: client.name || client.fullName || client.clientName || client.email || client.login || '',
      'Equity (USD)': formatNum(client.equity || 0),
      'Balance (USD)': formatNum(client.balance || 0),
      'Floating (USD)': formatNum(client.floating || client.profit || 0),
      'Credit (USD)': formatNum(client.credit || 0),
      'Margin (USD)': formatNum(client.margin || 0),
      'Free Margin (USD)': formatNum(client.freeMargin || 0),
      'Margin Level (%)': formatNum(client.marginLevel || 0),
      Group: client.group || '',
      'Last Update': client.lastUpdate || '',
      Server: client.server || '',
      Currency: client.currency || '',
      Leverage: client.leverage || '',
      'Registration Time': client.regTime || '',
      'Last Access': client.lastAccess || ''
    }))
    
    // Create CSV content
    const headers = Object.keys(allData[0] || {})
    const csvContent = [
      headers.join(','),
      ...allData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n')
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients_all_columns.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    setIsColumnDropdownOpen(false)
  }

  // Column configuration with labels and keys
  const columnConfig = [
    { key: 'login', label: 'Login', width: '80px', sticky: true },
    { key: 'name', label: 'Name', width: '120px' },
    { key: 'lastName', label: 'Last Name', width: '100px' },
    { key: 'middleName', label: 'Middle Name', width: '100px' },
    { key: 'email', label: 'Email', width: '140px' },
    { key: 'phone', label: 'Phone', width: '100px' },
    { key: 'group', label: 'Group', width: '80px' },
    { key: 'country', label: 'Country', width: '80px' },
    { key: 'city', label: 'City', width: '80px' },
    { key: 'state', label: 'State', width: '80px' },
    { key: 'address', label: 'Address', width: '140px' },
    { key: 'zipCode', label: 'Zip Code', width: '80px' },
    { key: 'clientID', label: 'Client ID', width: '80px' },
    { key: 'balance', label: 'Balance', width: '90px' },
    { key: 'credit', label: 'Credit', width: '80px' },
    { key: 'equity', label: 'Equity', width: '80px' },
    { key: 'margin', label: 'Margin', width: '80px' },
    { key: 'marginFree', label: 'Margin Free', width: '100px' },
    { key: 'marginLevel', label: 'Margin Level', width: '100px' },
    { key: 'marginInitial', label: 'Margin Initial', width: '110px' },
    { key: 'marginMaintenance', label: 'Margin Maintenance', width: '140px' },
    { key: 'marginLeverage', label: 'Margin Leverage', width: '120px' },
    { key: 'leverage', label: 'Leverage', width: '80px' },
    { key: 'profit', label: 'Floating Profit', width: '100px' },
    { key: 'pnl', label: 'PNL', width: '80px' },
    { key: 'currency', label: 'Currency', width: '80px' },
    { key: 'currencyDigits', label: 'Currency Digits', width: '110px' },
    { key: 'applied_percentage', label: 'Applied %', width: '90px' },
    { key: 'applied_percentage_is_custom', label: 'Custom %', width: '90px' },
    { key: 'assets', label: 'Assets', width: '80px' },
    { key: 'liabilities', label: 'Liabilities', width: '90px' },
    { key: 'blockedCommission', label: 'Blocked Rebate', width: '120px' },
    { key: 'blockedProfit', label: 'Blocked Profit', width: '120px' },
    { key: 'storage', label: 'Storage', width: '80px' },
    { key: 'company', label: 'Company', width: '100px' },
    { key: 'comment', label: 'Comment', width: '120px' },
    { key: 'color', label: 'Color', width: '70px' },
    { key: 'agent', label: 'Agent', width: '80px' },
    { key: 'leadCampaign', label: 'Lead Campaign', width: '120px' },
    { key: 'leadSource', label: 'Lead Source', width: '100px' },
    { key: 'soActivation', label: 'SO Activation', width: '110px' },
    { key: 'soEquity', label: 'SO Equity', width: '90px' },
    { key: 'soLevel', label: 'SO Level', width: '80px' },
    { key: 'soMargin', label: 'SO Margin', width: '90px' },
    { key: 'soTime', label: 'SO Time', width: '80px' },
    { key: 'status', label: 'Status', width: '70px' },
    { key: 'mqid', label: 'MQID', width: '80px' },
    { key: 'language', label: 'Language', width: '80px' },
    { key: 'registration', label: 'Registration', width: '120px' },
    { key: 'lastAccess', label: 'Last Access', width: '120px' },
    { key: 'lastUpdate', label: 'Last Update', width: '120px' },
    { key: 'accountLastUpdate', label: 'Account Last Update', width: '150px' },
    { key: 'userLastUpdate', label: 'User Last Update', width: '140px' },
    { key: 'rights', label: 'Rights', width: '80px' },
    { key: 'rightsMask', label: 'Rights Mask', width: '100px' },
    { key: 'dailyDeposit', label: 'Daily Deposit', width: '100px' },
    { key: 'dailyWithdrawal', label: 'Daily Withdrawal', width: '120px' },
    { key: 'lifetimePnL', label: 'Lifetime PnL', width: '100px' },
    { key: 'thisMonthPnL', label: 'This Month PnL', width: '110px' },
    { key: 'thisWeekPnL', label: 'This Week PnL', width: '110px' }
  ]

  // Get visible columns based on state
  const visibleColumnsList = useMemo(() => {
    return columnConfig.filter(col => visibleColumns[col.key])
  }, [visibleColumns])

  // Generate grid template columns string
  const gridTemplateColumns = useMemo(() => {
    return visibleColumnsList.map(col => col.width).join(' ')
  }, [visibleColumnsList])

  const rows = useMemo(() => {
    if (!Array.isArray(filteredClients)) return []
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredClients.slice(startIndex, endIndex).map(c => ({
      login: c.login,
      name: c.name || c.fullName || c.clientName || c.email || '-',
      lastName: c.lastName || c.last_name || '-',
      middleName: c.middleName || c.middle_name || '-',
      email: c.email || '-',
      phone: c.phone || c.phoneNo || c.phone_number || '-',
      group: c.group || '-',
      country: c.country || '-',
      city: c.city || '-',
      state: c.state || '-',
      address: c.address || '-',
      zipCode: c.zipCode || c.zip_code || '-',
      clientID: c.clientID || c.client_id || '-',
      balance: formatNum(c.balance),
      credit: formatNum(c.credit || 0),
      equity: formatNum(c.equity),
      margin: formatNum(c.margin || 0),
      marginFree: formatNum(c.marginFree || c.free_margin || 0),
      marginLevel: formatNum(c.marginLevel || c.margin_level || 0),
      marginInitial: formatNum(c.marginInitial || c.margin_initial || 0),
      marginMaintenance: formatNum(c.marginMaintenance || c.margin_maintenance || 0),
      marginLeverage: formatNum(c.marginLeverage || c.margin_leverage || 0),
      leverage: c.leverage || '-',
      profit: formatNum(c.floating ?? c.profit ?? 0),
      pnl: formatNum(c.pnl || 0),
      currency: c.currency || '-',
      currencyDigits: c.currencyDigits || c.currency_digits || '-',
      applied_percentage: c.applied_percentage ? formatNum(c.applied_percentage) : '-',
      applied_percentage_is_custom: c.applied_percentage_is_custom ? 'Yes' : 'No',
      assets: formatNum(c.assets || 0),
      liabilities: formatNum(c.liabilities || 0),
      blockedCommission: formatNum(c.blockedCommission || c.blocked_commission || 0),
      blockedProfit: formatNum(c.blockedProfit || c.blocked_profit || 0),
      storage: formatNum(c.storage || 0),
      company: c.company || '-',
      comment: c.comment || '-',
      color: c.color || '-',
      agent: c.agent || '-',
      leadCampaign: c.leadCampaign || c.lead_campaign || '-',
      leadSource: c.leadSource || c.lead_source || '-',
      soActivation: c.soActivation || c.so_activation || '-',
      soEquity: formatNum(c.soEquity || c.so_equity || 0),
      soLevel: formatNum(c.soLevel || c.so_level || 0),
      soMargin: formatNum(c.soMargin || c.so_margin || 0),
      soTime: c.soTime || c.so_time || '-',
      status: c.status || '-',
      mqid: c.mqid || '-',
      language: c.language || '-',
      registration: c.registration || c.regTime || '-',
      lastAccess: c.lastAccess || c.last_access || '-',
      lastUpdate: c.lastUpdate || c.last_update || '-',
      accountLastUpdate: c.accountLastUpdate || c.account_last_update || '-',
      userLastUpdate: c.userLastUpdate || c.user_last_update || '-',
      rights: c.rights || '-',
      rightsMask: c.rightsMask || c.rights_mask || '-',
      dailyDeposit: formatNum(c.dailyDeposit || c.daily_deposit || 0),
      dailyWithdrawal: formatNum(c.dailyWithdrawal || c.daily_withdrawal || 0),
      lifetimePnL: formatNum(c.lifetimePnL || 0),
      thisMonthPnL: formatNum(c.thisMonthPnL || c.monthlyPnL || 0),
      thisWeekPnL: formatNum(c.thisWeekPnL || c.weeklyPnL || 0)
    }))
  }, [filteredClients, currentPage, itemsPerPage, lastWsReceiveAt])

  const cards = useMemo(() => {
    console.log('📊 Cards calculation - clientStats:', clientStats)
    console.log('📊 Filtered clients data:', filteredClients?.slice(0, 2))
    console.log('📊 lastWsReceiveAt:', lastWsReceiveAt)
    
    // Always calculate from actual client data for real-time updates
    // Use filteredClients if any filter is active (basic filters OR IB filter OR group filter)
    const hasBasicFilters = Object.values(filters).some(f => f)
    const hasIBFilter = selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0
    const hasGroupFilter = activeGroupFilters?.dashboard != null
    const dataToUse = (hasBasicFilters || hasIBFilter || hasGroupFilter) ? filteredClients : clients
    
    const calculateStats = () => {
      if (!Array.isArray(dataToUse) || dataToUse.length === 0) {
        return {
          totalClients: 0,
          totalBalance: 0,
          totalCredit: 0,
          totalEquity: 0,
          totalPnl: 0,
          dailyPnL: 0,
          totalProfit: 0,
          dailyDeposit: 0,
          dailyWithdrawal: 0,
          thisWeekPnL: 0,
          thisMonthPnL: 0,
          lifetimePnL: 0,
          weekDeposit: 0,
          weekWithdrawal: 0,
          monthDeposit: 0,
          monthWithdrawal: 0,
          lifetimeDeposit: 0,
          lifetimeWithdrawal: 0,
          totalCommission: 0,
          availableCommission: 0,
          blockedCommission: 0
        }
      }
      
      // Enhanced robust numeric sum helper matching desktop ClientsPage
      const sum = (key) => dataToUse.reduce((acc, c) => {
        if (!c || typeof c !== 'object') return acc
        const v = c[key]
        // Handle null/undefined explicitly
        if (v == null) return acc
        // If already a finite number, use directly
        if (typeof v === 'number' && Number.isFinite(v)) return acc + v
        // Attempt string coercion with comma removal
        if (typeof v === 'string') {
          const cleaned = v.replace(/,/g, '').trim()
          if (cleaned === '' || cleaned === '-') return acc
          const n = Number(cleaned)
          return acc + (Number.isFinite(n) ? n : 0)
        }
        // Coerce other types
        const n = Number(v)
        return acc + (Number.isFinite(n) ? n : 0)
      }, 0)
      
      return {
        totalClients: dataToUse.length,
        totalBalance: sum('balance'),
        totalCredit: sum('credit'),
        totalEquity: sum('equity'),
        totalPnl: sum('pnl'),
        dailyPnL: sum('dailyPnL'),
        totalProfit: sum('floating') || sum('profit'),
        dailyDeposit: sum('dailyDeposit'),
        dailyWithdrawal: sum('dailyWithdrawal'),
        thisWeekPnL: sum('thisWeekPnL'),
        thisMonthPnL: sum('thisMonthPnL'),
        lifetimePnL: sum('lifetimePnL'),
        weekDeposit: sum('weekDeposit'),
        weekWithdrawal: sum('weekWithdrawal'),
        monthDeposit: sum('monthDeposit'),
        monthWithdrawal: sum('monthWithdrawal'),
        lifetimeDeposit: sum('lifetimeDeposit'),
        lifetimeWithdrawal: sum('lifetimeWithdrawal'),
        totalCommission: sum('blockedCommission'),
        availableCommission: sum('availableCommission'),
        blockedCommission: sum('blockedCommission')
      }
    }
    
    // Always recalculate from client data to ensure real-time updates
    const stats = calculateStats()
    
    if (showPercent) {
      const sum = (key) => Array.isArray(dataToUse) ? dataToUse.reduce((acc, c) => acc + (Number(c?.[key]) || 0), 0) : 0
      const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return [
        { label: 'Monthly EQuity', value: fmt(sum('thisMonthPnL_percentage')), unit: '%' },
        { label: 'TOTAL EQUITY', value: fmt(sum('equity_percentage')), unit: '%' },
        { label: 'LIFETIME PnL', value: fmt(sum('lifetimePnL_percentage')), unit: '%' },
        { label: 'DAILY PnL', value: fmt(sum('dailyPnL_percentage')), unit: '%' },
      ]
    }
    return [
      // Core Metrics  
      { label: 'Total Clients', value: String(stats?.totalClients || 0), unit: 'Count' },
      { label: 'Total Balance', value: formatNum(stats?.totalBalance || 0), unit: 'USD' },
      { label: 'Total Credit', value: formatNum(stats?.totalCredit || 0), unit: 'USD' },
      { label: 'TOTAL EQUITY', value: formatNum(stats?.totalEquity || 0), unit: 'USD' },
      { label: 'PNL', value: formatNum(stats?.totalPnl || stats?.dailyPnL || 0), unit: 'USD' },
      { label: 'Floating Profit', value: formatNum(stats?.totalProfit || 0), unit: 'USD' },
      
      // Daily Metrics
      { label: 'Daily Deposit', value: formatNum(stats?.dailyDeposit || 0), unit: 'USD' },
      { label: 'Daily Withdrawal', value: formatNum(stats?.dailyWithdrawal || 0), unit: 'USD' },
      { label: 'DAILY PnL', value: formatNum(stats?.dailyPnL || 0), unit: 'USD' },
      { label: 'This Week PnL', value: formatNum(stats?.thisWeekPnL || 0), unit: 'USD' },
      { label: 'Monthly EQuity', value: formatNum(stats?.thisMonthPnL || 0), unit: 'USD' },
      { label: 'LIFETIME PnL', value: formatNum(stats?.lifetimePnL || 0), unit: 'USD' },
      
      // Net Calculations  
      { label: 'Daily Net D/W', value: formatNum((stats?.dailyDeposit || 0) - (stats?.dailyWithdrawal || 0)), unit: 'USD' },
      { label: 'Book PnL', value: formatNum((stats?.lifetimePnL || 0) + (stats?.totalProfit || 0)), unit: 'USD' },
      
      // Rebate Metrics
      { label: 'Total Rebate', value: formatNum(stats?.totalCommission), unit: 'USD' },
      { label: 'Available Rebate', value: formatNum(stats?.availableCommission), unit: 'USD' },
      { label: 'Blocked Rebate', value: formatNum(stats?.blockedCommission), unit: 'USD' },
      
      // Weekly Metrics
      { label: 'Week Deposit', value: formatNum(stats?.weekDeposit), unit: 'USD' },
      { label: 'Week Withdrawal', value: formatNum(stats?.weekWithdrawal), unit: 'USD' },
      { label: 'NET Week DW', value: formatNum((stats?.weekDeposit || 0) - (stats?.weekWithdrawal || 0)), unit: 'USD' },
      
      // Monthly Metrics
      { label: 'Monthly Deposit', value: formatNum(stats?.monthDeposit), unit: 'USD' },
      { label: 'Monthly Withdrawal', value: formatNum(stats?.monthWithdrawal), unit: 'USD' },
      { label: 'NET Monthly DW', value: formatNum((stats?.monthDeposit || 0) - (stats?.monthWithdrawal || 0)), unit: 'USD' },
      
      // Lifetime Metrics
      { label: 'Lifetime Deposit', value: formatNum(stats?.lifetimeDeposit), unit: 'USD' },
      { label: 'Lifetime Withdrawal', value: formatNum(stats?.lifetimeWithdrawal), unit: 'USD' },
      { label: 'NET Lifetime DW', value: formatNum((stats?.lifetimeDeposit || 0) - (stats?.lifetimeWithdrawal || 0)), unit: 'USD' },
      
      // Bonus Metrics
      { label: 'Daily Bonus IN', value: formatNum(clientStats?.dailyBonusIn), unit: 'USD' },
      { label: 'Daily Bonus OUT', value: formatNum(clientStats?.dailyBonusOut), unit: 'USD' },
      { label: 'NET Daily Bonus', value: formatNum(clientStats?.netDailyBonus), unit: 'USD' },
      { label: 'Week Bonus IN', value: formatNum(clientStats?.weekBonusIn), unit: 'USD' },
      { label: 'Week Bonus OUT', value: formatNum(clientStats?.weekBonusOut), unit: 'USD' },
      { label: 'NET Week Bonus', value: formatNum(clientStats?.netWeekBonus), unit: 'USD' },
      { label: 'Monthly Bonus IN', value: formatNum(clientStats?.monthBonusIn), unit: 'USD' },
      { label: 'Monthly Bonus OUT', value: formatNum(clientStats?.monthBonusOut), unit: 'USD' },
      { label: 'NET Monthly Bonus', value: formatNum(clientStats?.netMonthBonus), unit: 'USD' },
      { label: 'Lifetime Bonus IN', value: formatNum(clientStats?.lifetimeBonusIn), unit: 'USD' },
      { label: 'Lifetime Bonus OUT', value: formatNum(clientStats?.lifetimeBonusOut), unit: 'USD' },
      { label: 'NET Lifetime Bonus', value: formatNum(clientStats?.netLifetimeBonus), unit: 'USD' },
      
      // Credit Metrics
      { label: 'Weekly Credit IN', value: formatNum(clientStats?.weekCreditIn), unit: 'USD' },
      { label: 'Monthly Credit IN', value: formatNum(clientStats?.monthCreditIn), unit: 'USD' },
      { label: 'Lifetime Credit IN', value: formatNum(clientStats?.lifetimeCreditIn), unit: 'USD' },
      { label: 'Weekly Credit OUT', value: formatNum(clientStats?.weekCreditOut), unit: 'USD' },
      { label: 'Monthly Credit OUT', value: formatNum(clientStats?.monthCreditOut), unit: 'USD' },
      { label: 'Lifetime Credit OUT', value: formatNum(clientStats?.lifetimeCreditOut), unit: 'USD' },
      { label: 'NET Credit', value: formatNum(clientStats?.netCredit), unit: 'USD' },
      
      // Previous Equity Metrics
      { label: 'Weekly Previous Equity', value: formatNum(clientStats?.weekPreviousEquity), unit: 'USD' },
      { label: 'Monthly Previous Equity', value: formatNum(clientStats?.monthPreviousEquity), unit: 'USD' },
      { label: 'Previous Equity', value: formatNum(clientStats?.previousEquity), unit: 'USD' },
      
      // Additional Calculated Metrics
      { label: 'Net Lifetime PnL', value: formatNum((stats?.lifetimePnL || 0) - (stats?.totalCommission || 0)), unit: 'USD' },
    ]
  }, [clientStats, clients, filteredClients, filters, showPercent, lastWsReceiveAt, selectedIB, ibMT5Accounts, activeGroupFilters])

  // Debug: Log when WebSocket data updates
  useEffect(() => {
    if (lastWsReceiveAt) {
      console.log('🔄 WebSocket update received at:', new Date(lastWsReceiveAt).toLocaleTimeString())
      console.log('📊 Current clients count:', clients?.length)
      console.log('📊 Sample client data:', clients?.[0])
    }
  }, [lastWsReceiveAt, clients])

  // Handle scroll to track active card
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft
      const cardWidth = 150 + 8 // card width + gap
      const cardsPerScreen = 2
      const index = Math.round(scrollLeft / (cardWidth * cardsPerScreen))
      setActiveCardIndex(Math.min(index, Math.ceil(cards.length / cardsPerScreen) - 1))
    }

    carousel.addEventListener('scroll', handleScroll)
    return () => carousel.removeEventListener('scroll', handleScroll)
  }, [cards.length])

  // Navigate to next page
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  // Navigate to previous page
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#F5F5F5] font-outfit overflow-x-hidden">
      {/* Header - White rounded rectangle */}
      <div className="sticky top-0 left-0 w-full h-[76px] bg-white shadow-[0px_3.64px_44.92px_rgba(0,0,0,0.05)] z-10">
        {/* Group container - full width */}
        <div className="absolute left-0 right-0 top-5 px-4 h-9 flex items-center justify-between">
          {/* Hamburger button - Frame with auto layout */}
          <button onClick={() => setIsSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-[6px] border-0 bg-[rgba(230,238,248,0.44)] shadow-[inset_0px_2px_2px_rgba(155,151,151,0.2)] p-[11px]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect y="4" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="8.75" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="13.5" width="20" height="2.5" rx="1.25" fill="#404040"/>
            </svg>
          </button>

          {/* Clients heading - H2 Mobile / Semibold / 18px, centered */}
          <span className="absolute left-1/2 -translate-x-1/2 top-[6px] font-outfit font-semibold text-[18px] leading-[24px] text-center text-black">Clients</span>

          {/* Profile avatar - positioned at right with spacing */}
          <div className="absolute right-4 w-9 h-9 rounded-full overflow-hidden shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] bg-gray-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="#9CA3AF"/>
              <path d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20V20" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Action buttons and View All row */}
      <div className="pt-5 pb-4 px-4">
        <div className="flex items-center justify-between">
          {/* Left side - Filter, %, Download buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => setIsCustomizeOpen(true)} className="h-9 px-3 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4.5 6.5H9.5M2.5 3.5H11.5M5.5 9.5H8.5" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[#4B4B4B] text-[12px] font-medium font-outfit">Filter</span>
            </button>
            <button
              onClick={() => setShowPercent((v) => !v)}
              className={`w-9 h-9 rounded-lg border shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors ${
                showPercent ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#ECECEC] hover:bg-gray-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 12L12 4M4.5 6.5C5.32843 6.5 6 5.82843 6 5C6 4.17157 5.32843 3.5 4.5 3.5C3.67157 3.5 3 4.17157 3 5C3 5.82843 3.67157 6.5 4.5 6.5ZM11.5 12.5C12.3284 12.5 13 11.8284 13 11C13 10.1716 12.3284 9.5 11.5 9.5C10.6716 9.5 10 10.1716 10 11C10 11.8284 10.6716 12.5 11.5 12.5Z" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Download button and dropdown */}
            <div className="relative" ref={columnDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColumnDropdownOpen(!isColumnDropdownOpen);
                }}
                className="w-9 h-9 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors"
                title="Download"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="#404040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="4" y="15" width="12" height="2" rx="1" fill="#404040"/>
                </svg>
              </button>
              {/* Dropdown menu - simple absolute positioning */}
              {isColumnDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-[160px] bg-white border border-[#ECECEC] rounded-[8px] shadow-[0_0_12px_rgba(75,75,75,0.15)] z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportTableColumns();
                      setIsColumnDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[12px] text-[#404040] hover:bg-gray-50 flex items-center gap-2 border-b border-[#F5F5F5]"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="3" width="12" height="10" stroke="#404040" strokeWidth="1" rx="1" fill="none"/>
                      <line x1="2" y1="6" x2="14" y2="6" stroke="#404040" strokeWidth="1"/>
                      <line x1="6" y1="3" x2="6" y2="13" stroke="#404040" strokeWidth="1"/>
                    </svg>
                    Download Table Columns
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportAllColumns();
                      setIsColumnDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[12px] text-[#404040] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="2" width="14" height="12" stroke="#404040" strokeWidth="1" rx="1" fill="none"/>
                      <line x1="1" y1="5" x2="15" y2="5" stroke="#404040" strokeWidth="1"/>
                      <line x1="5" y1="2" x2="5" y2="14" stroke="#404040" strokeWidth="1"/>
                      <line x1="10" y1="2" x2="10" y2="14" stroke="#404040" strokeWidth="1"/>
                    </svg>
                    Download All Columns
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right side - View All only */}
          <span className="text-[#1A63BC] text-[12px] font-semibold leading-[15px] cursor-pointer">View All</span>
        </div>
      </div>

      {/* Customize View Bottom Sheet */}
      {isCustomizeOpen && (
        <div className="fixed inset-0 z-40">
          {/* Dim background */}
          <div className="absolute inset-0 bg-black/35" onClick={() => setIsCustomizeOpen(false)} />
          {/* Bottom sheet */}
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full mx-auto mt-2" />
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-[#F0F0F0]">
              <button onClick={() => setIsCustomizeOpen(false)} className="w-9 h-9 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <div className="text-[16px] font-semibold text-[#111827]">Customize view</div>
              <div className="w-9 h-9" />
            </div>
            {/* Items */}
            <div className="px-4">
              <div className="divide-y divide-[#EFEFEF]">
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsFilterOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h12M6 9h6M7 13h4" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Filter</span>
                </button>
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsIBFilterOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M4 20a8 8 0 0 1 16 0" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">IB Filter</span>
                </button>
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsLoginGroupsOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M17 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M3 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Groups</span>
                </button>
              </div>
            </div>
            {/* Footer actions */}
            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <button 
                className="flex-1 h-10 rounded-xl bg-[#EFF4FB] text-[#1A63BC] text-[13px] font-semibold"
                onClick={() => {
                  // Clear all filters
                  setFilters({ hasFloating: false, hasCredit: false, noDeposit: false })
                  // Clear IB filter
                  clearIBSelection()
                  // Clear group filter
                  setActiveGroupFilter('dashboard', null)
                }}
              >
                Reset
              </button>
              <button className="flex-1 h-10 rounded-xl bg-[#1A63BC] text-white text-[13px] font-semibold" onClick={() => setIsCustomizeOpen(false)}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Hook existing modals */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(newFilters) => { setFilters(newFilters); }}
        initialFilters={filters}
      />
      <IBFilterModal
        isOpen={isIBFilterOpen}
        onClose={() => setIsIBFilterOpen(false)}
        currentSelectedIB={selectedIB}
        onSelectIB={(ibData) => {
          if (ibData === null) {
            // Reset/clear the filter
            clearIBSelection()
          } else {
            // Pass the complete IB object to selectIB
            selectIB({
              email: ibData.email,
              name: ibData.name,
              percentage: ibData.percentage
            })
          }
          setIsIBFilterOpen(false)
        }}
      />
      <GroupModal
        isOpen={isGroupOpen}
        onClose={() => setIsGroupOpen(false)}
        availableItems={clients}
        loginField="login"
        displayField="name"
      />
      <LoginGroupsModal
        isOpen={isLoginGroupsOpen}
        onClose={() => setIsLoginGroupsOpen(false)}
        groups={groups.map(g => ({
          ...g,
          loginCount: g.range 
            ? (g.range.to - g.range.from + 1) 
            : g.loginIds.length
        }))}
        activeGroupName={getActiveGroupFilter('dashboard')}
        onSelectGroup={(group) => {
          // Apply group filter or clear if null
          if (group === null) {
            setActiveGroupFilter('dashboard', null)
          } else {
            setActiveGroupFilter('dashboard', group.name)
          }
          setIsLoginGroupsOpen(false)
        }}
        onCreateGroup={() => {
          setIsLoginGroupsOpen(false)
          setEditingGroup(null)
          setIsLoginGroupModalOpen(true)
        }}
        onEditGroup={(group) => {
          setIsLoginGroupsOpen(false)
          setEditingGroup(group)
          setIsLoginGroupModalOpen(true)
        }}
        onDeleteGroup={(group) => {
          if (window.confirm(`Delete group "${group.name}"?`)) {
            deleteGroup(group.name)
          }
        }}
      />
      <LoginGroupModal
        isOpen={isLoginGroupModalOpen}
        onClose={() => {
          setIsLoginGroupModalOpen(false)
          setEditingGroup(null)
        }}
        onSave={() => {
          setIsLoginGroupModalOpen(false)
          setEditingGroup(null)
          setIsLoginGroupsOpen(true)
        }}
        editGroup={editingGroup}
      />

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/25"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full w-[300px] bg-white shadow-xl rounded-r-2xl flex flex-col">
            <div className="p-4 flex items-center gap-3 border-b border-[#ECECEC]">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1A63BC"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#1A63BC]">Broker Eyes</div>
                <div className="text-[11px] text-[#7A7A7A]">Trading Platform</div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto py-2">
              <nav className="flex flex-col">
                {[
                  {label:'Dashboard', icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#404040"/></svg>
                  )},
                  {label:'Clients', active:true, icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#1A63BC"/><circle cx="16" cy="8" r="3" stroke="#1A63BC"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#1A63BC"/></svg>
                  )},
                  {label:'Pending Orders', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><circle cx="12" cy="12" r="2" fill="#404040"/></svg>
                  )},
                  {label:'Margin Level', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 18L10 12L14 16L20 8" stroke="#404040" strokeWidth="2"/></svg>
                  )},
                  {label:'Live Dealing', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 18 0" stroke="#404040"/><path d="M7 12a5 5 0 0 1 10 0" stroke="#404040"/></svg>
                  )},
                  {label:'Client Percentage', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6" stroke="#404040"/><circle cx="8" cy="8" r="2" stroke="#404040"/><circle cx="16" cy="16" r="2" stroke="#404040"/></svg>
                  )},
                  {label:'IB Commissions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><path d="M12 7v10M8 10h8" stroke="#404040"/></svg>
                  )},
                  {label:'Settings', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" stroke="#404040"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2" stroke="#404040"/></svg>
                  )},
                ].map((item, idx) => (
                  <button key={idx} className={`flex items-center gap-3 px-4 h-11 text-[13px] ${item.active ? 'text-[#1A63BC] bg-[#EFF4FB] rounded-lg font-semibold' : 'text-[#404040]'}`}>
                    <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 mt-auto border-t border-[#ECECEC]">
              <button className="flex items-center gap-3 px-2 h-10 text-[13px] text-[#404040]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="#404040" strokeWidth="2"/><path d="M4 12h11" stroke="#404040" strokeWidth="2"/></svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards - Horizontal scrollable carousel */}
      <div className="pb-2 pl-5">
        <div 
          ref={carouselRef}
          className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory pr-4"
        >
          {cards.map((card, i) => (
            <div 
              key={i} 
              className="min-w-[150px] w-[150px] h-[45px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1.5 flex flex-col justify-between snap-start flex-shrink-0"
            >
              <div className="flex items-start justify-between">
                <span className="text-[#4B4B4B] text-[8px] font-normal leading-[10px] pr-1">{card.label}</span>
                <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                    <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-[4px]">
                <span className={`text-[14px] font-semibold leading-[18px] tracking-[-0.01em] ${card.value.includes('-') ? 'text-[#DC2626]' : 'text-[#000000]'}`}>
                  {card.value}
                </span>
                <span className="text-[#4B4B4B] text-[8px] font-normal leading-[10px] uppercase">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search and action buttons */}
      <div className="pb-3 px-4">
          <div className="flex items-center gap-1">
          {/* Search box - compact, edge-to-edge */}
          <div className="flex-1 min-w-0 h-[32px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] px-2 flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
              <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input 
              placeholder="Search" 
              className="flex-1 min-w-0 outline-none border-0 text-[11px] text-[#4B4B4B] placeholder:text-[#999999] bg-transparent font-outfit" 
            />
          </div>
          
          {/* Column selector button */}
          <div className="relative" ref={columnDropdownRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setIsColumnSelectorOpen(true)
              }}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="8.5" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="14" y="5" width="3" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
              </svg>
            </button>
          </div>

          {/* Previous button */}
          <button 
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className={`w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 ${
              currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Next button */}
          <button 
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className={`w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 ${
              currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>      {/* Table area */}
      <div className="table-no-borders relative">
        <div className="w-full overflow-x-auto overflow-y-visible" style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: '#CBD5E0 #F7FAFC'
        }}>
          <div className="relative" style={{ minWidth: 'max-content' }}>
          {/* Header row */}
          <div className="grid bg-[#1A63BC] text-white text-[10px] font-semibold font-outfit sticky top-0 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.1)]" style={{gap: '0px', gridGap: '0px', columnGap: '0px', gridTemplateColumns}}>
            {visibleColumnsList.map((col, idx) => (
              <div 
                key={col.key}
                className={`h-[28px] flex items-center justify-center px-1 ${col.sticky ? 'sticky left-0 bg-[#1A63BC] z-30' : ''}`}
                style={{border: 'none', outline: 'none', boxShadow: 'none'}}
              >
                {col.label}
              </div>
            ))}
          </div>
          {/* Rows */}
          {rows.map((r, idx) => (
            <div key={idx} className="grid text-[10px] text-[#4B4B4B] font-outfit bg-white border-b border-[#E1E1E1] hover:bg-[#F8FAFC] transition-colors" style={{gap: '0px', gridGap: '0px', columnGap: '0px', gridTemplateColumns}}>
              {visibleColumnsList.map((col, colIdx) => (
                <div 
                  key={col.key}
                  className={`h-[38px] flex items-center justify-center px-1 overflow-hidden text-ellipsis whitespace-nowrap ${
                    col.key === 'login' ? 'text-[#1A63BC] font-semibold sticky left-0 bg-white z-10' : ''
                  }`}
                  style={{border: 'none', outline: 'none', boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'}}
                >
                  {r[col.key]}
                </div>
              ))}
            </div>
          ))}
          {/* Footer row */}
          <div className="grid bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-semibold border-t-2 border-[#1A63BC]" style={{gap: '0px', gridGap: '0px', columnGap: '0px', gridTemplateColumns}}>
            {visibleColumnsList.map((col, idx) => (
              <div 
                key={col.key}
                className={`h-[38px] flex items-center justify-center px-1 ${col.key === 'login' ? 'font-bold sticky left-0 bg-[#EFF4FB] z-10' : ''}`}
                style={{border: 'none', outline: 'none', boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'}}
              >
                {col.key === 'login' ? 'Total' : 
                 col.key === 'balance' ? formatNum(clientStats?.totalBalance || 0) :
                 col.key === 'profit' ? formatNum(clientStats?.totalProfit || 0) :
                 col.key === 'equity' ? formatNum(clientStats?.totalEquity || 0) :
                 col.key === 'credit' ? formatNum(clientStats?.totalCredit || 0) :
                 '-'}
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Custom scrollbar styling for table */
        .table-no-borders > div:first-child::-webkit-scrollbar {
          height: 6px;
        }
        .table-no-borders > div:first-child::-webkit-scrollbar-track {
          background: #F7FAFC;
          border-radius: 3px;
        }
        .table-no-borders > div:first-child::-webkit-scrollbar-thumb {
          background: #CBD5E0;
          border-radius: 3px;
        }
        .table-no-borders > div:first-child::-webkit-scrollbar-thumb:hover {
          background: #A0AEC0;
        }
        /* Completely remove all borders and separators from table */
        .table-no-borders,
        .table-no-borders *,
        .table-no-borders div {
          border-left: none !important;
          border-right: none !important;
          border-inline: none !important;
          border-inline-start: none !important;
          border-inline-end: none !important;
          border-collapse: collapse !important;
          background-image: none !important;
        }
        .table-no-borders .grid {
          gap: 0 !important;
          grid-gap: 0 !important;
          column-gap: 0 !important;
          grid-column-gap: 0 !important;
        }
        .table-no-borders div[class*="grid"] {
          border-spacing: 0 !important;
        }
        /* Sticky login column enhancements */
        .table-no-borders .sticky {
          position: sticky !important;
          left: 0 !important;
          z-index: 10 !important;
        }
        .table-no-borders .grid > div:first-child {
          position: sticky !important;
          left: 0 !important;
          z-index: 10 !important;
          box-shadow: 2px 0 4px rgba(0,0,0,0.05) !important;
        }
        /* Header row sticky enhancements */
        .table-no-borders .grid:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 20 !important;
        }
        .table-no-borders .grid:first-child > div:first-child {
          z-index: 30 !important;
        }
        /* Modal slide-up animation */
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>

      {/* Column Selector Modal */}
      {isColumnSelectorOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setIsColumnSelectorOpen(false)}>
          <div 
            className="w-full bg-white rounded-t-[24px] max-h-[80vh] overflow-hidden flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-gray-200">
              <button 
                onClick={() => setIsColumnSelectorOpen(false)}
                className="absolute left-4 top-6 w-8 h-8 flex items-center justify-center"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h2 className="text-center text-xl font-semibold font-outfit text-black">Show/Hide Columns</h2>
            </div>

            {/* Search Box */}
            <div className="px-6 py-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Columns"
                  value={columnSearchQuery}
                  onChange={(e) => setColumnSearchQuery(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl text-base font-outfit focus:outline-none focus:border-blue-500"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>

            {/* Column List */}
            <div className="flex-1 overflow-y-auto px-6">
              {Object.entries({
                'Login': 'login',
                'Name': 'name',
                'Last Name': 'lastName',
                'Middle Name': 'middleName',
                'Email': 'email',
                'Phone': 'phone',
                'Group': 'group',
                'Country': 'country',
                'City': 'city',
                'State': 'state',
                'Address': 'address',
                'Zip Code': 'zipCode',
                'Client ID': 'clientID',
                'Balance': 'balance',
                'Credit': 'credit',
                'Equity': 'equity',
                'Margin': 'margin',
                'Margin Free': 'marginFree',
                'Margin Level': 'marginLevel',
                'Margin Initial': 'marginInitial',
                'Margin Maintenance': 'marginMaintenance',
                'Margin Leverage': 'marginLeverage',
                'Leverage': 'leverage',
                'Floating Profit': 'profit',
                'PNL': 'pnl',
                'Currency': 'currency',
                'Currency Digits': 'currencyDigits',
                'Applied %': 'applied_percentage',
                'Custom %': 'applied_percentage_is_custom',
                'Assets': 'assets',
                'Liabilities': 'liabilities',
                'Blocked Rebate': 'blockedCommission',
                'Blocked Profit': 'blockedProfit',
                'Storage': 'storage',
                'Company': 'company',
                'Comment': 'comment',
                'Color': 'color',
                'Agent': 'agent',
                'Lead Campaign': 'leadCampaign',
                'Lead Source': 'leadSource',
                'SO Activation': 'soActivation',
                'SO Equity': 'soEquity',
                'SO Level': 'soLevel',
                'SO Margin': 'soMargin',
                'SO Time': 'soTime',
                'Status': 'status',
                'MQID': 'mqid',
                'Language': 'language',
                'Registration': 'registration',
                'Last Access': 'lastAccess',
                'Last Update': 'lastUpdate',
                'Account Last Update': 'accountLastUpdate',
                'User Last Update': 'userLastUpdate',
                'Rights': 'rights',
                'Rights Mask': 'rightsMask',
                'Daily Deposit': 'dailyDeposit',
                'Daily Withdrawal': 'dailyWithdrawal',
                'Lifetime PnL': 'lifetimePnL',
                'This Month PnL': 'thisMonthPnL',
                'This Week PnL': 'thisWeekPnL'
              }).filter(([label]) => 
                label.toLowerCase().includes(columnSearchQuery.toLowerCase())
              ).map(([label, key]) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0"
                >
                  <span className="text-base text-gray-800 font-outfit">{label}</span>
                  <button
                    onClick={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="w-6 h-6 flex items-center justify-center"
                  >
                    {visibleColumns[key] ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="4" fill="#3B82F6"/>
                        <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="white"/>
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setVisibleColumns({
                    login: false,
                    name: false,
                    lastName: false,
                    middleName: false,
                    email: false,
                    phone: false,
                    group: false,
                    country: false,
                    city: false,
                    state: false,
                    address: false,
                    zipCode: false,
                    clientID: false,
                    balance: false,
                    credit: false,
                    equity: false,
                    margin: false,
                    marginFree: false,
                    marginLevel: false,
                    marginInitial: false,
                    marginMaintenance: false,
                    marginLeverage: false,
                    leverage: false,
                    profit: false,
                    pnl: false,
                    currency: false,
                    currencyDigits: false,
                    applied_percentage: false,
                    applied_percentage_is_custom: false,
                    assets: false,
                    liabilities: false,
                    blockedCommission: false,
                    blockedProfit: false,
                    storage: false,
                    company: false,
                    comment: false,
                    color: false,
                    agent: false,
                    leadCampaign: false,
                    leadSource: false,
                    soActivation: false,
                    soEquity: false,
                    soLevel: false,
                    soMargin: false,
                    soTime: false,
                    status: false,
                    mqid: false,
                    language: false,
                    registration: false,
                    lastAccess: false,
                    lastUpdate: false,
                    accountLastUpdate: false,
                    userLastUpdate: false,
                    rights: false,
                    rightsMask: false,
                    dailyDeposit: false,
                    dailyWithdrawal: false,
                    lifetimePnL: false,
                    thisMonthPnL: false,
                    thisWeekPnL: false
                  })
                }}
                className="flex-1 h-14 rounded-2xl border-2 border-gray-200 bg-white text-gray-700 text-base font-medium hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={() => setIsColumnSelectorOpen(false)}
                className="flex-1 h-14 rounded-2xl bg-blue-600 text-white text-base font-medium hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
