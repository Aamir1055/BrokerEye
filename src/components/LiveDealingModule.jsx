import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import CustomizeViewModal from './CustomizeViewModal'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import TimeFilterModal from './TimeFilterModal'
import DealsFilterModal from './DealsFilterModal'
import ClientDetailsMobileModal from './ClientDetailsMobileModal'
import { useIB } from '../contexts/IBContext'
import { useGroups } from '../contexts/GroupContext'
import websocketService from '../services/websocket'
import { brokerAPI } from '../services/api'

const formatNum = (n, decimals = 2) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const formatTime = (timestamp) => {
  if (!timestamp) return '-'
  const date = new Date(timestamp * 1000)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export default function LiveDealingModule() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { positions: cachedPositions } = useData()
  const { selectedIB, selectIB, clearIBSelection, filterByActiveIB, ibMT5Accounts } = useIB()
  const { groups, deleteGroup, getActiveGroupFilter, setActiveGroupFilter, filterByActiveGroup, activeGroupFilters } = useGroups()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false)
  const [isDealsFilterOpen, setIsDealsFilterOpen] = useState(false)
  const [isIBFilterOpen, setIsIBFilterOpen] = useState(false)
  const [isGroupOpen, setIsGroupOpen] = useState(false)
  const [isLoginGroupsOpen, setIsLoginGroupsOpen] = useState(false)
  const [isLoginGroupModalOpen, setIsLoginGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [filters, setFilters] = useState({ hasFloating: false, hasCredit: false, noDeposit: false })
  const carouselRef = useRef(null)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Deals state
  const [deals, setDeals] = useState([])
  const [connectionState, setConnectionState] = useState('disconnected')
  const [timeFilter, setTimeFilter] = useState('24h') // '24h', '7d', 'custom'
  const [moduleFilter, setModuleFilter] = useState('both') // 'deal', 'money', 'both'
  const [customFromDate, setCustomFromDate] = useState('')
  const [customToDate, setCustomToDate] = useState('')
  const [appliedFromDate, setAppliedFromDate] = useState('')
  const [appliedToDate, setAppliedToDate] = useState('')
  const [displayMode, setDisplayMode] = useState('value') // 'value', 'percentage', 'both'
  const [showDisplayModeModal, setShowDisplayModeModal] = useState(false)
  
  const [visibleColumns, setVisibleColumns] = useState({
    time: true,
    login: true,
    netType: true,
    netVolume: true,
    averagePrice: true,
    totalProfit: false,
    commission: false,
    storage: false,
    appliedPercentage: false,
    symbol: false,
    action: false,
    deal: false,
    entry: false
  })

  // Listen for global request to open Customize View from child modals
  useEffect(() => {
    const handler = () => {
      setIsFilterOpen(false)
      setIsTimeFilterOpen(false)
      setIsDealsFilterOpen(false)
      setIsIBFilterOpen(false)
      setIsLoginGroupsOpen(false)
      setIsLoginGroupModalOpen(false)
      setIsCustomizeOpen(true)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('openCustomizeView', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('openCustomizeView', handler)
      }
    }
  }, [])

  // Format request text from deal data
  const formatRequestFromDeal = (deal) => {
    const action = deal.action || '-'
    const symbol = deal.symbol || '-'
    const volume = formatNum(deal.volume || 0, 2)
    const price = formatNum(deal.price || 0, 2)
    return `${action} ${volume} ${symbol} at ${price}`
  }

  // Load and save deals cache
  const WS_CACHE_KEY = 'liveDealsWsCache'
  const loadWsCache = () => {
    try {
      const raw = localStorage.getItem(WS_CACHE_KEY)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr : []
    } catch {
      return []
    }
  }
  const saveWsCache = (list) => {
    try {
      localStorage.setItem(WS_CACHE_KEY, JSON.stringify(list))
    } catch {}
  }

  // Fetch deals from API (24h by default)
  const fetchDeals = async () => {
    try {
      let from, to
      
      if (timeFilter === '24h') {
        const nowUTC = Math.floor(Date.now() / 1000)
        to = nowUTC + (12 * 60 * 60) // Add 12 hours buffer
        from = nowUTC - (24 * 60 * 60) // 24 hours ago
      } else if (timeFilter === '7d') {
        const nowUTC = Math.floor(Date.now() / 1000)
        to = nowUTC + (12 * 60 * 60)
        from = nowUTC - (7 * 24 * 60 * 60) // 7 days ago
      } else if (timeFilter === 'custom' && appliedFromDate && appliedToDate) {
        // Parse custom dates and convert to UTC epoch seconds
        const fromDate = new Date(appliedFromDate)
        const toDate = new Date(appliedToDate)
        
        from = Math.floor(fromDate.getTime() / 1000)
        // Add 12 hours to custom 'to' date to capture full day
        to = Math.floor(toDate.getTime() / 1000) + (12 * 60 * 60)
      } else {
        // Default to 24h if custom dates not set
        const nowUTC = Math.floor(Date.now() / 1000)
        to = nowUTC + (12 * 60 * 60)
        from = nowUTC - (24 * 60 * 60)
      }
      
      console.log('[LiveDealingModule] 📅 Fetching deals with time range:', {
        filter: timeFilter,
        from,
        to,
        fromDate: new Date(from * 1000).toISOString(),
        toDate: new Date(to * 1000).toISOString()
      })
      
      const response = await brokerAPI.getAllDeals(from, to, 10000)
      const dealsData = response.data?.deals || response.deals || []
      
      // Transform deals
      const transformedDeals = dealsData.map(deal => ({
        id: deal.deal || deal.id,
        timestamp: deal.time || deal.timestamp,
        login: deal.login,
        rawData: deal
      }))
      
      // Sort newest first
      transformedDeals.sort((a, b) => b.timestamp - a.timestamp)
      
      // Merge with WebSocket cache
      const wsCached = loadWsCache()
      const apiDealIds = new Set(transformedDeals.map(d => d.id))
      const relevantCachedDeals = wsCached.filter(d => {
        if (!d || !d.id) return false
        if (apiDealIds.has(d.id)) return false
        const dealTime = d.timestamp || 0
        return dealTime >= from && dealTime <= to
      })
      
      const merged = [...relevantCachedDeals, ...transformedDeals]
      saveWsCache(relevantCachedDeals.slice(0, 200))
      setDeals(merged)
    } catch (error) {
      console.error('[LiveDealingModule] Error fetching deals:', error)
    }
  }

  // Initial fetch and refetch when time filter changes
  useEffect(() => {
    fetchDeals()
  }, [timeFilter, appliedFromDate, appliedToDate])

  // WebSocket subscription
  useEffect(() => {
    // Subscribe to WebSocket updates
    const handleDealAdded = (data) => {
      const dealData = data.data || data
      const dealEntry = {
        id: dealData.deal || Date.now() + Math.random(),
        timestamp: dealData.time || dealData.timestamp || Math.floor(Date.now() / 1000),
        login: dealData.login,
        rawData: dealData
      }

      setDeals(prevDeals => {
        if (prevDeals.some(d => d.id === dealEntry.id)) return prevDeals
        const updated = [dealEntry, ...prevDeals].slice(0, 1000)
        saveWsCache(updated.slice(0, 200))
        return updated
      })
    }

    const unsubscribeDeals = websocketService.subscribe('deal_added', handleDealAdded)
    const unsubscribeDealCreated = websocketService.subscribe('DEAL_CREATED', handleDealAdded)

    // Get connection state
    const service = websocketService
    if (service.socket?.readyState === WebSocket.OPEN) {
      setConnectionState('connected')
    }

    const handleConnectionState = (event) => {
      setConnectionState(event.detail)
    }
    const unsubscribeConnectionState = websocketService.subscribe('connectionState', handleConnectionState)

    return () => {
      unsubscribeDeals()
      unsubscribeDealCreated()
      unsubscribeConnectionState()
    }
  }, [])

  // Filter deals by time - API already filters, this is just for any WebSocket additions
  const filteredByTime = useMemo(() => {
    // Since we fetch from API with the correct time range, just return all deals
    // WebSocket additions are already filtered to relevant time in the handler
    return deals
  }, [deals])

  // Apply search filter
  const searchedDeals = useMemo(() => {
    if (!searchInput.trim()) return filteredByTime
    const query = searchInput.toLowerCase().trim()
    return filteredByTime.filter(deal => {
      const login = String(deal.login || '').toLowerCase()
      const symbol = String(deal.rawData?.symbol || '').toLowerCase()
      const dealId = String(deal.id || '').toLowerCase()
      
      return login.includes(query) || symbol.includes(query) || dealId.includes(query)
    })
  }, [filteredByTime, searchInput])

  // Filter by module type (deals/money/both)
  const isTradeAction = (action) => {
    const label = String(action || '').toLowerCase()
    return (
      label === 'buy' ||
      label === 'sell' ||
      label.includes('cancel') ||
      label.includes('stop out') ||
      label.includes('tp close') ||
      label.includes('sl close')
    )
  }

  const moduleFilteredDeals = useMemo(() => {
    if (moduleFilter === 'both') return searchedDeals
    return searchedDeals.filter(deal => {
      const action = deal.rawData?.action
      if (moduleFilter === 'deal' && isTradeAction(action)) return true
      if (moduleFilter === 'money' && !isTradeAction(action)) return true
      return false
    })
  }, [searchedDeals, moduleFilter])

  // Apply group filter
  const groupFilteredDeals = useMemo(() => {
    return filterByActiveGroup(moduleFilteredDeals, 'login', 'livedealing')
  }, [moduleFilteredDeals, filterByActiveGroup, activeGroupFilters])

  // Apply IB filter
  const ibFilteredDeals = useMemo(() => {
    return filterByActiveIB(groupFilteredDeals, 'login')
  }, [groupFilteredDeals, filterByActiveIB, selectedIB, ibMT5Accounts])

  // Sort the filtered deals
  const sortedDeals = useMemo(() => {
    if (!sortColumn) return ibFilteredDeals
    
    return [...ibFilteredDeals].sort((a, b) => {
      let aVal, bVal

      switch (sortColumn) {
        case 'time':
          aVal = a.timestamp || 0
          bVal = b.timestamp || 0
          break
        case 'login':
          aVal = a.login || ''
          bVal = b.login || ''
          break
        case 'netType':
          aVal = a.rawData?.action || ''
          bVal = b.rawData?.action || ''
          break
        case 'netVolume':
          aVal = a.rawData?.volume || 0
          bVal = b.rawData?.volume || 0
          break
        case 'averagePrice':
          aVal = a.rawData?.price || 0
          bVal = b.rawData?.price || 0
          break
        case 'totalProfit':
          aVal = a.rawData?.profit || 0
          bVal = b.rawData?.profit || 0
          break
        case 'commission':
          aVal = a.rawData?.commission || 0
          bVal = b.rawData?.commission || 0
          break
        case 'storage':
          aVal = a.rawData?.storage || 0
          bVal = b.rawData?.storage || 0
          break
        case 'symbol':
          aVal = a.rawData?.symbol || ''
          bVal = b.rawData?.symbol || ''
          break
        default:
          aVal = a.rawData?.[sortColumn] || 0
          bVal = b.rawData?.[sortColumn] || 0
      }
      
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      return sortDirection === 'asc' 
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal))
    })
  }, [ibFilteredDeals, sortColumn, sortDirection])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalDeals = sortedDeals.length
    const uniqueLogins = new Set(sortedDeals.map(d => d.login)).size
    const uniqueSymbols = new Set(sortedDeals.map(d => d.rawData?.symbol)).size
    
    return {
      totalDeals,
      uniqueLogins,
      uniqueSymbols,
    }
  }, [sortedDeals])

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Face cards data - use useMemo to avoid infinite loop
  const cards = useMemo(() => {
    const timeLabel = timeFilter === '24h' ? 'DEALS (24H)' : timeFilter === '7d' ? 'DEALS (7D)' : 'DEALS (CUSTOM)'
    return [
      { label: timeLabel, value: String(summaryStats.totalDeals) },
      { label: 'UNIQUE LOGINS', value: String(summaryStats.uniqueLogins) },
      { label: 'SYMBOLS', value: String(summaryStats.uniqueSymbols) }
    ]
  }, [summaryStats, timeFilter])

  // Get visible columns
  const allColumns = [
    { key: 'login', label: 'Login', width: '80px', sticky: true },
    { key: 'time', label: 'Time', width: '80px' },
    { key: 'netType', label: 'Net Type', width: '80px' },
    { key: 'netVolume', label: displayMode === 'percentage' ? 'Net Volume (%)' : displayMode === 'both' ? 'Net Volume (Both)' : 'Net Volume', width: '100px' },
    { key: 'averagePrice', label: 'Average Price', width: '110px' },
    { key: 'totalProfit', label: displayMode === 'percentage' ? 'Total Profit (%)' : displayMode === 'both' ? 'Total Profit (Both)' : 'Total Profit', width: '100px' },
    { key: 'commission', label: displayMode === 'percentage' ? 'Commission (%)' : displayMode === 'both' ? 'Commission (Both)' : 'Commission', width: '100px' },
    { key: 'storage', label: displayMode === 'percentage' ? 'Storage (%)' : displayMode === 'both' ? 'Storage (Both)' : 'Storage', width: '90px' },
    { key: 'appliedPercentage', label: 'Applied %', width: '90px' },
    { key: 'symbol', label: 'Symbol', width: '90px' },
    { key: 'action', label: 'Action', width: '80px' },
    { key: 'deal', label: 'Deal', width: '80px' },
    { key: 'entry', label: 'Entry', width: '80px' }
  ]

  const activeColumns = allColumns.filter(col => visibleColumns[col.key])
  const gridTemplateColumns = activeColumns.map(col => col.width).join(' ')

  // Export to CSV
  const handleExportToCSV = () => {
    try {
      const dataToExport = sortedDeals
      if (!dataToExport || dataToExport.length === 0) {
        alert('No data to export')
        return
      }

      const exportColumns = activeColumns
      const headers = exportColumns.map(col => col.label).join(',')
      
      const rows = dataToExport.map(deal => {
        return exportColumns.map(col => {
          let value = ''
          
          switch(col.key) {
            case 'time':
              value = deal.rawData?.time ? new Date(deal.rawData.time * 1000).toLocaleString() : '-'
              break
            case 'login':
              value = deal.login || '-'
              break
            case 'netType':
              value = deal.rawData?.action || '-'
              break
            case 'netVolume':
              value = displayMode === 'percentage' 
                ? (deal.rawData?.volume_percentage || 0)
                : (deal.rawData?.volume || 0)
              break
            case 'averagePrice':
              value = deal.rawData?.price || 0
              break
            case 'totalProfit':
              value = displayMode === 'percentage'
                ? (deal.rawData?.profit_percentage || 0)
                : (deal.rawData?.profit || 0)
              break
            case 'commission':
              value = displayMode === 'percentage'
                ? (deal.rawData?.commission_percentage || 0)
                : (deal.rawData?.commission || 0)
              break
            case 'storage':
              value = displayMode === 'percentage'
                ? (deal.rawData?.storage_percentage || 0)
                : (deal.rawData?.storage || 0)
              break
            case 'appliedPercentage':
              value = (deal.rawData?.appliedPercentage || 0) + '%'
              break
            case 'symbol':
              value = deal.rawData?.symbol || '-'
              break
            case 'action':
              value = deal.rawData?.action || '-'
              break
            case 'deal':
              value = deal.rawData?.deal || deal.id || '-'
              break
            case 'entry':
              value = deal.rawData?.entry || '-'
              break
            default:
              value = deal.rawData?.[col.key] || '-'
          }
          
          if (typeof value === 'string') {
            value = value.replace(/"/g, '""')
            if (value.includes(',') || value.includes('"')) {
              value = `"${value}"`
            }
          }
          
          return value
        }).join(',')
      }).join('\\n')
      
      const csvContent = headers + '\\n' + rows
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `live_dealing_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[LiveDealingModule] Export failed:', error)
      alert('Export failed. Please try again.')
    }
  }

  const renderCellValue = (deal, key, isSticky = false) => {
    let value = '-'
    
    switch (key) {
      case 'time':
        value = formatTime(deal.timestamp)
        break
      case 'login':
        value = deal.login || '-'
        return (
          <div 
            className={`h-[28px] flex items-center justify-center px-1 cursor-pointer hover:underline text-blue-600 font-semibold ${isSticky ? 'sticky left-0 bg-white z-10' : ''}`}
            style={{
              border: 'none', 
              outline: 'none', 
              boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'
            }}
            onClick={() => setSelectedClient({ login: deal.login, email: deal.email || '' })}
          >
            <span className="truncate">{value}</span>
          </div>
        )
      case 'netType':
        const action = deal.rawData?.action || '-'
        return (
          <div 
            className={`h-[28px] flex items-center justify-center px-1 ${isSticky ? 'sticky left-0 bg-white z-10' : ''}`}
            style={{
              border: 'none', 
              outline: 'none', 
              boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${
              action === 'Buy' ? 'bg-green-100 text-green-700' : 
              action === 'Sell' ? 'bg-red-100 text-red-700' : 
              'bg-gray-100 text-gray-700'
            }`}>
              {action}
            </span>
          </div>
        )
      case 'netVolume':
        if (displayMode === 'both') {
          const volValue = formatNum(deal.rawData?.volume || 0, 2)
          const volPercent = deal.rawData?.volume_percentage != null ? formatNum(deal.rawData.volume_percentage, 2) : '0.00'
          value = `${volValue} (${volPercent}%)`
        } else if (displayMode === 'percentage') {
          value = deal.rawData?.volume_percentage != null ? formatNum(deal.rawData.volume_percentage, 2) : '0.00'
        } else {
          value = formatNum(deal.rawData?.volume || 0, 2)
        }
        break
      case 'averagePrice':
        value = formatNum(deal.rawData?.price || 0, 2)
        break
      case 'totalProfit':
        const profit = deal.rawData?.profit || 0
        let profitValue
        if (displayMode === 'both') {
          const profVal = formatNum(profit, 2)
          const profPercent = deal.rawData?.profit_percentage != null ? formatNum(deal.rawData.profit_percentage, 2) : '0.00'
          profitValue = `${profVal} (${profPercent}%)`
        } else if (displayMode === 'percentage') {
          profitValue = deal.rawData?.profit_percentage != null ? formatNum(deal.rawData.profit_percentage, 2) : '0.00'
        } else {
          profitValue = formatNum(profit, 2)
        }
        return (
          <div 
            className={`h-[28px] flex items-center justify-center px-1 ${isSticky ? 'sticky left-0 bg-white z-10' : ''}`}
            style={{
              border: 'none', 
              outline: 'none', 
              boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
              {profitValue}
            </span>
          </div>
        )
      case 'commission':
        if (displayMode === 'both') {
          const commValue = formatNum(deal.rawData?.commission || 0, 2)
          const commPercent = deal.rawData?.commission_percentage != null ? formatNum(deal.rawData.commission_percentage, 2) : '0.00'
          value = `${commValue} (${commPercent}%)`
        } else if (displayMode === 'percentage') {
          value = deal.rawData?.commission_percentage != null ? formatNum(deal.rawData.commission_percentage, 2) : '0.00'
        } else {
          value = formatNum(deal.rawData?.commission || 0, 2)
        }
        break
      case 'storage':
        if (displayMode === 'both') {
          const storValue = formatNum(deal.rawData?.storage || 0, 2)
          const storPercent = deal.rawData?.storage_percentage != null ? formatNum(deal.rawData.storage_percentage, 2) : '0.00'
          value = `${storValue} (${storPercent}%)`
        } else if (displayMode === 'percentage') {
          value = deal.rawData?.storage_percentage != null ? formatNum(deal.rawData.storage_percentage, 2) : '0.00'
        } else {
          value = formatNum(deal.rawData?.storage || 0, 2)
        }
        break
      case 'appliedPercentage':
        value = formatNum(deal.rawData?.appliedPercentage || 0, 2) + '%'
        break
      case 'symbol':
        value = deal.rawData?.symbol || '-'
        break
      case 'action':
        value = deal.rawData?.action || '-'
        break
      case 'deal':
        value = deal.rawData?.deal || deal.id || '-'
        break
      case 'entry':
        value = deal.rawData?.entry || '-'
        break
      default:
        value = deal.rawData?.[key] || '-'
    }

    return (
      <div 
        className={`h-[28px] flex items-center justify-center px-1 ${isSticky ? 'sticky left-0 bg-white z-10' : ''}`}
        style={{
          border: 'none', 
          outline: 'none', 
          boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'
        }}
      >
        <span className="truncate">{value}</span>
      </div>
    )
  }

  const filteredColumnOptions = allColumns.filter(col =>
    col.label.toLowerCase().includes(columnSearch.toLowerCase())
  )

  return (
    <div className="h-screen flex flex-col bg-[#F8F8F8] overflow-x-hidden overflow-y-hidden max-w-full" style={{ height: '100dvh', width: '100vw', maxWidth: '100vw', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-[#ECECEC]">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="w-12 h-12 rounded-2xl bg-[#F8F8F8] flex items-center justify-center"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-[#000000]">Live Dealing</h1>
        <button 
          onClick={() => navigate('/profile')}
          className="w-12 h-12 rounded-full bg-[#1A63BC] flex items-center justify-center text-white font-semibold text-sm"
        >
          U
        </button>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsSidebarOpen(false)}>
          <div 
            className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-[#ECECEC]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">BE</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#000000]">Broker Eyes</div>
                  <div className="text-xs text-[#404040]">Trading Platform</div>
                </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#404040" strokeWidth="2"/>
                </svg>
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
                  {label:'Client 2', path:'/client2', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#404040"/><circle cx="16" cy="8" r="3" stroke="#404040"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#404040"/></svg>
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
                  {label:'Live Dealing', path:'/live-dealing', active:true, icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 18 0" stroke="#1A63BC"/><path d="M7 12a5 5 0 0 1 10 0" stroke="#1A63BC"/></svg>
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
                    className={`flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      item.active 
                        ? 'bg-[#EFF6FF] border-l-4 border-[#1A63BC]' 
                        : 'hover:bg-[#F8F8F8]'
                    }`}
                  >
                    <div className="flex-shrink-0">{item.icon}</div>
                    <span className={`text-sm ${
                      item.active ? 'text-[#1A63BC] font-semibold' : 'text-[#404040]'
                    }`}>
                      {item.label}
                    </span>
                  </button>
                ))}              </nav>
            </div>

            <div className="p-4 mt-auto border-t border-[#ECECEC]">
              <button onClick={logout} className="flex items-center gap-3 px-2 h-[37px] text-[10px] text-[#404040]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="#404040" strokeWidth="2"/><path d="M4 12h11" stroke="#404040" strokeWidth="2"/></svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ maxWidth: '100vw' }}>
        {/* Action Buttons + View All */}
        <div className="pt-3 pb-2">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex gap-[8px]">
              <button 
                onClick={() => setIsCustomizeOpen(true)} 
                className="h-[37px] px-3 rounded-[12px] bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4.5 6.5H9.5M2.5 3.5H11.5M5.5 9.5H8.5" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[#4B4B4B] text-[10px] font-medium font-outfit">Filter</span>
              </button>
              <button 
                onClick={() => setShowDisplayModeModal(true)}
                className={`h-[37px] px-3 rounded-[12px] border shadow-sm flex items-center justify-center gap-2 transition-all ${
                  displayMode === 'percentage' || displayMode === 'both' ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#E5E7EB] hover:bg-gray-50'
                }`}
              >
                <span className="text-[#4B4B4B] text-[12px] font-medium font-outfit">%</span>
              </button>
              <button 
                onClick={handleExportToCSV}
                className="h-[37px] px-3 rounded-[12px] bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 10V3M7 10L4 7M7 10L10 7M2 11h10" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <button className="text-[#1A63BC] text-sm font-medium">View All</button>
          </div>
        </div>

        {/* Face Cards Carousel */}
        <div className="pb-2 px-4">
          <div 
            ref={carouselRef}
            className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          >
            {cards.map((card, i) => (
              <div 
                key={i}
                draggable="true"
                onDragStart={(e) => {
                  e.dataTransfer.setData('cardIndex', i)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const fromIndex = parseInt(e.dataTransfer.getData('cardIndex'))
                  if (fromIndex !== i && !isNaN(fromIndex)) {
                    const newCards = [...cards]
                    const [movedCard] = newCards.splice(fromIndex, 1)
                    newCards.splice(i, 0, movedCard)
                    setCards(newCards)
                  }
                }}
                className="min-w-[125px] w-[125px] h-[50px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0 cursor-move active:opacity-50 transition-opacity"
              >
                <div className="flex items-start justify-between">
                  <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">{card.label}</span>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0 mt-0.5">
                    <circle cx="6" cy="6" r="5" fill={
                      i === 0 ? '#3B82F6' :
                      i === 1 ? '#10B981' :
                      i === 2 ? '#8B5CF6' :
                      '#F59E0B'
                    } fillOpacity="0.2"/>
                    <circle cx="6" cy="6" r="3" fill={
                      i === 0 ? '#3B82F6' :
                      i === 1 ? '#10B981' :
                      i === 2 ? '#8B5CF6' :
                      '#F59E0B'
                    }/>
                  </svg>
                </div>
                <p className="text-[#000000] text-base font-bold leading-none">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Pagination Controls */}
        <div className="pb-2">
          <div className="flex items-center gap-2 px-2">
            <div className="flex-1 min-w-0 h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center px-2 gap-1">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
                <circle cx="6" cy="6" r="4" stroke="#9CA3AF" strokeWidth="1.5"/>
                <path d="M9 9L12 12" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input 
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search"
                className="flex-1 min-w-0 text-[11px] text-[#000000] placeholder-[#9CA3AF] outline-none bg-transparent font-outfit"
              />
            </div>
            <button 
              onClick={() => setIsColumnSelectorOpen(true)}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="8.5" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="14" y="5" width="3" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
              </svg>
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(sortedDeals.length / itemsPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(sortedDeals.length / itemsPerPage)}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ maxWidth: '100vw', overflow: 'hidden' }}>
          <div className="bg-white shadow-[0_0_12px_rgba(75,75,75,0.05)] overflow-hidden">
            <div className="w-full overflow-x-auto overflow-y-visible" style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: '#CBD5E0 #F7FAFC',
              touchAction: 'pan-x pan-y'
            }}>
              <div className="relative" style={{ minWidth: 'max-content' }}>
                {/* Table Header */}
                <div 
                  className="grid bg-[#1A63BC] text-white text-[10px] font-semibold font-outfit sticky top-0 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.1)]"
                  style={{
                    gap: '0px', 
                    gridGap: '0px', 
                    columnGap: '0px',
                    gridTemplateColumns
                  }}
                >
                  {activeColumns.map(col => (
                    <div 
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`h-[32px] flex items-center justify-center px-1 cursor-pointer hover:bg-[#1557A8] transition-colors select-none ${
                        col.sticky ? 'sticky left-0 z-30 bg-[#1A63BC]' : ''
                      }`}
                      style={{
                        border: 'none',
                        outline: 'none',
                        boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      <span className="truncate">{col.label}</span>
                      {sortColumn === col.key && (
                        <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Table Rows */}
                {sortedDeals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((deal, idx) => (
                  <div 
                    key={idx} 
                    className="grid text-[10px] text-[#4B4B4B] font-outfit bg-white border-b border-[#E1E1E1] hover:bg-[#F8FAFC] transition-colors"
                    style={{
                      gap: '0px', 
                      gridGap: '0px', 
                      columnGap: '0px',
                      gridTemplateColumns
                    }}
                  >
                    {activeColumns.map(col => (
                      <React.Fragment key={`${col.key}-${displayMode}`}>
                        {renderCellValue(deal, col.key, col.sticky)}
                      </React.Fragment>
                    ))}
                  </div>
                ))}

                {/* Empty state */}
                {sortedDeals.length === 0 && (
                  <div className="text-center py-8 text-[#9CA3AF] text-sm">
                    No deals available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Column Selector Modal */}
      {isColumnSelectorOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setIsColumnSelectorOpen(false)}>
          <div 
            className="bg-white w-full rounded-t-[24px] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-semibold text-[#000000]">Select Columns</h3>
              <button onClick={() => setIsColumnSelectorOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="#404040" strokeWidth="2"/>
                </svg>
              </button>
            </div>
            
            <div className="px-5 py-3 border-b border-[#E5E7EB] flex-shrink-0">
              <div className="relative">
                <input 
                  type="text"
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  placeholder="Search columns..."
                  className="w-full h-10 px-4 pr-10 bg-[#F8F8F8] border border-[#ECECEC] rounded-lg text-sm outline-none focus:border-[#1A63BC] transition-colors"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2"/>
                  <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-5 py-2">
              {filteredColumnOptions.map(col => (
                <label 
                  key={col.key}
                  className="flex items-center gap-3 py-3 border-b border-[#F2F2F7] last:border-0 cursor-pointer hover:bg-[#F8F8F8] px-2 rounded transition-colors"
                >
                  <input 
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))}
                    className="w-5 h-5 rounded border-2 border-[#CCCCCC] text-[#1A63BC] focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-sm text-[#000000] font-medium">{col.label}</span>
                </label>
              ))}
            </div>
            
            <div className="px-5 py-4 border-t border-[#E5E7EB] flex gap-3 flex-shrink-0">
              <button 
                onClick={() => setIsColumnSelectorOpen(false)}
                className="flex-1 h-12 rounded-xl bg-[#F8F8F8] text-[#000000] font-semibold text-sm hover:bg-[#ECECEC] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsColumnSelectorOpen(false)}
                className="flex-1 h-12 rounded-xl bg-[#1A63BC] text-white font-semibold text-sm hover:bg-[#1557A8] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      
      {/* CustomizeView Modal */}
      <CustomizeViewModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        onFilterClick={() => {
          setIsCustomizeOpen(false)
          setIsTimeFilterOpen(true)
        }}
        onIBFilterClick={() => {
          setIsCustomizeOpen(false)
          setIsIBFilterOpen(true)
        }}
        onGroupsClick={() => {
          setIsCustomizeOpen(false)
          setIsLoginGroupsOpen(true)
        }}
        onDealsClick={() => {
          setIsCustomizeOpen(false)
          setIsDealsFilterOpen(true)
        }}
        onReset={() => {
          setFilters({ hasFloating: false, hasCredit: false, noDeposit: false })
          clearIBSelection()
          setActiveGroupFilter('livedealing', null)
          setTimeFilter('24h')
          setModuleFilter('both')
        }}
        onApply={() => {
          setIsCustomizeOpen(false)
        }}
      />

      {/* Time Filter Modal */}
      <TimeFilterModal
        isOpen={isTimeFilterOpen}
        onClose={() => setIsTimeFilterOpen(false)}
        onApply={(newFilter) => {
          setTimeFilter(newFilter)
          setIsTimeFilterOpen(false)
        }}
        currentFilter={timeFilter}
        customFromDate={customFromDate}
        customToDate={customToDate}
        onCustomFromDateChange={setCustomFromDate}
        onCustomToDateChange={setCustomToDate}
        onApplyCustomDates={() => {
          setAppliedFromDate(customFromDate)
          setAppliedToDate(customToDate)
        }}
      />

      {/* Deals Filter Modal */}
      <DealsFilterModal
        isOpen={isDealsFilterOpen}
        onClose={() => setIsDealsFilterOpen(false)}
        onApply={(newFilter) => {
          setModuleFilter(newFilter)
          setIsDealsFilterOpen(false)
        }}
        currentFilter={moduleFilter}
      />

      {/* Filter Modal (hasFloating/hasCredit/noDeposit) */}
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
        availableItems={ibFilteredDeals}
        loginField="login"
        displayField="symbol"
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
        activeGroupName={getActiveGroupFilter('livedealing')}
        onSelectGroup={(group) => {
          if (group === null) {
            setActiveGroupFilter('livedealing', null)
          } else {
            setActiveGroupFilter('livedealing', group.name)
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
        onDeleteGroup={deleteGroup}
      />

      {/* Login Group Modal */}
      <LoginGroupModal
        isOpen={isLoginGroupModalOpen}
        onClose={() => {
          setIsLoginGroupModalOpen(false)
          setEditingGroup(null)
        }}
        editGroup={editingGroup}
      />

      {/* Display Mode Modal */}
      {showDisplayModeModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setShowDisplayModeModal(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[20px] z-[9999] max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex-shrink-0 pt-3 pb-4 px-5 border-b border-[#F2F2F7]">
              <div className="w-[47px] h-[2px] bg-[#E5E7EB] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#000000] font-outfit">Percentage View</h2>
                <button 
                  onClick={() => setShowDisplayModeModal(false)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between py-3 border-b border-[#F2F2F7] cursor-pointer hover:bg-gray-50 px-2 rounded">
                  <span className="text-sm text-[#000000] font-outfit">Without Percentage</span>
                  <input
                    type="radio"
                    name="displayMode"
                    value="value"
                    checked={displayMode === 'value'}
                    onChange={(e) => {
                      setDisplayMode(e.target.value)
                      setShowDisplayModeModal(false)
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between py-3 border-b border-[#F2F2F7] cursor-pointer hover:bg-gray-50 px-2 rounded">
                  <span className="text-sm text-[#000000] font-outfit">Show My Percentage</span>
                  <input
                    type="radio"
                    name="displayMode"
                    value="percentage"
                    checked={displayMode === 'percentage'}
                    onChange={(e) => {
                      setDisplayMode(e.target.value)
                      setShowDisplayModeModal(false)
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between py-3 cursor-pointer hover:bg-gray-50 px-2 rounded">
                  <span className="text-sm text-[#000000] font-outfit">Both</span>
                  <input
                    type="radio"
                    name="displayMode"
                    value="both"
                    checked={displayMode === 'both'}
                    onChange={(e) => {
                      setDisplayMode(e.target.value)
                      setShowDisplayModeModal(false)
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Client Details Modal */}
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
