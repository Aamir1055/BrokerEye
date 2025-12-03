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

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PositionModule() {
  const navigate = useNavigate()
  const { positions } = useData()
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
  const [visibleColumns, setVisibleColumns] = useState({
    login: false,
    firstName: false,
    middleName: false,
    lastName: false,
    email: false,
    phone: false,
    position: false,
    symbol: true,
    action: false,
    netType: true,
    volume: false,
    volumePercentage: false,
    priceOpen: true,
    priceCurrent: false,
    netVolume: true,
    sl: false,
    tp: false,
    profit: false,
    totalProfit: true,
    profitPercentage: false,
    storage: false,
    storagePercentage: false,
    appliedPercentage: false,
    reason: false,
    comment: false,
    commission: false
  })

  // Apply group and IB filters to positions (same as desktop)
  const groupFilteredPositions = useMemo(() => {
    return filterByActiveGroup(positions, 'positions')
  }, [positions, filterByActiveGroup, activeGroupFilters])

  const ibFilteredPositions = useMemo(() => {
    return filterByActiveIB(groupFilteredPositions)
  }, [groupFilteredPositions, filterByActiveIB, selectedIB, ibMT5Accounts])

  // Calculate summary statistics (same as desktop)
  const summaryStats = useMemo(() => {
    const totalPositions = ibFilteredPositions.length
    const totalFloatingProfit = ibFilteredPositions.reduce((sum, p) => sum + (p.profit || 0), 0)
    const totalFloatingProfitPercentage = ibFilteredPositions.reduce((sum, p) => sum + (p.profit_percentage || 0), 0)
    const uniqueLogins = new Set(ibFilteredPositions.map(p => p.login)).size
    const uniqueSymbols = new Set(ibFilteredPositions.map(p => p.symbol)).size
    
    return {
      totalPositions,
      totalFloatingProfit,
      totalFloatingProfitPercentage,
      uniqueLogins,
      uniqueSymbols
    }
  }, [ibFilteredPositions])

  // Filter positions based on search
  const filteredPositions = ibFilteredPositions.filter(pos => {
    if (!searchInput.trim()) return true
    const query = searchInput.toLowerCase()
    return (
      String(pos.symbol || '').toLowerCase().includes(query) ||
      String(pos.login || '').toLowerCase().includes(query)
    )
  })

  // Calculate totals
  const totalProfit = filteredPositions.reduce((sum, pos) => sum + (Number(pos.profit) || 0), 0)

  // Get active columns for dynamic table rendering
  const activeColumns = useMemo(() => {
    const columnDefs = [
      { key: 'login', label: 'Login', width: '80px', sticky: true },
      { key: 'firstName', label: 'First Name', width: '100px' },
      { key: 'middleName', label: 'Middle Name', width: '100px' },
      { key: 'lastName', label: 'Last Name', width: '100px' },
      { key: 'email', label: 'Email', width: '140px' },
      { key: 'phone', label: 'Phone', width: '100px' },
      { key: 'position', label: 'Position', width: '80px' },
      { key: 'symbol', label: 'Symbol', width: '80px' },
      { key: 'action', label: 'Action', width: '70px' },
      { key: 'netType', label: 'Net Type', width: '70px' },
      { key: 'volume', label: 'Volume', width: '80px' },
      { key: 'volumePercentage', label: 'Volume %', width: '80px' },
      { key: 'priceOpen', label: 'Avg Price', width: '90px' },
      { key: 'priceCurrent', label: 'Price Current', width: '100px' },
      { key: 'netVolume', label: 'Net Volume', width: '90px' },
      { key: 'sl', label: 'S/L', width: '80px' },
      { key: 'tp', label: 'T/P', width: '80px' },
      { key: 'profit', label: 'Profit', width: '80px' },
      { key: 'totalProfit', label: 'Total Profit', width: '90px' },
      { key: 'profitPercentage', label: 'Profit %', width: '80px' },
      { key: 'storage', label: 'Storage', width: '80px' },
      { key: 'storagePercentage', label: 'Storage %', width: '90px' },
      { key: 'appliedPercentage', label: 'Applied %', width: '90px' },
      { key: 'reason', label: 'Reason', width: '100px' },
      { key: 'comment', label: 'Comment', width: '100px' },
      { key: 'commission', label: 'Commission', width: '90px' },
    ]
    const filtered = columnDefs.filter(col => visibleColumns[col.key])
    // Make first column sticky if it's not already login
    if (filtered.length > 0 && filtered[0].key !== 'login') {
      filtered[0].sticky = true
    }
    return filtered
  }, [visibleColumns])

  // Generate grid template columns for the table
  const gridTemplateColumns = useMemo(() => {
    return activeColumns.map(col => col.width || '1fr').join(' ')
  }, [activeColumns])

  // Render cell value based on column key
  const renderCellValue = (pos, columnKey, isSticky = false) => {
    const stickyClass = isSticky ? 'sticky left-0 bg-white z-10' : ''
    const stickyStyle = isSticky ? { boxShadow: '2px 0 4px rgba(0,0,0,0.05)' } : {}
    
    switch(columnKey) {
      case 'symbol':
        return <div className={`h-[38px] flex items-center justify-center px-1 overflow-hidden text-ellipsis whitespace-nowrap text-[#1A63BC] font-semibold ${stickyClass}`} style={stickyStyle}>{pos.symbol || '-'}</div>
      case 'netType':
      case 'action':
        return (
          <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
              pos.type === 0 || pos.type === 'Buy' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {pos.type === 0 || pos.type === 'Buy' ? 'Buy' : 'Sell'}
            </span>
          </div>
        )
      case 'totalProfit':
      case 'profit':
        return (
          <div className={`h-[38px] flex items-center justify-center px-1 font-medium ${
            (pos.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
          } ${stickyClass}`} style={stickyStyle}>
            {formatNum(pos.profit || 0)}
          </div>
        )
      case 'priceOpen':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.priceOpen || 0)}</div>
      case 'priceCurrent':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.priceCurrent || 0)}</div>
      case 'volume':
      case 'netVolume':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.volume || 0)}</div>
      case 'volumePercentage':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.volumePercentage || 0)}%</div>
      case 'profitPercentage':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.profitPercentage || 0)}%</div>
      case 'storage':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.storage || 0)}</div>
      case 'storagePercentage':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.storagePercentage || 0)}%</div>
      case 'appliedPercentage':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.appliedPercentage || 0)}%</div>
      case 'sl':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.sl || 0)}</div>
      case 'tp':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.tp || 0)}</div>
      case 'commission':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{formatNum(pos.commission || 0)}</div>
      case 'login':
        return <div className={`h-[38px] flex items-center justify-center px-1 text-[#1A63BC] font-semibold ${stickyClass}`} style={stickyStyle}>{pos.login || '-'}</div>
      case 'firstName':
      case 'middleName':
      case 'lastName':
      case 'email':
      case 'phone':
      case 'position':
      case 'reason':
      case 'comment':
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>{pos[columnKey] || '-'}</div>
      default:
        return <div className={`h-[38px] flex items-center justify-center px-1 ${stickyClass}`} style={stickyStyle}>-</div>
    }
  }

  // Face cards data - matching desktop layout with persistent state
  const [cards, setCards] = useState([])
  
  // Update cards when summary stats change
  useEffect(() => {
    const newCards = [
      { label: 'TOTAL POSITIONS', value: String(summaryStats.totalPositions) },
      { 
        label: 'TOTAL FLOATING', 
        value: formatNum(Math.abs(summaryStats.totalFloatingProfit)),
        isProfit: true,
        profitValue: summaryStats.totalFloatingProfit
      },
      { label: 'UNIQUE LOGINS', value: String(summaryStats.uniqueLogins) },
      { label: 'SYMBOLS', value: String(summaryStats.uniqueSymbols) }
    ]
    
    // Only update if cards length is different (initial load) or keep existing order
    if (cards.length === 0) {
      setCards(newCards)
    } else {
      // Update values while preserving order
      setCards(prevCards => {
        return prevCards.map(prevCard => {
          const updated = newCards.find(c => c.label === prevCard.label)
          return updated || prevCard
        })
      })
    }
  }, [summaryStats])

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
  }, [])

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
        
        <h1 className="text-xl font-semibold text-black">Positions</h1>
        
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-white text-sm font-semibold">U</span>
        </div>
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
                  {label:'Positions', path:'/positions', active:true, icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="3" rx="1" stroke="#1A63BC"/><rect x="3" y="11" width="18" height="3" rx="1" stroke="#1A63BC"/><rect x="3" y="16" width="18" height="3" rx="1" stroke="#1A63BC"/></svg>
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Action buttons row */}
        <div className="pt-5 pb-4 px-4">
          <div className="flex items-center gap-2">
            <button className="h-10 px-4 rounded-[10px] bg-white border-2 border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:border-[#1A63BC] hover:bg-[#F0F7FF] transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#1A63BC" strokeWidth="2"/>
                <path d="M12 8v8M8 12h8" stroke="#1A63BC" strokeWidth="2"/>
              </svg>
              <span className="text-[#1A63BC] text-[13px] font-semibold font-outfit">Net Positions</span>
            </button>
            <button className="h-10 px-4 rounded-[10px] bg-white border-2 border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:border-[#1A63BC] hover:bg-[#F0F7FF] transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="8" cy="8" r="3" stroke="#1A63BC" strokeWidth="1.5"/>
                <circle cx="16" cy="8" r="3" stroke="#1A63BC" strokeWidth="1.5"/>
                <path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#1A63BC" strokeWidth="1.5"/>
              </svg>
              <span className="text-[#1A63BC] text-[13px] font-semibold font-outfit">Client Net</span>
            </button>
            <button className="w-10 h-10 rounded-[10px] bg-white border-2 border-[#E5E7EB] shadow-sm flex items-center justify-center hover:border-[#1A63BC] hover:bg-[#F0F7FF] transition-all">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0 1 15-6.7M20 15a9 9 0 0 1-15 6.7" stroke="#1A63BC" strokeWidth="2"/>
              </svg>
            </button>
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
                  <div className={`w-[16px] h-[16px] ${card.isProfit ? (card.profitValue >= 0 ? 'bg-green-500' : 'bg-red-500') : 'bg-[#2563EB]'} rounded-[3px] flex items-center justify-center flex-shrink-0`}>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                      <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-[4px]">
                  <span className={`text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] ${card.isProfit ? (card.profitValue >= 0 ? 'text-green-600' : 'text-red-600') : 'text-[#000000]'}`}>
                    {card.isProfit && (card.profitValue >= 0 ? '▲ ' : '▼ ')}{card.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search and navigation */}
        <div className="pb-3 px-4">
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0 h-[32px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] px-2 flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
                <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
                <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input 
                placeholder="Search" 
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
            <button className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50">
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
                      className={`h-[28px] flex items-center justify-center px-1 ${col.sticky ? 'sticky left-0 bg-[#1A63BC] z-30' : ''}`}
                      style={{border: 'none', outline: 'none', boxShadow: 'none'}}
                    >
                      {col.label}
                    </div>
                  ))}
                </div>

                {/* Table Rows */}
                {filteredPositions.slice(0, 15).map((pos, idx) => (
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
                        {renderCellValue(pos, col.key, col.sticky)}
                      </React.Fragment>
                    ))}
                  </div>
                ))}

                {/* Table Footer */}
                <div 
                  className="grid bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-semibold border-t-2 border-[#1A63BC]"
                  style={{
                    gap: '0px', 
                    gridGap: '0px', 
                    columnGap: '0px',
                    gridTemplateColumns
                  }}
                >
                  {activeColumns.map((col, idx) => (
                    <div 
                      key={col.key} 
                      className={`h-[38px] flex items-center justify-center px-1 ${col.sticky ? 'sticky left-0 bg-[#EFF4FB] z-10' : ''}`}
                      style={{border: 'none', outline: 'none', boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'}}
                    >
                      {idx === 0 ? 'Total' : (col.key === 'totalProfit' || col.key === 'profit') ? formatNum(totalProfit) : '-'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CustomizeView Modal */}
      <CustomizeViewModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        onFilterClick={() => {
          setIsCustomizeOpen(false)
          setIsFilterOpen(true)
        }}
        onIBFilterClick={() => {
          setIsCustomizeOpen(false)
          setIsIBFilterOpen(true)
        }}
        onGroupsClick={() => {
          setIsCustomizeOpen(false)
          setIsLoginGroupsOpen(true)
        }}
        onReset={() => {
          setFilters({ hasFloating: false, hasCredit: false, noDeposit: false })
          clearIBSelection()
          setActiveGroupFilter('positions', null)
        }}
        onApply={() => {
          setIsCustomizeOpen(false)
        }}
      />

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
        availableItems={ibFilteredPositions}
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
        activeGroupName={getActiveGroupFilter('positions')}
        onSelectGroup={(group) => {
          if (group === null) {
            setActiveGroupFilter('positions', null)
          } else {
            setActiveGroupFilter('positions', group.name)
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
                'First Name': 'firstName',
                'Middle Name': 'middleName',
                'Last Name': 'lastName',
                'Email': 'email',
                'Phone': 'phone',
                'Position': 'position',
                'Symbol': 'symbol',
                'Action': 'action',
                'Net Type': 'netType',
                'Volume': 'volume',
                'Volume %': 'volumePercentage',
                'Price Open': 'priceOpen',
                'Price Current': 'priceCurrent',
                'Net Volume': 'netVolume',
                'S/L': 'sl',
                'T/P': 'tp',
                'Profit': 'profit',
                'Total Profit': 'totalProfit',
                'Profit %': 'profitPercentage',
                'Storage': 'storage',
                'Storage %': 'storagePercentage',
                'Applied %': 'appliedPercentage',
                'Reason': 'reason',
                'Comment': 'comment',
                'Commission': 'commission',
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
                    login: false,
                    firstName: false,
                    middleName: false,
                    lastName: false,
                    email: false,
                    phone: false,
                    position: false,
                    symbol: true,
                    action: false,
                    netType: true,
                    volume: false,
                    volumePercentage: false,
                    priceOpen: true,
                    priceCurrent: false,
                    netVolume: true,
                    sl: false,
                    tp: false,
                    profit: false,
                    totalProfit: true,
                    profitPercentage: false,
                    storage: false,
                    storagePercentage: false,
                    appliedPercentage: false,
                    reason: false,
                    comment: false,
                    commission: false,
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
