import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import CustomizeViewModal from './CustomizeViewModal'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import { useIB } from '../contexts/IBContext'
import { useGroups } from '../contexts/GroupContext'
import websocketService from '../services/websocket'

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
  const { positions: cachedPositions } = useData()
  const { selectedIB, selectIB, clearIBSelection, filterByActiveIB, ibMT5Accounts } = useIB()
  const { groups, deleteGroup, getActiveGroupFilter, setActiveGroupFilter, filterByActiveGroup, activeGroupFilters } = useGroups()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isIBFilterOpen, setIsIBFilterOpen] = useState(false)
  const [isGroupOpen, setIsGroupOpen] = useState(false)
  const [isLoginGroupsOpen, setIsLoginGroupsOpen] = useState(false)
  const [isLoginGroupModalOpen, setIsLoginGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
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
  const [timeFilter, setTimeFilter] = useState('24h')
  
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

  // Load deals from WebSocket cache on mount
  useEffect(() => {
    const WS_CACHE_KEY = 'liveDealsWsCache'
    try {
      const raw = localStorage.getItem(WS_CACHE_KEY)
      const arr = raw ? JSON.parse(raw) : []
      if (Array.isArray(arr)) {
        setDeals(arr)
      }
    } catch {
      setDeals([])
    }

    // Subscribe to WebSocket updates
    const handleWsUpdate = (event) => {
      if (event.detail?.deals) {
        setDeals(event.detail.deals)
      }
      if (event.detail?.connectionState) {
        setConnectionState(event.detail.connectionState)
      }
    }

    window.addEventListener('liveDealingUpdate', handleWsUpdate)
    
    // Get initial connection state
    const service = websocketService
    if (service.socket?.readyState === WebSocket.OPEN) {
      setConnectionState('connected')
    }

    return () => {
      window.removeEventListener('liveDealingUpdate', handleWsUpdate)
    }
  }, [])

  // Filter deals by time (24h by default)
  const filteredByTime = useMemo(() => {
    const now = Date.now() / 1000
    const cutoff = now - (24 * 60 * 60) // 24 hours
    return deals.filter(deal => {
      const dealTime = deal.timestamp || 0
      return dealTime >= cutoff
    })
  }, [deals, timeFilter])

  // Apply search filter
  const searchedDeals = useMemo(() => {
    if (!searchInput.trim()) return filteredByTime
    const query = searchInput.toLowerCase()
    return filteredByTime.filter(deal => 
      String(deal.login || '').toLowerCase().includes(query) ||
      String(deal.rawData?.symbol || '').toLowerCase().includes(query) ||
      String(deal.id || '').toLowerCase().includes(query)
    )
  }, [filteredByTime, searchInput])

  // Apply group filter
  const groupFilteredDeals = useMemo(() => {
    return filterByActiveGroup(searchedDeals, 'login', 'livedealing')
  }, [searchedDeals, filterByActiveGroup, activeGroupFilters])

  // Apply IB filter
  const ibFilteredDeals = useMemo(() => {
    return filterByActiveIB(groupFilteredDeals, 'login')
  }, [groupFilteredDeals, filterByActiveIB, selectedIB, ibMT5Accounts])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalDeals = ibFilteredDeals.length
    const uniqueLogins = new Set(ibFilteredDeals.map(d => d.login)).size
    const totalPositions = cachedPositions.length
    
    return {
      totalDeals,
      uniqueLogins,
      totalPositions
    }
  }, [ibFilteredDeals, cachedPositions])

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
      
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })
  }, [ibFilteredDeals, sortColumn, sortDirection])

  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Face cards data
  const [cards, setCards] = useState([])
  
  useEffect(() => {
    const newCards = [
      { label: 'DEALS (24H)...', value: String(summaryStats.totalDeals) },
      { label: 'DEALS (24H)...', value: String(summaryStats.totalDeals) },
      { label: 'TOTAL POSITIONS', value: String(summaryStats.totalPositions) }
    ]
    
    if (cards.length === 0) {
      setCards(newCards)
    } else {
      setCards(prevCards => {
        return prevCards.map(prevCard => {
          const updated = newCards.find(c => c.label === prevCard.label)
          return updated || prevCard
        })
      })
    }
  }, [summaryStats])

  // Get visible columns
  const allColumns = [
    { key: 'time', label: 'Time', width: '80px', sticky: true },
    { key: 'login', label: 'Login', width: '80px' },
    { key: 'netType', label: 'Net Type', width: '80px' },
    { key: 'netVolume', label: 'Net Volume', width: '100px' },
    { key: 'averagePrice', label: 'Average Price', width: '110px' },
    { key: 'totalProfit', label: 'Total Profit', width: '100px' },
    { key: 'commission', label: 'Commission', width: '100px' },
    { key: 'storage', label: 'Storage', width: '90px' },
    { key: 'appliedPercentage', label: 'Applied %', width: '90px' },
    { key: 'symbol', label: 'Symbol', width: '90px' },
    { key: 'action', label: 'Action', width: '80px' },
    { key: 'deal', label: 'Deal', width: '80px' },
    { key: 'entry', label: 'Entry', width: '80px' }
  ]

  const activeColumns = allColumns.filter(col => visibleColumns[col.key])
  const gridTemplateColumns = activeColumns.map(col => col.width).join(' ')

  const renderCellValue = (deal, key, isSticky = false) => {
    let value = '-'
    
    switch (key) {
      case 'time':
        value = formatTime(deal.timestamp)
        break
      case 'login':
        value = deal.login || '-'
        break
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
        value = formatNum(deal.rawData?.volume || 0, 2)
        break
      case 'averagePrice':
        value = formatNum(deal.rawData?.price || 0, 2)
        break
      case 'totalProfit':
        const profit = deal.rawData?.profit || 0
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
              {formatNum(profit, 2)}
            </span>
          </div>
        )
      case 'commission':
        value = formatNum(deal.rawData?.commission || 0, 2)
        break
      case 'storage':
        value = formatNum(deal.rawData?.storage || 0, 2)
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
    <div className="h-screen flex flex-col bg-[#F8F8F8] overflow-hidden" style={{ height: '100dvh' }}>
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
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`fixed left-0 top-0 h-full w-[280px] bg-white z-50 transform transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={() => setIsSidebarOpen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#000" strokeWidth="2"/>
              </svg>
            </button>
          </div>
          
          <nav className="space-y-2">
            <button onClick={() => navigate('/dashboard')} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700">Dashboard</button>
            <button onClick={() => navigate('/positions')} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700">Positions</button>
            <button onClick={() => navigate('/pending-orders')} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700">Pending Orders</button>
            <button onClick={() => navigate('/margin-level')} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700">Margin Level</button>
            <button onClick={() => navigate('/live-dealing')} className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 text-blue-600 font-medium">Live Dealing</button>
            <button onClick={() => navigate('/clients')} className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-100 text-gray-700">Clients</button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Action Buttons + View All */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-[8px]">
              <button 
                onClick={() => setIsFilterOpen(true)} 
                className="h-[37px] px-3 rounded-[12px] bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4.5 6.5H9.5M2.5 3.5H11.5M5.5 9.5H8.5" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[#4B4B4B] text-[10px] font-medium font-outfit">Filter</span>
              </button>
              <button 
                className="h-[37px] px-3 rounded-[12px] bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[#4B4B4B] text-[10px] font-medium font-outfit">%</span>
              </button>
              <button 
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
        <div className="pb-2 pl-5">
          <div 
            ref={carouselRef}
            className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory pr-4"
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
                className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0 cursor-move active:opacity-50 transition-opacity"
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
                <p className="text-[#000000] text-xl font-bold leading-none">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Pagination Controls */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center px-2 gap-1">
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
        <div className="px-4 pb-4">
          <div className="bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] overflow-hidden">
            <div className="w-full overflow-x-auto overflow-y-visible" style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: '#CBD5E0 #F7FAFC'
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
                      <React.Fragment key={col.key}>
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
      {isFilterOpen && <FilterModal onClose={() => setIsFilterOpen(false)} />}
      {isIBFilterOpen && <IBFilterModal onClose={() => setIsIBFilterOpen(false)} />}
      {isGroupOpen && <GroupModal onClose={() => setIsGroupOpen(false)} group={editingGroup} />}
      {isLoginGroupsOpen && <LoginGroupsModal onClose={() => setIsLoginGroupsOpen(false)} />}
      {isLoginGroupModalOpen && <LoginGroupModal onClose={() => setIsLoginGroupModalOpen(false)} />}
    </div>
  )
}
