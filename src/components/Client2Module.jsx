import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import { useIB } from '../contexts/IBContext'
import { useGroups } from '../contexts/GroupContext'
import { brokerAPI } from '../services/api'

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Client2Module() {
  const navigate = useNavigate()
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
  const columnSelectorButtonRef = useRef(null)
  const [filters, setFilters] = useState({ hasFloating: false, hasCredit: false, noDeposit: false })
  const carouselRef = useRef(null)
  const viewAllRef = useRef(null)
  const itemsPerPage = 12
  const [searchInput, setSearchInput] = useState('')
  const [showViewAllModal, setShowViewAllModal] = useState(false)
  const [viewAllCards, setViewAllCards] = useState([])
  
  // API data state
  const [clients, setClients] = useState([])
  const [totals, setTotals] = useState({})
  const [totalClients, setTotalClients] = useState(0)
  const [cards, setCards] = useState([])
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now())

  // Available columns for the table
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    name: true,
    lastName: false,
    middleName: false,
    email: false,
    phone: true,
    group: false,
    country: false,
    city: false,
    state: false,
    address: false,
    zipCode: false,
    clientID: false,
    balance: false,
    credit: true,
    equity: true,
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
  const [columnSearchQuery, setColumnSearchQuery] = useState('')

  // Fetch clients data via API
  const fetchClients = useCallback(async () => {
    try {
      const fetchTime = new Date().toLocaleTimeString()
      console.log('🔄 Fetching clients at:', fetchTime)
      
      // Use searchClients to get totals data (same as Client2Page desktop)
      const response = await brokerAPI.searchClients({
        page: 1,
        limit: 100
      })
      
      console.log('Client2Module API Response:', response)
      
      // Extract data from response.data.data structure
      const responseData = response?.data || {}
      const data = responseData?.data || responseData
      const t = data.totals || {}
      
      console.log('Response Data:', responseData)
      console.log('Data:', data)
      console.log('Totals:', t)
      
      setClients(data.clients || [])
      setTotals(t)
      setTotalClients(data.total || data.totalClients || data.clients?.length || 0)
      setLastUpdateTime(Date.now())
      
      const updateTime = new Date().toLocaleTimeString()
      console.log('✅ Cards updated at:', updateTime, 'Balance:', t.balance, 'Equity:', t.equity)
      
      // Update face cards directly from API response
      setCards([
        { label: 'Total Clients', value: formatNum(data.total || 0) },
        { label: 'Assets', value: formatNum(t.assets || 0) },
        { label: 'Balance', value: formatNum(t.balance || 0) },
        { label: 'Blocked Commission', value: formatNum(t.blockedCommission || 0) },
        { label: 'Blocked Profit', value: formatNum(t.blockedProfit || 0) },
        { label: 'Commission', value: formatNum(t.commission || 0) },
        { label: 'Credit', value: formatNum(t.credit || 0) },
        { label: 'Daily Bonus In', value: formatNum(t.dailyBonusIn || 0) },
        { label: 'Daily Bonus Out', value: formatNum(t.dailyBonusOut || 0) },
        { label: 'Daily Credit In', value: formatNum(t.dailyCreditIn || 0) },
        { label: 'Daily Credit Out', value: formatNum(t.dailyCreditOut || 0) },
        { label: 'Daily Deposit', value: formatNum(t.dailyDeposit || 0) },
        { label: 'Daily P&L', value: formatNum(t.dailyPnL || 0) },
        { label: 'Daily SO Compensation In', value: formatNum(t.dailySOCompensationIn || 0) },
        { label: 'Daily SO Compensation Out', value: formatNum(t.dailySOCompensationOut || 0) },
        { label: 'Daily Withdrawal', value: formatNum(t.dailyWithdrawal || 0) },
        { label: 'Daily Net D/W', value: formatNum((t.dailyDeposit || 0) - (t.dailyWithdrawal || 0)) },
        { label: 'NET Daily Bonus', value: formatNum((t.dailyBonusIn || 0) - (t.dailyBonusOut || 0)) },
        { label: 'Equity', value: formatNum(t.equity || 0) },
        { label: 'Floating P/L', value: formatNum(t.floating || 0) },
        { label: 'Liabilities', value: formatNum(t.liabilities || 0) },
        { label: 'Lifetime Bonus In', value: formatNum(t.lifetimeBonusIn || 0) },
        { label: 'Lifetime Bonus Out', value: formatNum(t.lifetimeBonusOut || 0) },
        { label: 'Lifetime Credit In', value: formatNum(t.lifetimeCreditIn || 0) },
        { label: 'Lifetime Credit Out', value: formatNum(t.lifetimeCreditOut || 0) },
        { label: 'Lifetime Deposit', value: formatNum(t.lifetimeDeposit || 0) },
        { label: 'Lifetime P&L', value: formatNum(t.lifetimePnL || 0) },
        { label: 'Lifetime SO Compensation In', value: formatNum(t.lifetimeSOCompensationIn || 0) },
        { label: 'Lifetime SO Compensation Out', value: formatNum(t.lifetimeSOCompensationOut || 0) },
        { label: 'Lifetime Withdrawal', value: formatNum(t.lifetimeWithdrawal || 0) },
        { label: 'Margin', value: formatNum(t.margin || 0) },
        { label: 'Margin Free', value: formatNum(t.marginFree || 0) },
        { label: 'Margin Initial', value: formatNum(t.marginInitial || 0) },
        { label: 'Margin Level', value: formatNum(t.marginLevel || 0) },
        { label: 'Margin Maintenance', value: formatNum(t.marginMaintenance || 0) },
        { label: 'P&L', value: formatNum(t.pnl || 0) },
        { label: 'Previous Equity', value: formatNum(t.previousEquity || 0) },
        { label: 'Profit', value: formatNum(t.profit || 0) },
        { label: 'SO Equity', value: formatNum(t.soEquity || 0) },
        { label: 'SO Level', value: formatNum(t.soLevel || 0) },
        { label: 'SO Margin', value: formatNum(t.soMargin || 0) },
        { label: 'Storage', value: formatNum(t.storage || 0) },
        { label: 'This Month Bonus In', value: formatNum(t.thisMonthBonusIn || 0) },
        { label: 'This Month Bonus Out', value: formatNum(t.thisMonthBonusOut || 0) },
        { label: 'This Month Credit In', value: formatNum(t.thisMonthCreditIn || 0) },
        { label: 'This Month Credit Out', value: formatNum(t.thisMonthCreditOut || 0) },
        { label: 'This Month Deposit', value: formatNum(t.thisMonthDeposit || 0) },
        { label: 'This Month P&L', value: formatNum(t.thisMonthPnL || 0) },
        { label: 'This Month SO Compensation In', value: formatNum(t.thisMonthSOCompensationIn || 0) },
        { label: 'This Month SO Compensation Out', value: formatNum(t.thisMonthSOCompensationOut || 0) },
        { label: 'This Month Withdrawal', value: formatNum(t.thisMonthWithdrawal || 0) },
        { label: 'This Week Bonus In', value: formatNum(t.thisWeekBonusIn || 0) },
        { label: 'This Week Bonus Out', value: formatNum(t.thisWeekBonusOut || 0) },
        { label: 'This Week Credit In', value: formatNum(t.thisWeekCreditIn || 0) },
        { label: 'This Week Credit Out', value: formatNum(t.thisWeekCreditOut || 0) },
        { label: 'This Week Deposit', value: formatNum(t.thisWeekDeposit || 0) },
        { label: 'This Week P&L', value: formatNum(t.thisWeekPnL || 0) },
        { label: 'This Week SO Compensation In', value: formatNum(t.thisWeekSOCompensationIn || 0) },
        { label: 'This Week SO Compensation Out', value: formatNum(t.thisWeekSOCompensationOut || 0) },
        { label: 'This Week Withdrawal', value: formatNum(t.thisWeekWithdrawal || 0) },
        { label: 'NET Week Bonus', value: formatNum((t.thisWeekBonusIn || 0) - (t.thisWeekBonusOut || 0)) },
        { label: 'NET Week DW', value: formatNum((t.thisWeekDeposit || 0) - (t.thisWeekWithdrawal || 0)) },
        { label: 'NET Monthly Bonus', value: formatNum((t.thisMonthBonusIn || 0) - (t.thisMonthBonusOut || 0)) },
        { label: 'NET Monthly DW', value: formatNum((t.thisMonthDeposit || 0) - (t.thisMonthWithdrawal || 0)) },
        { label: 'NET Lifetime Bonus', value: formatNum((t.lifetimeBonusIn || 0) - (t.lifetimeBonusOut || 0)) },
        { label: 'NET Lifetime DW', value: formatNum((t.lifetimeDeposit || 0) - (t.lifetimeWithdrawal || 0)) },
        { label: 'NET Credit', value: formatNum((t.lifetimeCreditIn || 0) - (t.lifetimeCreditOut || 0)) },
        { label: 'Book PnL', value: formatNum((t.lifetimePnL || 0) + (t.floating || 0)) }
      ])
    } catch (error) {
      console.error('Failed to fetch clients:', error)
    }
  }, [])

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchClients()
    const interval = setInterval(fetchClients, 1000) // Refresh every 1 second
    return () => clearInterval(interval)
  }, [fetchClients])

  // Filter clients based on applied filters
  const getFilteredClients = () => {
    if (!Array.isArray(clients)) return []
    let filtered = [...clients]

    // Apply group filter first (if active)
    filtered = filterByActiveGroup(filtered, 'login', 'client2')

    if (filters.hasFloating) {
      filtered = filtered.filter(c => {
        const floating = Number(c.floating || c.profit || 0)
        return Math.abs(floating) >= 0.01
      })
    }

    if (filters.hasCredit) {
      filtered = filtered.filter(c => {
        const credit = Number(c.credit || 0)
        return credit > 0
      })
    }

    if (filters.noDeposit) {
      filtered = filtered.filter(c => {
        const deposit = Number(c.dailyDeposit || c.lifetimeDeposit || 0)
        return deposit === 0
      })
    }

    // Apply IB filter
    if (selectedIB && ibMT5Accounts.length > 0) {
      const ibLogins = new Set(ibMT5Accounts.map(a => String(a)))
      filtered = filtered.filter(c => ibLogins.has(String(c.login)))
    }

    // Apply search filter
    if (searchInput.trim()) {
      const query = searchInput.toLowerCase().trim()
      filtered = filtered.filter(c => {
        return (
          String(c.login || '').toLowerCase().includes(query) ||
          String(c.name || '').toLowerCase().includes(query) ||
          String(c.phone || '').toLowerCase().includes(query) ||
          String(c.email || '').toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }

  const filteredClients = getFilteredClients()

  // Calculate totals for table footer
  const clientStats = {
    totalBalance: filteredClients.reduce((sum, c) => sum + (Number(c.balance) || 0), 0),
    totalCredit: filteredClients.reduce((sum, c) => sum + (Number(c.credit) || 0), 0),
    totalEquity: filteredClients.reduce((sum, c) => sum + (Number(c.equity) || 0), 0),
    totalProfit: filteredClients.reduce((sum, c) => sum + (Number(c.profit) || 0), 0),
    totalMargin: filteredClients.reduce((sum, c) => sum + (Number(c.margin) || 0), 0),
    totalMarginFree: filteredClients.reduce((sum, c) => sum + (Number(c.marginFree) || 0), 0)
  }

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedClients = filteredClients.slice(startIndex, endIndex)

  // Card carousel scroll tracking
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      const cardWidth = 125 + 8
      const scrollLeft = carousel.scrollLeft
      const index = Math.round(scrollLeft / cardWidth)
      setActiveCardIndex(index)
    }

    carousel.addEventListener('scroll', handleScroll)
    return () => carousel.removeEventListener('scroll', handleScroll)
  }, [cards.length])

  // View All handler
  useEffect(() => {
    if (viewAllRef.current) {
      viewAllRef.current.onclick = () => {
        setViewAllCards(cards)
        setShowViewAllModal(true)
      }
    }
  }, [cards])

  // Navigate to next page
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  // Navigate to previous page
  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  // Alternative names for pagination functions used in UI
  const goToPreviousPage = goToPrevPage

  // Export functions
  const exportTableColumns = () => {
    try {
      // Get data from visible columns only
      const headers = visibleColumnsList.map(col => col.label)
      const rows = filteredClients.map(client => {
        return visibleColumnsList.map(col => {
          if (col.key === 'balance' || col.key === 'credit' || col.key === 'equity' || col.key === 'profit' || col.key === 'marginFree' || col.key === 'margin') {
            return formatNum(client[col.key] || 0)
          } else if (col.key === 'name') {
            return client.name || client.fullName || client.clientName || client.email || '-'
          } else if (col.key === 'phone') {
            return client.phone || client.phoneNo || client.phone_number || '-'
          } else {
            return client[col.key] || '-'
          }
        })
      })
      
      // Create CSV
      let csv = headers.join(',') + '\n'
      rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n'
      })
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clients-table-columns-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const exportAllColumns = () => {
    try {
      // Export ALL columns regardless of visibility
      const allColumnKeys = columnConfig.map(col => col)
      const headers = allColumnKeys.map(col => col.label)
      const rows = filteredClients.map(client => {
        return allColumnKeys.map(col => {
          if (col.key === 'balance' || col.key === 'credit' || col.key === 'equity' || col.key === 'profit' || col.key === 'marginFree' || col.key === 'margin') {
            return formatNum(client[col.key] || 0)
          } else if (col.key === 'name') {
            return client.name || client.fullName || client.clientName || client.email || '-'
          } else if (col.key === 'phone') {
            return client.phone || client.phoneNo || client.phone_number || '-'
          } else {
            return client[col.key] || '-'
          }
        })
      })
      
      // Create CSV
      let csv = headers.join(',') + '\n'
      rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n'
      })
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `clients-all-columns-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Table columns configuration
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

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] flex flex-col lg:hidden">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 12h18M3 6h18M3 18h18" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-black">Client 2</h1>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="#9CA3AF"/>
              <path d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20V20" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto py-2">
              <nav className="flex flex-col">
                {[
                  {label:'Dashboard', path:'/dashboard', icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#404040"/></svg>
                  )},
                  {label:'Clients', path:'/client-dashboard-c', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#404040"/><circle cx="16" cy="8" r="3" stroke="#404040"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#404040"/></svg>
                  )},
                  {label:'Client 2', path:'/client2', active:true, icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#1A63BC"/><circle cx="16" cy="8" r="3" stroke="#1A63BC"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#1A63BC"/></svg>
                  )},
                  {label:'Pending Orders', path:'/pending-orders', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><circle cx="12" cy="12" r="2" fill="#404040"/></svg>
                  )},
                  {label:'Margin Level', path:'/margin-level', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 18L10 12L14 16L20 8" stroke="#404040" strokeWidth="2"/></svg>
                  )},
                  {label:'Live Dealing', path:'/live-dealing', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 18 0" stroke="#404040"/><path d="M7 12a5 5 0 0 1 10 0" stroke="#404040"/></svg>
                  )},
                  {label:'Client Percentage', path:'/client-percentage', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6" stroke="#404040"/><circle cx="8" cy="8" r="2" stroke="#404040"/><circle cx="16" cy="16" r="2" stroke="#404040"/></svg>
                  )},
                  {label:'IB Commissions', path:'/ib-commissions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><path d="M12 7v10M8 10h8" stroke="#404040"/></svg>
                  )},
                  {label:'Settings', path:'/settings', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" stroke="#404040"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2" stroke="#404040"/></svg>
                  )},
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => {
                      navigate(item.path)
                      setIsSidebarOpen(false)
                    }}
                    className={`flex items-center gap-3 px-4 h-11 text-[13px] ${item.active ? 'text-[#1A63BC] bg-[#EFF4FB] rounded-lg font-semibold' : 'text-[#404040]'}`}
                  >
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

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
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
                    setIsColumnDropdownOpen(true);
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
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsColumnDropdownOpen(false)}
                    />
                    <div
                      className="absolute top-full left-0 mt-1 w-[160px] bg-white border border-[#ECECEC] rounded-[8px] shadow-[0_0_12px_rgba(75,75,75,0.15)] z-50"
                      onClick={e => e.stopPropagation()}
                    >
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
                  </>
                )}
              </div>
            </div>

            {/* Right side - View All only */}
            <span
              ref={viewAllRef}
              className="text-[#1A63BC] text-[12px] font-semibold leading-[15px] cursor-pointer"
            >
              View All
            </span>
          </div>
        </div>

        {/* Face Cards Carousel */}
        <div className="pb-2 pl-5">
          <div className="text-[10px] text-gray-500 mb-1">
            Last Update: {new Date(lastUpdateTime).toLocaleTimeString()}
          </div>
          <div 
            ref={carouselRef}
            className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory pr-4"
          >
            {cards.map((card, i) => (
              <div 
                key={`${i}-${lastUpdateTime}`}
                draggable="true"
                onDragStart={(e) => e.dataTransfer.setData('cardIndex', i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIndex = parseInt(e.dataTransfer.getData('cardIndex'));
                  if (fromIndex !== i) {
                    const newCards = [...cards];
                    const [movedCard] = newCards.splice(fromIndex, 1);
                    newCards.splice(i, 0, movedCard);
                    // Update state if you have card order state
                  }
                }}
                className="min-w-[125px] w-[125px] h-[45px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0 cursor-move"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">{card.label}</span>
                  <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                      <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-[4px]">
                  <span className={`text-[12.5px] font-bold leading-[13px] tracking-[-0.01em] ${card.value && card.value.includes('-') ? 'text-[#DC2626]' : 'text-[#000000]'}`}>
                    {card.value === '' || card.value === undefined ? '0.00' : card.value}
                  </span>
                  <span className="text-[#4B4B4B] text-[7px] font-normal leading-[9px] uppercase">{card.unit}</span>
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-0 outline-none border-0 text-[11px] text-[#4B4B4B] placeholder:text-[#999999] bg-transparent font-outfit" 
              />
            </div>
            
            {/* Column selector button */}
            <div className="relative" ref={columnSelectorButtonRef}>
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
        </div>

        {/* Table area */}
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
              {paginatedClients.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No clients found</div>
              ) : (
                <>
                  {paginatedClients.map((client, idx) => {
                    const rowData = {};
                    visibleColumnsList.forEach(col => {
                      if (col.key === 'balance' || col.key === 'credit' || col.key === 'equity' || col.key === 'profit' || col.key === 'marginFree' || col.key === 'margin') {
                        rowData[col.key] = formatNum(client[col.key] || 0);
                      } else if (col.key === 'name') {
                        rowData[col.key] = client.name || client.fullName || client.clientName || client.email || '-';
                      } else if (col.key === 'lastName') {
                        rowData[col.key] = client.lastName || client.last_name || '-';
                      } else if (col.key === 'middleName') {
                        rowData[col.key] = client.middleName || client.middle_name || '-';
                      } else if (col.key === 'phone') {
                        rowData[col.key] = client.phone || client.phoneNo || client.phone_number || '-';
                      } else if (col.key === 'zipCode') {
                        rowData[col.key] = client.zipCode || client.zip_code || '-';
                      } else if (col.key === 'clientID') {
                        rowData[col.key] = client.clientID || client.client_id || '-';
                      } else {
                        rowData[col.key] = client[col.key] || '-';
                      }
                    });
                    
                    return (
                      <div key={client.login || idx} className="grid text-[10px] text-[#4B4B4B] font-outfit bg-white border-b border-[#E1E1E1] hover:bg-[#F8FAFC] transition-colors" style={{gap: '0px', gridGap: '0px', columnGap: '0px', gridTemplateColumns}}>
                        {visibleColumnsList.map((col, colIdx) => (
                          <div 
                            key={col.key}
                            className={`h-[38px] flex items-center justify-center px-1 overflow-hidden text-ellipsis whitespace-nowrap ${
                              col.key === 'login' ? 'text-[#1A63BC] font-semibold sticky left-0 bg-white z-10' : ''
                            }`}
                            style={{border: 'none', outline: 'none', boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'}}
                          >
                            {rowData[col.key]}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  
                  {/* Footer row */}
                  <div className="grid bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-semibold border-t-2 border-[#1A63BC]" style={{gap: '0px', gridGap: '0', columnGap: '0', gridTemplateColumns}}>
                    {visibleColumnsList.map((col, idx) => (
                      <div 
                        key={col.key}
                        className={`h-[38px] flex items-center justify-center px-1 ${col.key === 'login' ? 'font-bold sticky left-0 bg-[#EFF4FB] z-10' : ''}`}
                        style={{border: 'none', outline: 'none', boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'}}
                      >
                        {col.key === 'login' ? 'Total' : 
                         col.key === 'balance' ? formatNum(clientStats?.totalBalance || 0) :
                         col.key === 'profit' ? formatNum(clientStats?.totalProfit || 0) :
                         col.key === 'credit' ? formatNum(clientStats?.totalCredit || 0) :
                         col.key === 'equity' ? formatNum(clientStats?.totalEquity || 0) :
                         col.key === 'margin' ? formatNum(clientStats?.totalMargin || 0) :
                         col.key === 'marginFree' ? formatNum(clientStats?.totalMarginFree || 0) :
                         ''}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customize View Bottom Sheet */}
      {isCustomizeOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/35" onClick={() => setIsCustomizeOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full mx-auto mt-2" />
            <div className="px-4 py-3 flex items-center justify-between border-t border-[#F0F0F0]">
              <button onClick={() => setIsCustomizeOpen(false)} className="w-9 h-9 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <div className="text-[16px] font-semibold text-[#111827]">Customize view</div>
              <div className="w-9 h-9" />
            </div>
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
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsGroupOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M17 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M3 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Groups</span>
                </button>
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsLoginGroupsOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="8" height="6" rx="1" stroke="#1F2937"/><rect x="13" y="5" width="8" height="6" rx="1" stroke="#1F2937"/><rect x="3" y="13" width="8" height="6" rx="1" stroke="#1F2937"/><rect x="13" y="13" width="8" height="6" rx="1" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Login Groups</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(newFilters) => {
          setFilters(newFilters)
          setIsFilterOpen(false)
        }}
        filters={filters}
      />

      {/* IB Filter Modal */}
      <IBFilterModal
        isOpen={isIBFilterOpen}
        onClose={() => setIsIBFilterOpen(false)}
      />

      {/* Group Modal */}
      <GroupModal
        isOpen={isGroupOpen}
        onClose={() => setIsGroupOpen(false)}
        availableItems={clients}
        loginField="login"
        displayField="name"
      />

      {/* Login Groups Modal */}
      <LoginGroupsModal
        isOpen={isLoginGroupsOpen}
        onClose={() => setIsLoginGroupsOpen(false)}
        groups={groups.map(g => ({
          ...g,
          loginCount: g.range 
            ? (g.range.to - g.range.from + 1) 
            : g.loginIds.length
        }))}
        activeGroupName={getActiveGroupFilter('client2')}
        onSelectGroup={(group) => {
          if (group === null) {
            setActiveGroupFilter('client2', null)
          } else {
            setActiveGroupFilter('client2', group.name)
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

      {/* Login Group Modal (Create/Edit) */}
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

      {/* Column Selector Modal */}
      {isColumnSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setIsColumnSelectorOpen(false)}>
          <div
            className="w-full bg-white rounded-t-[24px] max-h-[80vh] overflow-hidden flex flex-col animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
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
                'Profit': 'profit',
                'PnL': 'pnl',
                'Currency': 'currency',
                'Currency Digits': 'currencyDigits',
                'Applied Percentage': 'applied_percentage',
                'Applied Percentage Custom': 'applied_percentage_is_custom',
                'Assets': 'assets',
                'Liabilities': 'liabilities',
                'Blocked Commission': 'blockedCommission',
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
                'This Week PnL': 'thisWeekPnL',
              }).map(([label, key]) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0 cursor-pointer"
                  onClick={() => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <span className="text-base text-gray-800 font-outfit">{label}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))}}
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

            <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => {
                  setVisibleColumns({
                    login: true,
                    name: true,
                    lastName: false,
                    middleName: false,
                    email: false,
                    phone: true,
                    group: false,
                    country: false,
                    city: false,
                    state: false,
                    address: false,
                    zipCode: false,
                    clientID: false,
                    balance: false,
                    credit: true,
                    equity: true,
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

      {/* View All Modal */}
      {showViewAllModal && (
        <div className="fixed inset-0 bg-[#F5F5F5] z-50 overflow-y-auto">
          <div className="sticky top-0 bg-white shadow-md z-10">
            <div className="px-4 py-5 flex items-center justify-between">
              <button onClick={() => setShowViewAllModal(false)} className="w-9 h-9 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-black">Client 2 Matrices</h1>
              <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" fill="#9CA3AF"/>
                  <path d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20V20" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-[#E8EEF5] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>Drag cards to reorder</span>
            </div>
            <button 
              onClick={() => setViewAllCards(cards)}
              className="text-blue-600 text-sm font-medium"
            >
              Reset order
            </button>
          </div>

          <div className="p-3 space-y-2">
            {viewAllCards.map((card, i) => (
              <div
                key={i}
                draggable="true"
                onDragStart={(e) => e.dataTransfer.setData('cardIndex', i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIndex = parseInt(e.dataTransfer.getData('cardIndex'));
                  if (fromIndex !== i) {
                    const newCards = [...viewAllCards];
                    const [movedCard] = newCards.splice(fromIndex, 1);
                    newCards.splice(i, 0, movedCard);
                    setViewAllCards(newCards);
                  }
                }}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-move active:scale-95 transition-transform"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-600 uppercase mb-1">{card.label}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold ${card.value && card.value.toString().includes('-') ? 'text-red-600' : 'text-black'}`}>
                        {card.value === '' || card.value === undefined ? '0.00' : card.value}
                      </span>
                      {card.value && !card.value.toString().includes('-') && card.value !== '0' && card.value !== '0.00' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-green-500">
                          <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      {card.value && card.value.toString().includes('-') && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-red-500">
                          <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
                      <rect x="14" y="3" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
                      <rect x="3" y="14" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
                      <rect x="14" y="14" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
