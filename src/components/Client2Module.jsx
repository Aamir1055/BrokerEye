import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import ClientDetailsMobileModal from './ClientDetailsMobileModal'
import { useIB } from '../contexts/IBContext'
import { useGroups } from '../contexts/GroupContext'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Client2Module() {
  const navigate = useNavigate()
  const { positions: cachedPositions } = useData()
  const { selectedIB, ibMT5Accounts, selectIB, clearIBSelection } = useIB()
  const { groups, deleteGroup, getActiveGroupFilter, setActiveGroupFilter, filterByActiveGroup, activeGroupFilters } = useGroups()
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
  const [selectedClient, setSelectedClient] = useState(null)
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const columnDropdownRef = useRef(null)
  const columnSelectorButtonRef = useRef(null)
  const [filters, setFilters] = useState({ hasFloating: false, hasCredit: false, noDeposit: false })
  const viewAllRef = useRef(null)
  const itemsPerPage = 12
  const [searchInput, setSearchInput] = useState('')
  const [showViewAllModal, setShowViewAllModal] = useState(false)
  // Persistent card order for mobile face cards
  const [cardOrder, setCardOrder] = useState([])
  const CARD_ORDER_KEY = 'client2-module-order'
  const [dragStartLabel, setDragStartLabel] = useState(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [touchDragIndex, setTouchDragIndex] = useState(null)
  const [touchStartX, setTouchStartX] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const scrollContainerRef = useRef(null)
  const [columnSearchQuery, setColumnSearchQuery] = useState('')

  // Function to swap card order
  const swapOrder = (fromLabel, toLabel) => {
    const fromIndex = cardOrder.findIndex(label => label === fromLabel)
    const toIndex = cardOrder.findIndex(label => label === toLabel)
    
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      const newOrder = [...cardOrder]
      const [moved] = newOrder.splice(fromIndex, 1)
      newOrder.splice(toIndex, 0, moved)
      setCardOrder(newOrder)
      try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder)) } catch {}
    }
  }

  // API data state (restored)
  const [clients, setClients] = useState([])
  const [totals, setTotals] = useState({})
  const [totalClients, setTotalClients] = useState(0)
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now())
  // Visible columns state (restored)
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
    marginFree: true,
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

  // Fetch clients data via API
  const fetchClients = useCallback(async (overridePercent = null) => {
    try {
      const usePercent = overridePercent !== null ? overridePercent : showPercent
      // Check if any filter is active to determine if we need all data
      const hasActiveFilters = filters.hasFloating || filters.hasCredit || filters.noDeposit || 
                               selectedIB || getActiveGroupFilter('client2')
      
      // Build payload
      const payload = {
        page: hasActiveFilters ? 1 : currentPage,
        limit: hasActiveFilters ? 10000 : 100,
        percentage: usePercent
      }

      // Add group filter to payload if active
      const activeGroupName = getActiveGroupFilter('client2')
      if (activeGroupName && groups && groups.length > 0) {
        const activeGroup = groups.find(g => g.name === activeGroupName)
        if (activeGroup) {
          if (activeGroup.range) {
            // Range-based group
            payload.accountRangeMin = activeGroup.range.from
            payload.accountRangeMax = activeGroup.range.to
          } else if (activeGroup.loginIds && activeGroup.loginIds.length > 0) {
            // Manual selection group
            payload.mt5Accounts = activeGroup.loginIds.map(id => String(id))
          }
        }
      }

      // Add IB filter to payload if active
      if (selectedIB && ibMT5Accounts && ibMT5Accounts.length > 0) {
        if (payload.mt5Accounts && payload.mt5Accounts.length > 0) {
          // Intersect with group filter if both exist
          const groupSet = new Set(payload.mt5Accounts)
          payload.mt5Accounts = ibMT5Accounts.filter(id => groupSet.has(String(id))).map(id => String(id))
        } else {
          payload.mt5Accounts = ibMT5Accounts.map(id => String(id))
        }
      }
      
      // Use searchClients to get totals data with percentage parameter
      const response = await brokerAPI.searchClients(payload)
      
      // Extract data from response.data.data structure
      const responseData = response?.data || {}
      const data = responseData?.data || responseData
      const t = data.totals || {}
      
      setClients(data.clients || [])
      setTotals(t)
      setTotalClients(data.total || data.totalClients || data.clients?.length || 0)
      setLastUpdateTime(Date.now())
      
      // Cards are now computed via useMemo based on filtered clients
    } catch (error) {
      console.error('Failed to fetch clients:', error)
    }
  }, [showPercent, filters, selectedIB, ibMT5Accounts, getActiveGroupFilter, groups, currentPage])

  // Initial fetch and periodic refresh every 1 second (matching desktop)
  useEffect(() => {
    fetchClients()
    const interval = setInterval(fetchClients, 1000) // Refresh every 1 second
    return () => clearInterval(interval)
  }, [fetchClients])

  // Filter clients based on applied filters
  const getFilteredClients = () => {
    if (!Array.isArray(clients)) return []
    let filtered = [...clients]

    // Apply group filter first (if active) - use login field
    filtered = filterByActiveGroup(filtered, 'login', 'client2')

    // Has Floating: show clients where profit field (Floating Profit column) has a value (not blank/null/0)
    if (filters.hasFloating) {
      filtered = filtered.filter(c => {
        const profit = c.profit
        // Only show if profit exists and is not 0 (can be positive or negative)
        return profit != null && profit !== '' && Number(profit) !== 0
      })
    }

    // Has Credit: show clients where credit > 0
    if (filters.hasCredit) {
      filtered = filtered.filter(c => {
        const credit = c.credit
        // Only show if credit exists and is greater than 0
        return credit != null && credit !== '' && Number(credit) > 0
      })
    }

    // No Deposit: show clients where lifetimeDeposit is 0
    if (filters.noDeposit) {
      filtered = filtered.filter(c => {
        const lifetimeDeposit = Number(c.lifetimeDeposit || 0)
        return lifetimeDeposit === 0
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

  // Calculate cards from filtered clients (when filters active) or API totals (when no filters)
  const cards = useMemo(() => {
    // Check if any filter is active
    const hasBasicFilters = Object.values(filters).some(f => f)
    const hasIBFilter = selectedIB && Array.isArray(ibMT5Accounts) && ibMT5Accounts.length > 0
    const hasGroupFilter = getActiveGroupFilter('client2') != null
    const isFiltered = hasBasicFilters || hasIBFilter || hasGroupFilter || (searchInput && searchInput.trim().length > 0)
    
    // If filtered, calculate from filteredClients; otherwise use API totals
    if (isFiltered && Array.isArray(filteredClients) && filteredClients.length > 0) {
      const sum = (key) => filteredClients.reduce((acc, c) => {
        const v = c[key]
        if (v == null) return acc
        if (typeof v === 'number' && Number.isFinite(v)) return acc + v
        const n = Number(v)
        return acc + (Number.isFinite(n) ? n : 0)
      }, 0)
      
      const filteredCount = filteredClients.length
      const addPercent = (label) => showPercent ? `${label} %` : label
      const t = {
        assets: sum('assets'),
        balance: sum('balance'),
        credit: sum('credit'),
        equity: sum('equity'),
        floating: sum('profit'),
        profit: sum('profit'),
        margin: sum('margin'),
        marginFree: sum('marginFree'),
        dailyDeposit: sum('dailyDeposit'),
        dailyWithdrawal: sum('dailyWithdrawal'),
        dailyPnL: sum('dailyPnL'),
        lifetimeDeposit: sum('lifetimeDeposit'),
        lifetimeWithdrawal: sum('lifetimeWithdrawal'),
        lifetimePnL: sum('lifetimePnL')
      }
      
      // Return cards based on filtered data
      return [
        { label: 'Total Clients', value: formatNum(filteredCount), unit: 'Count', numericValue: filteredCount },
        { label: addPercent('Assets'), value: formatNum(t.assets), unit: 'USD', numericValue: t.assets },
        { label: addPercent('Balance'), value: formatNum(t.balance), unit: 'USD', numericValue: t.balance },
        { label: addPercent('Credit'), value: formatNum(t.credit), unit: 'USD', numericValue: t.credit },
        { label: addPercent('Equity'), value: formatNum(t.equity), unit: 'USD', numericValue: t.equity },
        { label: addPercent('Floating P/L'), value: formatNum(t.floating), unit: 'USD', numericValue: t.floating },
        { label: addPercent('Profit'), value: formatNum(t.profit), unit: 'USD', numericValue: t.profit },
        { label: addPercent('Margin'), value: formatNum(t.margin), unit: 'USD', numericValue: t.margin },
        { label: addPercent('Margin Free'), value: formatNum(t.marginFree), unit: 'USD', numericValue: t.marginFree },
        { label: addPercent('Daily Deposit'), value: formatNum(t.dailyDeposit), unit: 'USD', numericValue: t.dailyDeposit },
        { label: addPercent('Daily Withdrawal'), value: formatNum(t.dailyWithdrawal), unit: 'USD', numericValue: t.dailyWithdrawal },
        { label: addPercent('Daily Net D/W'), value: formatNum(t.dailyDeposit - t.dailyWithdrawal), unit: 'USD', numericValue: t.dailyDeposit - t.dailyWithdrawal },
        { label: addPercent('Daily P&L'), value: formatNum(t.dailyPnL), unit: 'USD', numericValue: t.dailyPnL },
        { label: addPercent('Lifetime Deposit'), value: formatNum(t.lifetimeDeposit), unit: 'USD', numericValue: t.lifetimeDeposit },
        { label: addPercent('Lifetime Withdrawal'), value: formatNum(t.lifetimeWithdrawal), unit: 'USD', numericValue: t.lifetimeWithdrawal },
        { label: addPercent('NET Lifetime DW'), value: formatNum(t.lifetimeDeposit - t.lifetimeWithdrawal), unit: 'USD', numericValue: t.lifetimeDeposit - t.lifetimeWithdrawal },
        { label: addPercent('Lifetime P&L'), value: formatNum(t.lifetimePnL), unit: 'USD', numericValue: t.lifetimePnL },
        { label: addPercent('Book PnL'), value: formatNum(t.lifetimePnL + t.floating), unit: 'USD', numericValue: t.lifetimePnL + t.floating }
      ]
    }
    
    // No filters, use API totals - when percentage mode is active, all monetary fields show %
    const t = totals || {}
    const addPercent = (label) => showPercent ? `${label} %` : label
    
    return [
      { label: 'Total Clients', value: formatNum(totalClients), unit: 'Count', numericValue: totalClients },
      { label: addPercent('Assets'), value: formatNum(t.assets || 0), unit: 'USD', numericValue: t.assets || 0 },
      { label: addPercent('Balance'), value: formatNum(t.balance || 0), unit: 'USD', numericValue: t.balance || 0 },
      { label: addPercent('Blocked Commission'), value: formatNum(t.blockedCommission || 0), unit: 'USD', numericValue: t.blockedCommission || 0 },
      { label: addPercent('Blocked Profit'), value: formatNum(t.blockedProfit || 0), unit: 'USD', numericValue: t.blockedProfit || 0 },
      { label: addPercent('Commission'), value: formatNum(t.commission || 0), unit: 'USD', numericValue: t.commission || 0 },
      { label: addPercent('Credit'), value: formatNum(t.credit || 0), unit: 'USD', numericValue: t.credit || 0 },
      { label: addPercent('Daily Bonus In'), value: formatNum(t.dailyBonusIn || 0), unit: 'USD', numericValue: t.dailyBonusIn || 0 },
      { label: addPercent('Daily Bonus Out'), value: formatNum(t.dailyBonusOut || 0), unit: 'USD', numericValue: t.dailyBonusOut || 0 },
      { label: addPercent('Daily Credit In'), value: formatNum(t.dailyCreditIn || 0), unit: 'USD', numericValue: t.dailyCreditIn || 0 },
      { label: addPercent('Daily Credit Out'), value: formatNum(t.dailyCreditOut || 0), unit: 'USD', numericValue: t.dailyCreditOut || 0 },
      { label: addPercent('Daily Deposit'), value: formatNum(t.dailyDeposit || 0), unit: 'USD', numericValue: t.dailyDeposit || 0 },
      { label: addPercent('Daily P&L'), value: formatNum(t.dailyPnL || 0), unit: 'USD', numericValue: t.dailyPnL || 0 },
      { label: addPercent('Daily SO Compensation In'), value: formatNum(t.dailySOCompensationIn || 0), unit: 'USD', numericValue: t.dailySOCompensationIn || 0 },
      { label: addPercent('Daily SO Compensation Out'), value: formatNum(t.dailySOCompensationOut || 0), unit: 'USD', numericValue: t.dailySOCompensationOut || 0 },
      { label: addPercent('Daily Withdrawal'), value: formatNum(t.dailyWithdrawal || 0), unit: 'USD', numericValue: t.dailyWithdrawal || 0 },
      { label: addPercent('Daily Net D/W'), value: formatNum((t.dailyDeposit || 0) - (t.dailyWithdrawal || 0)), unit: 'USD', numericValue: (t.dailyDeposit || 0) - (t.dailyWithdrawal || 0) },
      { label: addPercent('NET Daily Bonus'), value: formatNum((t.dailyBonusIn || 0) - (t.dailyBonusOut || 0)), unit: 'USD', numericValue: (t.dailyBonusIn || 0) - (t.dailyBonusOut || 0) },
      { label: addPercent('Equity'), value: formatNum(t.equity || 0), unit: 'USD', numericValue: t.equity || 0 },
      { label: addPercent('Floating P/L'), value: formatNum(t.floating || 0), unit: 'USD', numericValue: t.floating || 0 },
      { label: addPercent('Liabilities'), value: formatNum(t.liabilities || 0), unit: 'USD', numericValue: t.liabilities || 0 },
      { label: addPercent('Lifetime Bonus In'), value: formatNum(t.lifetimeBonusIn || 0), unit: 'USD', numericValue: t.lifetimeBonusIn || 0 },
      { label: addPercent('Lifetime Bonus Out'), value: formatNum(t.lifetimeBonusOut || 0), unit: 'USD', numericValue: t.lifetimeBonusOut || 0 },
      { label: addPercent('Lifetime Credit In'), value: formatNum(t.lifetimeCreditIn || 0), unit: 'USD', numericValue: t.lifetimeCreditIn || 0 },
      { label: addPercent('Lifetime Credit Out'), value: formatNum(t.lifetimeCreditOut || 0), unit: 'USD', numericValue: t.lifetimeCreditOut || 0 },
      { label: addPercent('Lifetime Deposit'), value: formatNum(t.lifetimeDeposit || 0), unit: 'USD', numericValue: t.lifetimeDeposit || 0 },
      { label: addPercent('Lifetime P&L'), value: formatNum(t.lifetimePnL || 0), unit: 'USD', numericValue: t.lifetimePnL || 0 },
      { label: addPercent('Lifetime SO Compensation In'), value: formatNum(t.lifetimeSOCompensationIn || 0), unit: 'USD', numericValue: t.lifetimeSOCompensationIn || 0 },
      { label: addPercent('Lifetime SO Compensation Out'), value: formatNum(t.lifetimeSOCompensationOut || 0), unit: 'USD', numericValue: t.lifetimeSOCompensationOut || 0 },
      { label: addPercent('Lifetime Withdrawal'), value: formatNum(t.lifetimeWithdrawal || 0), unit: 'USD', numericValue: t.lifetimeWithdrawal || 0 },
      { label: addPercent('Margin'), value: formatNum(t.margin || 0), unit: 'USD', numericValue: t.margin || 0 },
      { label: addPercent('Margin Free'), value: formatNum(t.marginFree || 0), unit: 'USD', numericValue: t.marginFree || 0 },
      { label: addPercent('Margin Initial'), value: formatNum(t.marginInitial || 0), unit: 'USD', numericValue: t.marginInitial || 0 },
      { label: addPercent('Margin Level'), value: formatNum(t.marginLevel || 0), unit: showPercent ? 'USD' : '%', numericValue: t.marginLevel || 0 },
      { label: addPercent('Margin Maintenance'), value: formatNum(t.marginMaintenance || 0), unit: 'USD', numericValue: t.marginMaintenance || 0 },
      { label: addPercent('P&L'), value: formatNum(t.pnl || 0), unit: 'USD', numericValue: t.pnl || 0 },
      { label: addPercent('Previous Equity'), value: formatNum(t.previousEquity || 0), unit: 'USD', numericValue: t.previousEquity || 0 },
      { label: addPercent('Profit'), value: formatNum(t.profit || 0), unit: 'USD', numericValue: t.profit || 0 },
      { label: addPercent('SO Equity'), value: formatNum(t.soEquity || 0), unit: 'USD', numericValue: t.soEquity || 0 },
      { label: addPercent('SO Level'), value: formatNum(t.soLevel || 0), unit: showPercent ? 'USD' : '%', numericValue: t.soLevel || 0 },
      { label: addPercent('SO Margin'), value: formatNum(t.soMargin || 0), unit: 'USD', numericValue: t.soMargin || 0 },
      { label: addPercent('Storage'), value: formatNum(t.storage || 0), unit: 'USD', numericValue: t.storage || 0 },
      { label: addPercent('This Month Bonus In'), value: formatNum(t.thisMonthBonusIn || 0), unit: 'USD', numericValue: t.thisMonthBonusIn || 0 },
      { label: addPercent('This Month Bonus Out'), value: formatNum(t.thisMonthBonusOut || 0), unit: 'USD', numericValue: t.thisMonthBonusOut || 0 },
      { label: addPercent('This Month Credit In'), value: formatNum(t.thisMonthCreditIn || 0), unit: 'USD', numericValue: t.thisMonthCreditIn || 0 },
      { label: addPercent('This Month Credit Out'), value: formatNum(t.thisMonthCreditOut || 0), unit: 'USD', numericValue: t.thisMonthCreditOut || 0 },
      { label: addPercent('This Month Deposit'), value: formatNum(t.thisMonthDeposit || 0), unit: 'USD', numericValue: t.thisMonthDeposit || 0 },
      { label: addPercent('This Month P&L'), value: formatNum(t.thisMonthPnL || 0), unit: 'USD', numericValue: t.thisMonthPnL || 0 },
      { label: addPercent('This Month SO Compensation In'), value: formatNum(t.thisMonthSOCompensationIn || 0), unit: 'USD', numericValue: t.thisMonthSOCompensationIn || 0 },
      { label: addPercent('This Month SO Compensation Out'), value: formatNum(t.thisMonthSOCompensationOut || 0), unit: 'USD', numericValue: t.thisMonthSOCompensationOut || 0 },
      { label: addPercent('This Month Withdrawal'), value: formatNum(t.thisMonthWithdrawal || 0), unit: 'USD', numericValue: t.thisMonthWithdrawal || 0 },
      { label: addPercent('This Week Bonus In'), value: formatNum(t.thisWeekBonusIn || 0), unit: 'USD', numericValue: t.thisWeekBonusIn || 0 },
      { label: addPercent('This Week Bonus Out'), value: formatNum(t.thisWeekBonusOut || 0), unit: 'USD', numericValue: t.thisWeekBonusOut || 0 },
      { label: addPercent('This Week Credit In'), value: formatNum(t.thisWeekCreditIn || 0), unit: 'USD', numericValue: t.thisWeekCreditIn || 0 },
      { label: addPercent('This Week Credit Out'), value: formatNum(t.thisWeekCreditOut || 0), unit: 'USD', numericValue: t.thisWeekCreditOut || 0 },
      { label: addPercent('This Week Deposit'), value: formatNum(t.thisWeekDeposit || 0), unit: 'USD', numericValue: t.thisWeekDeposit || 0 },
      { label: addPercent('This Week P&L'), value: formatNum(t.thisWeekPnL || 0), unit: 'USD', numericValue: t.thisWeekPnL || 0 },
      { label: addPercent('This Week SO Compensation In'), value: formatNum(t.thisWeekSOCompensationIn || 0), unit: 'USD', numericValue: t.thisWeekSOCompensationIn || 0 },
      { label: addPercent('This Week SO Compensation Out'), value: formatNum(t.thisWeekSOCompensationOut || 0), unit: 'USD', numericValue: t.thisWeekSOCompensationOut || 0 },
      { label: addPercent('This Week Withdrawal'), value: formatNum(t.thisWeekWithdrawal || 0), unit: 'USD', numericValue: t.thisWeekWithdrawal || 0 },
      { label: addPercent('NET Week Bonus'), value: formatNum((t.thisWeekBonusIn || 0) - (t.thisWeekBonusOut || 0)), unit: 'USD', numericValue: (t.thisWeekBonusIn || 0) - (t.thisWeekBonusOut || 0) },
      { label: addPercent('NET Week DW'), value: formatNum((t.thisWeekDeposit || 0) - (t.thisWeekWithdrawal || 0)), unit: 'USD', numericValue: (t.thisWeekDeposit || 0) - (t.thisWeekWithdrawal || 0) },
      { label: addPercent('NET Monthly Bonus'), value: formatNum((t.thisMonthBonusIn || 0) - (t.thisMonthBonusOut || 0)), unit: 'USD', numericValue: (t.thisMonthBonusIn || 0) - (t.thisMonthBonusOut || 0) },
      { label: addPercent('NET Monthly DW'), value: formatNum((t.thisMonthDeposit || 0) - (t.thisMonthWithdrawal || 0)), unit: 'USD', numericValue: (t.thisMonthDeposit || 0) - (t.thisMonthWithdrawal || 0) },
      { label: addPercent('NET Lifetime Bonus'), value: formatNum((t.lifetimeBonusIn || 0) - (t.lifetimeBonusOut || 0)), unit: 'USD', numericValue: (t.lifetimeBonusIn || 0) - (t.lifetimeBonusOut || 0) },
      { label: addPercent('NET Lifetime DW'), value: formatNum((t.lifetimeDeposit || 0) - (t.lifetimeWithdrawal || 0)), unit: 'USD', numericValue: (t.lifetimeDeposit || 0) - (t.lifetimeWithdrawal || 0) },
      { label: addPercent('NET Credit'), value: formatNum((t.lifetimeCreditIn || 0) - (t.lifetimeCreditOut || 0)), unit: 'USD', numericValue: (t.lifetimeCreditIn || 0) - (t.lifetimeCreditOut || 0) },
      { label: addPercent('Book PnL'), value: formatNum((t.lifetimePnL || 0) + (t.floating || 0)), unit: 'USD', numericValue: (t.lifetimePnL || 0) + (t.floating || 0) }
    ]
  }, [filteredClients, totals, totalClients, filters, selectedIB, ibMT5Accounts, getActiveGroupFilter, searchInput, showPercent])

  // Initialize and reconcile saved card order whenever cards change
  useEffect(() => {
    if (!Array.isArray(cards) || cards.length === 0) return
    const labels = Array.from(new Set(cards.map(c => c.label)))
    let saved = []
    try {
      const raw = localStorage.getItem(CARD_ORDER_KEY)
      saved = raw ? JSON.parse(raw) : []
    } catch {}

    let order = Array.isArray(saved) && saved.length > 0
      ? saved.filter(l => labels.includes(l))
      : [...labels]

    // Append any new labels not in saved order
    labels.forEach(l => { if (!order.includes(l)) order.push(l) })

    // If order differs, update state and persist
    const changed = JSON.stringify(order) !== JSON.stringify(cardOrder)
    if (changed) {
      setCardOrder(order)
      try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(order)) } catch {}
    }
  }, [cards])

  // Order cards based on saved order
  const orderedCards = useMemo(() => {
    if (!Array.isArray(cards) || cards.length === 0) return []
    if (!Array.isArray(cardOrder) || cardOrder.length === 0) return cards
    const firstMap = new Map()
    for (const c of cards) { if (!firstMap.has(c.label)) firstMap.set(c.label, c) }
    return cardOrder.map(l => firstMap.get(l)).filter(Boolean)
  }, [cards, cardOrder])

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

  // View All handler
  useEffect(() => {
    if (viewAllRef.current) {
      viewAllRef.current.onclick = () => {
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
                  {label:'Positions', path:'/positions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="3" rx="1" stroke="#404040"/><rect x="3" y="11" width="18" height="3" rx="1" stroke="#404040"/><rect x="3" y="16" width="18" height="3" rx="1" stroke="#404040"/></svg>
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
              <button 
                onClick={() => {
                  localStorage.removeItem('authToken')
                  navigate('/login')
                }}
                className="flex items-center gap-3 px-2 h-10 text-[13px] text-[#404040]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="#404040" strokeWidth="2"/><path d="M4 12h11" stroke="#404040" strokeWidth="2"/></svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                onClick={() => {
                  const next = !showPercent
                  setShowPercent(next)
                  // Immediately refetch with the next percentage state
                  fetchClients(next)
                }}
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
          <div 
            ref={scrollContainerRef}
            className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory pr-4"
          >
            {orderedCards.map((card, i) => (
              <div 
                key={`${card.label}-${lastUpdateTime}`}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', i.toString())
                  e.currentTarget.style.opacity = '0.5'
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = '1'
                  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                  if (!isNaN(fromIndex) && hoverIndex != null && hoverIndex !== fromIndex) {
                    const newOrder = [...cardOrder]
                    const tmp = newOrder[fromIndex]
                    newOrder[fromIndex] = newOrder[hoverIndex]
                    newOrder[hoverIndex] = tmp
                    setCardOrder(newOrder)
                    try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder)) } catch {}
                  }
                  setHoverIndex(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.transform = 'perspective(600px) translateZ(8px) scale(1.06)'
                  e.currentTarget.style.boxShadow = '0px 8px 24px rgba(37, 99, 235, 0.35)'
                  e.currentTarget.style.borderColor = '#93C5FD'
                  setHoverIndex(i)
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0px 0px 12px rgba(75, 75, 75, 0.05)'
                  e.currentTarget.style.borderColor = '#F2F2F7'
                  if (hoverIndex === i) setHoverIndex(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0px 0px 12px rgba(75, 75, 75, 0.05)'
                  e.currentTarget.style.borderColor = '#F2F2F7'
                  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'))
                  const toIndex = i
                  if (fromIndex !== toIndex && !isNaN(fromIndex)) {
                    const newOrder = [...cardOrder]
                    const tmp = newOrder[fromIndex]
                    newOrder[fromIndex] = newOrder[toIndex]
                    newOrder[toIndex] = tmp
                    setCardOrder(newOrder)
                    try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder)) } catch {}
                  }
                  setHoverIndex(null)
                }}
                onTouchStart={(e) => {
                  setTouchDragIndex(i)
                  setTouchStartX(e.touches[0].clientX)
                  setTouchStartY(e.touches[0].clientY)
                  setIsDragging(false)
                }}
                onTouchMove={(e) => {
                  if (touchDragIndex === i && touchStartX !== null && touchStartY !== null) {
                    const touchX = e.touches[0].clientX
                    const touchY = e.touches[0].clientY
                    const diffX = Math.abs(touchX - touchStartX)
                    const diffY = Math.abs(touchY - touchStartY)
                    
                    // Only enter drag mode if vertical hold (minimal vertical movement) 
                    // and significant horizontal movement (press and drag horizontally)
                    if (!isDragging && diffX > 50 && diffY < 15) {
                      setIsDragging(true)
                      if (scrollContainerRef.current) {
                        scrollContainerRef.current.style.overflowX = 'hidden'
                        scrollContainerRef.current.style.touchAction = 'none'
                      }
                      e.currentTarget.style.touchAction = 'none'
                      e.currentTarget.style.transform = 'scale(1.05)'
                      e.currentTarget.style.boxShadow = '0px 8px 24px rgba(37, 99, 235, 0.35)'
                    }
                  }
                }}
                onTouchEnd={(e) => {
                  if (scrollContainerRef.current) {
                    scrollContainerRef.current.style.overflowX = 'auto'
                    scrollContainerRef.current.style.touchAction = 'auto'
                  }
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0px 0px 12px rgba(75, 75, 75, 0.05)'
                  e.currentTarget.style.touchAction = 'pan-x'
                  
                  // Only reorder if we were in drag mode
                  if (isDragging && touchDragIndex !== null && touchStartX !== null) {
                    const touchEndX = e.changedTouches[0].clientX
                    const touchEndY = e.changedTouches[0].clientY
                    
                    // Find which card is at the drop position
                    let dropTargetIndex = null
                    const allCards = scrollContainerRef.current?.children
                    if (allCards) {
                      for (let idx = 0; idx < allCards.length; idx++) {
                        const cardRect = allCards[idx].getBoundingClientRect()
                        if (touchEndX >= cardRect.left && touchEndX <= cardRect.right &&
                            touchEndY >= cardRect.top && touchEndY <= cardRect.bottom) {
                          dropTargetIndex = idx
                          break
                        }
                      }
                    }
                    
                    if (dropTargetIndex !== null && dropTargetIndex !== touchDragIndex) {
                      const fromIndex = touchDragIndex
                      const toIndex = dropTargetIndex
                      
                      const newOrder = [...cardOrder]
                      const [moved] = newOrder.splice(fromIndex, 1)
                      newOrder.splice(toIndex, 0, moved)
                      setCardOrder(newOrder)
                      try { localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder)) } catch {}
                    }
                  }
                  
                  setTouchDragIndex(null)
                  setTouchStartX(null)
                  setTouchStartY(null)
                  setIsDragging(false)
                }}
                style={{
                  boxSizing: 'border-box',
                  minWidth: '125px',
                  width: '125px',
                  height: '60px',
                  background: '#FFFFFF',
                  border: '1px solid #F2F2F7',
                  boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05)',
                  borderRadius: '12px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  scrollSnapAlign: 'start',
                  flexShrink: 0,
                  cursor: 'grab',
                  flex: 'none',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'pan-x'
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.cursor = 'grabbing'
                  e.currentTarget.style.transform = 'scale(0.98)'
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.cursor = 'grab'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pointerEvents: 'none' }}>
                  <span style={{ color: '#4B4B4B', fontSize: '9px', fontWeight: 600, lineHeight: '12px', paddingRight: '4px' }}>{card.label}</span>
                  <div style={{ width: '16px', height: '16px', background: '#2563EB', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                      <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                    </svg>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minHeight: '16px', pointerEvents: 'none' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: '14px',
                    letterSpacing: '-0.01em',
                    color: card.numericValue > 0 ? '#16A34A' : card.numericValue < 0 ? '#DC2626' : '#000000'
                  }}>
                    {card.value === '' || card.value === undefined ? '0.00' : card.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search and action buttons */}
        <div className="pb-3 px-4">
          <div className="flex items-center gap-1">
            {/* Search box - compact, edge-to-edge */}
            <div className="flex-1 min-w-0 h-[32px] bg-[#F5F5F5] border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] px-2 flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
                <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
                <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input 
                placeholder="Search" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-0 outline-none border-0 text-[13px] text-black font-semibold placeholder:text-[#999999] bg-transparent font-outfit" 
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
                            onClick={() => col.key === 'login' && setSelectedClient(client)}
                            className={`h-[38px] flex items-center justify-center px-1 overflow-hidden text-ellipsis whitespace-nowrap ${
                              col.key === 'login' ? 'text-[#1A63BC] font-semibold sticky left-0 bg-white z-10 cursor-pointer hover:underline' : ''
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
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsLoginGroupsOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="8" height="6" rx="1" stroke="#1F2937"/><rect x="13" y="5" width="8" height="6" rx="1" stroke="#1F2937"/><rect x="3" y="13" width="8" height="6" rx="1" stroke="#1F2937"/><rect x="13" y="13" width="8" height="6" rx="1" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Groups</span>
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
        onSelectIB={(ib) => {
          if (ib) {
            selectIB(ib)
          } else {
            clearIBSelection()
          }
          setIsIBFilterOpen(false)
        }}
        currentSelectedIB={selectedIB}
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

            {/* Search Columns Input */}
            <div className="px-6 py-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Columns"
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 bg-gray-100 border-0 rounded-xl text-[13px] text-black font-semibold font-outfit placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 20 20" 
                  fill="none" 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M14 14L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
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
              }).filter(([label]) => 
                !columnSearch || label.toLowerCase().includes(columnSearch.toLowerCase())
              ).map(([label, key]) => (
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
              onClick={() => {
                localStorage.removeItem(CARD_ORDER_KEY);
                setCardOrder([]);
              }}
              className="text-blue-600 text-sm font-medium"
            >
              Reset order
            </button>
          </div>

          <div className="p-3 space-y-2">
            {orderedCards.map((card, index) => (
              <div
                key={card.label}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('cardLabel', card.label)
                  e.currentTarget.style.opacity = '0.5'
                }}
                onDragEnd={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.backgroundColor = '#EFF6FF'
                  e.currentTarget.style.borderColor = '#93C5FD'
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#F3F4F6'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.currentTarget.style.backgroundColor = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#F3F4F6'
                  const fromLabel = e.dataTransfer.getData('cardLabel')
                  if (fromLabel && fromLabel !== card.label) {
                    swapOrder(fromLabel, card.label)
                  }
                }}
                onTouchStart={(e) => {
                  setDragStartLabel(card.label)
                  e.currentTarget.style.transform = 'scale(0.98)'
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                }}
                onTouchMove={(e) => {
                  e.preventDefault()
                  const touch = e.touches[0]
                  const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY)
                  const targetCard = elementAtPoint?.closest('[data-card-label]')
                  
                  // Reset all card backgrounds
                  document.querySelectorAll('[data-card-label]').forEach(el => {
                    el.style.backgroundColor = '#FFFFFF'
                    el.style.borderColor = '#F3F4F6'
                  })
                  
                  // Highlight the card under the touch
                  if (targetCard && targetCard.dataset.cardLabel !== dragStartLabel) {
                    targetCard.style.backgroundColor = '#EFF6FF'
                    targetCard.style.borderColor = '#93C5FD'
                  }
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.backgroundColor = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#F3F4F6'
                  
                  const touch = e.changedTouches[0]
                  const elementAtPoint = document.elementFromPoint(touch.clientX, touch.clientY)
                  const targetCard = elementAtPoint?.closest('[data-card-label]')
                  
                  // Reset all backgrounds
                  document.querySelectorAll('[data-card-label]').forEach(el => {
                    el.style.backgroundColor = '#FFFFFF'
                    el.style.borderColor = '#F3F4F6'
                  })
                  
                  if (targetCard && dragStartLabel && targetCard.dataset.cardLabel !== dragStartLabel) {
                    swapOrder(dragStartLabel, targetCard.dataset.cardLabel)
                  }
                  setDragStartLabel(null)
                }}
                onTouchCancel={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.backgroundColor = '#FFFFFF'
                  e.currentTarget.style.borderColor = '#F3F4F6'
                  setDragStartLabel(null)
                }}
                data-card-label={card.label}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 cursor-move active:scale-95 transition-transform"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-600 uppercase mb-1">{card.label}</div>
                    <div className="flex items-baseline gap-1.5">
                      {card.numericValue > 0 && (
                        <svg width="12" height="12" viewBox="0 0 8 8" className="flex-shrink-0">
                          <polygon points="4,0 8,8 0,8" fill="#16A34A"/>
                        </svg>
                      )}
                      {card.numericValue < 0 && (
                        <svg width="12" height="12" viewBox="0 0 8 8" className="flex-shrink-0">
                          <polygon points="4,8 0,0 8,0" fill="#DC2626"/>
                        </svg>
                      )}
                      {card.numericValue === 0 && (
                        <svg width="12" height="12" viewBox="0 0 8 8" className="flex-shrink-0">
                          <polygon points="4,0 8,8 0,8" fill="#000000"/>
                        </svg>
                      )}
                      <span className={`text-xl font-bold ${card.numericValue > 0 ? 'text-[#16A34A]' : card.numericValue < 0 ? 'text-[#DC2626]' : 'text-black'}`}>
                        {card.value === '' || card.value === undefined ? '0.00' : card.value}
                      </span>
                      <span className="text-gray-600 text-xs font-normal uppercase">{card.unit}</span>
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

      {/* Client Details Mobile Modal */}
      {selectedClient && (
        <ClientDetailsMobileModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          allPositionsCache={cachedPositions}
        />
      )}
    </div>
  )
}
