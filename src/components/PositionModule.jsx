import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import CustomizeViewModal from './CustomizeViewModal'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import ClientDetailsMobileModal from './ClientDetailsMobileModal'
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
  const [selectedClient, setSelectedClient] = useState(null)
  const carouselRef = useRef(null)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [showNetPositions, setShowNetPositions] = useState(false)
  const [showClientNet, setShowClientNet] = useState(false)
  
  // NET Position states
  const [netCurrentPage, setNetCurrentPage] = useState(1)
  const netItemsPerPage = 10
  const [netCardsVisible, setNetCardsVisible] = useState({
    netSymbols: true,
    totalNetVolume: true,
    totalNetPL: true,
    totalLogins: true
  })
  const [netCardFilterOpen, setNetCardFilterOpen] = useState(false)
  const netCardFilterRef = useRef(null)
  const [netVisibleColumns, setNetVisibleColumns] = useState({
    symbol: true,
    netType: true,
    netVolume: true,
    avgPrice: true,
    totalProfit: true,
    totalStorage: false,
    totalCommission: false,
    loginCount: true,
    totalPositions: true,
    variantCount: false
  })
  const [netShowColumnSelector, setNetShowColumnSelector] = useState(false)
  const netColumnSelectorRef = useRef(null)
  const [groupByBaseSymbol, setGroupByBaseSymbol] = useState(false)
  const [expandedNetSymbols, setExpandedNetSymbols] = useState(new Set())
  const [netSearchInput, setNetSearchInput] = useState('')
  
  // Client NET states
  const [clientNetCurrentPage, setClientNetCurrentPage] = useState(1)
  const clientNetItemsPerPage = 10
  const [clientNetCardsVisible, setClientNetCardsVisible] = useState({
    clientNetRows: true,
    totalNetVolume: true,
    totalNetPL: true,
    totalLogins: true
  })
  const [clientNetCardFilterOpen, setClientNetCardFilterOpen] = useState(false)
  const clientNetCardFilterRef = useRef(null)
  const [clientNetVisibleColumns, setClientNetVisibleColumns] = useState({
    login: true,
    symbol: true,
    netType: true,
    netVolume: true,
    avgPrice: true,
    totalProfit: true,
    totalStorage: false,
    totalCommission: false,
    totalPositions: true
  })
  const [clientNetShowColumnSelector, setClientNetShowColumnSelector] = useState(false)
  const clientNetColumnSelectorRef = useRef(null)
  const [clientNetSearchInput, setClientNetSearchInput] = useState('')
  
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
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

  // Calculate NET positions
  const calculateGlobalNetPositions = (positions) => {
    if (!positions || positions.length === 0) return []

    const symbolMap = new Map()
    const getBaseSymbol = (s) => {
      if (!s || typeof s !== 'string') return s
      const parts = s.split(/[\.\-]/)
      return parts[0] || s
    }

    positions.forEach(pos => {
      const symbol = pos.symbol
      if (!symbol) return
      const key = groupByBaseSymbol ? getBaseSymbol(symbol) : symbol

      if (!symbolMap.has(key)) {
        symbolMap.set(key, {
          key,
          buyPositions: [],
          sellPositions: [],
          logins: new Set(),
          variantMap: new Map()
        })
      }

      const group = symbolMap.get(key)
      group.logins.add(pos.login)

      const rawAction = pos.action
      let actionNorm = null
      if (rawAction === 0 || rawAction === '0') actionNorm = 'buy'
      else if (rawAction === 1 || rawAction === '1') actionNorm = 'sell'
      else if (typeof rawAction === 'string') actionNorm = rawAction.toLowerCase()

      if (actionNorm === 'buy') {
        group.buyPositions.push(pos)
      } else if (actionNorm === 'sell') {
        group.sellPositions.push(pos)
      }

      // Track exact symbol variants when grouping by base
      if (groupByBaseSymbol) {
        const exact = symbol
        if (!group.variantMap.has(exact)) {
          group.variantMap.set(exact, { buyPositions: [], sellPositions: [] })
        }
        const v = group.variantMap.get(exact)
        if (actionNorm === 'buy') v.buyPositions.push(pos)
        else if (actionNorm === 'sell') v.sellPositions.push(pos)
      }
    })

    const netPositionsData = []

    symbolMap.forEach(group => {
      const buyVolume = group.buyPositions.reduce((sum, p) => sum + (p.volume || 0), 0)
      const sellVolume = group.sellPositions.reduce((sum, p) => sum + (p.volume || 0), 0)
      const netVolume = buyVolume - sellVolume

      if (netVolume === 0) return

      let totalWeightedPrice = 0
      let totalVolume = 0
      let totalProfit = 0
      let totalStorage = 0
      let totalCommission = 0

      if (netVolume > 0) {
        group.buyPositions.forEach(p => {
          const vol = p.volume || 0
          const price = p.priceOpen || 0
          totalWeightedPrice += price * vol
          totalVolume += vol
          totalProfit += p.profit || 0
          totalStorage += p.storage || 0
          totalCommission += p.commission || 0
        })
      } else {
        group.sellPositions.forEach(p => {
          const vol = p.volume || 0
          const price = p.priceOpen || 0
          totalWeightedPrice += price * vol
          totalVolume += vol
          totalProfit += p.profit || 0
          totalStorage += p.storage || 0
          totalCommission += p.commission || 0
        })
      }

      const avgPrice = totalVolume > 0 ? totalWeightedPrice / totalVolume : 0
      const netType = netVolume > 0 ? 'Sell' : 'Buy'
      const loginCount = group.logins.size
      const totalPositions = group.buyPositions.length + group.sellPositions.length

      // Build variant breakdown when grouping by base symbol
      let variantCount = 1
      let variants = []
      if (groupByBaseSymbol) {
        variantCount = group.variantMap.size
        variants = Array.from(group.variantMap.entries()).map(([exact, data]) => {
          const vBuyVol = data.buyPositions.reduce((s, p) => s + (p.volume || 0), 0)
          const vSellVol = data.sellPositions.reduce((s, p) => s + (p.volume || 0), 0)
          const vNet = vBuyVol - vSellVol
          if (vNet === 0) return null
          let tw = 0, tv = 0, tp = 0, ts = 0, tc = 0
          const use = vNet > 0 ? data.buyPositions : data.sellPositions
          use.forEach(p => { const vol = p.volume || 0; const price = p.priceOpen || 0; tw += price * vol; tv += vol; tp += p.profit || 0; ts += p.storage || 0; tc += p.commission || 0 })
          const vAvg = tv > 0 ? tw / tv : 0
          return {
            exactSymbol: exact,
            netType: vNet > 0 ? 'Sell' : 'Buy',
            netVolume: Math.abs(vNet),
            avgPrice: vAvg,
            totalProfit: tp,
            totalStorage: ts,
            totalCommission: tc
          }
        }).filter(Boolean)
      }

      netPositionsData.push({
        symbol: group.key,
        netType,
        netVolume: Math.abs(netVolume),
        avgPrice,
        totalProfit,
        totalStorage,
        totalCommission,
        loginCount,
        totalPositions,
        variantCount,
        variants
      })
    })

    return netPositionsData.sort((a, b) => b.netVolume - a.netVolume)
  }

  const netPositions = useMemo(() => calculateGlobalNetPositions(ibFilteredPositions), [ibFilteredPositions, groupByBaseSymbol])

  // Calculate Client NET positions (group by login then symbol)
  const calculateClientNetPositions = (positions) => {
    if (!positions || positions.length === 0) return []

    const getBaseSymbol = (s) => {
      if (!s || typeof s !== 'string') return s
      const parts = s.split(/[\.\-]/)
      return parts[0] || s
    }

    const loginMap = new Map()

    positions.forEach(pos => {
      const login = pos.login
      const symbol = pos.symbol
      if (login == null || !symbol) return
      
      if (!loginMap.has(login)) loginMap.set(login, new Map())
      const symMap = loginMap.get(login)
      const symbolKey = groupByBaseSymbol ? getBaseSymbol(symbol) : symbol
      
      if (!symMap.has(symbolKey)) {
        symMap.set(symbolKey, {
          buyPositions: [],
          sellPositions: []
        })
      }
      const bucket = symMap.get(symbolKey)

      const rawAction = pos.action
      let actionNorm = null
      if (rawAction === 0 || rawAction === '0') actionNorm = 'buy'
      else if (rawAction === 1 || rawAction === '1') actionNorm = 'sell'
      else if (typeof rawAction === 'string') actionNorm = rawAction.toLowerCase()

      if (actionNorm === 'buy') bucket.buyPositions.push(pos)
      else if (actionNorm === 'sell') bucket.sellPositions.push(pos)
    })

    const rows = []
    loginMap.forEach((symMap, login) => {
      symMap.forEach((bucket, symbol) => {
        const buyVol = bucket.buyPositions.reduce((s, p) => s + (p.volume || 0), 0)
        const sellVol = bucket.sellPositions.reduce((s, p) => s + (p.volume || 0), 0)
        const netVol = buyVol - sellVol
        if (netVol === 0) return

        let tw = 0, tv = 0, tp = 0, ts = 0, tc = 0
        const use = netVol > 0 ? bucket.buyPositions : bucket.sellPositions
        use.forEach(p => {
          const v = p.volume || 0
          const pr = p.priceOpen || 0
          tw += pr * v
          tv += v
          tp += p.profit || 0
          ts += p.storage || 0
          tc += p.commission || 0
        })
        const avg = tv > 0 ? tw / tv : 0
        const netType = netVol > 0 ? 'Sell' : 'Buy'
        const totalPositions = bucket.buyPositions.length + bucket.sellPositions.length

        rows.push({
          login,
          symbol,
          netType,
          netVolume: Math.abs(netVol),
          avgPrice: avg,
          totalProfit: tp,
          totalStorage: ts,
          totalCommission: tc,
          totalPositions
        })
      })
    })

    return rows.sort((a, b) => a.login === b.login ? b.netVolume - a.netVolume : String(a.login).localeCompare(String(b.login)))
  }

  const clientNetPositions = useMemo(() => calculateClientNetPositions(ibFilteredPositions), [ibFilteredPositions, groupByBaseSymbol])

  // Filter NET positions based on search
  const filteredNetPositions = useMemo(() => {
    if (!netSearchInput.trim()) return netPositions
    const query = netSearchInput.toLowerCase()
    return netPositions.filter(pos => 
      String(pos.symbol || '').toLowerCase().includes(query) ||
      String(pos.netType || '').toLowerCase().includes(query)
    )
  }, [netPositions, netSearchInput])

  // Filter Client NET positions based on search
  const filteredClientNetPositions = useMemo(() => {
    if (!clientNetSearchInput.trim()) return clientNetPositions
    const query = clientNetSearchInput.toLowerCase()
    return clientNetPositions.filter(pos =>
      String(pos.login || '').toLowerCase().includes(query) ||
      String(pos.symbol || '').toLowerCase().includes(query) ||
      String(pos.netType || '').toLowerCase().includes(query)
    )
  }, [clientNetPositions, clientNetSearchInput])

  // Filter positions based on search
  const filteredPositions = useMemo(() => {
    let filtered = ibFilteredPositions.filter(pos => {
      if (!searchInput.trim()) return true
      const query = searchInput.toLowerCase()
      return (
        String(pos.symbol || '').toLowerCase().includes(query) ||
        String(pos.login || '').toLowerCase().includes(query)
      )
    })

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal = a[sortColumn]
        let bVal = b[sortColumn]
        
        // Handle numeric values
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // Handle string values
        aVal = String(aVal || '').toLowerCase()
        bVal = String(bVal || '').toLowerCase()
        
        if (sortDirection === 'asc') {
          return aVal.localeCompare(bVal)
        } else {
          return bVal.localeCompare(aVal)
        }
      })
    }

    return filtered
  }, [ibFilteredPositions, searchInput, sortColumn, sortDirection])

  // Handle column sorting
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Calculate totals
  const totalProfit = filteredPositions.reduce((sum, pos) => sum + (Number(pos.profit) || 0), 0)

  // Pagination calculations for NET and Client NET
  const netTotalPages = Math.ceil(filteredNetPositions.length / netItemsPerPage)
  const netPaginatedPositions = filteredNetPositions.slice(
    (netCurrentPage - 1) * netItemsPerPage,
    netCurrentPage * netItemsPerPage
  )
  
  const clientNetTotalPages = Math.ceil(filteredClientNetPositions.length / clientNetItemsPerPage)
  const clientNetPaginatedPositions = filteredClientNetPositions.slice(
    (clientNetCurrentPage - 1) * clientNetItemsPerPage,
    clientNetCurrentPage * clientNetItemsPerPage
  )

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (netCardFilterRef.current && !netCardFilterRef.current.contains(e.target)) {
        setNetCardFilterOpen(false)
      }
      if (netColumnSelectorRef.current && !netColumnSelectorRef.current.contains(e.target)) {
        setNetShowColumnSelector(false)
      }
      if (clientNetCardFilterRef.current && !clientNetCardFilterRef.current.contains(e.target)) {
        setClientNetCardFilterOpen(false)
      }
      if (clientNetColumnSelectorRef.current && !clientNetColumnSelectorRef.current.contains(e.target)) {
        setClientNetShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
        const handleLoginClick = () => setSelectedClient({ login: pos.login, email: pos.email || '' })
        return (
          <div 
            className={`h-[38px] flex items-center justify-center px-1 text-[#1A63BC] font-semibold ${stickyClass} cursor-pointer hover:underline`} 
            style={stickyStyle}
            onClick={handleLoginClick}
            onTouchEnd={(e) => {
              e.preventDefault()
              handleLoginClick()
            }}
          >
            {pos.login || '-'}
          </div>
        )
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

  // Fix mobile viewport height on actual devices
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    
    setVH()
    window.addEventListener('resize', setVH)
    window.addEventListener('orientationchange', setVH)
    
    return () => {
      window.removeEventListener('resize', setVH)
      window.removeEventListener('orientationchange', setVH)
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-[#F8F8F8] overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
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
                    className={`flex items-center gap-3 px-4 h-[37px] text-[10px] ${item.active ? 'text-[#1A63BC] bg-[#EFF4FB] rounded-lg font-semibold' : 'text-[#404040]'}`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 mt-auto border-t border-[#ECECEC]">
              <button className="flex items-center gap-3 px-2 h-[37px] text-[10px] text-[#404040]">
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
          <div className="flex items-center justify-center gap-3">
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
              onClick={() => {
                setShowNetPositions((v) => {
                  const nv = !v
                  if (nv) setShowClientNet(false)
                  return nv
                })
              }}
              className={`flex-1 h-[37px] rounded-[12px] ${showNetPositions ? 'bg-blue-600 border-blue-600' : 'bg-white border-[#E5E7EB]'} border shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke={showNetPositions ? "#ffffff" : "#666666"} strokeWidth="2"/>
                <path d="M12 8v8M8 12h8" stroke={showNetPositions ? "#ffffff" : "#666666"} strokeWidth="2"/>
              </svg>
              <span className={`${showNetPositions ? 'text-white' : 'text-[#666666]'} text-[10px] font-medium font-outfit`}>Net Positions</span>
            </button>
            <button 
              onClick={() => {
                setShowClientNet((v) => {
                  const nv = !v
                  if (nv) setShowNetPositions(false)
                  return nv
                })
              }}
              className={`flex-1 h-[37px] rounded-[12px] ${showClientNet ? 'bg-blue-600 border-blue-600' : 'bg-white border-[#E5E7EB]'} border shadow-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke={showClientNet ? "#ffffff" : "#666666"} strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke={showClientNet ? "#ffffff" : "#666666"} strokeWidth="2"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke={showClientNet ? "#ffffff" : "#666666"} strokeLinecap="round"/>
              </svg>
              <span className={`${showClientNet ? 'text-white' : 'text-[#666666]'} text-[10px] font-medium font-outfit`}>Client Net</span>
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="w-[37px] h-[37px] rounded-[12px] border border-[#E5E7EB] shadow-sm flex items-center justify-center hover:bg-gray-50 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="#1A63BC" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Face Cards Carousel - Hidden in NET views */}
        {!showNetPositions && !showClientNet && (
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
        )}

        {/* Search and navigation */}
        {!showNetPositions && !showClientNet && (
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
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="px-2 text-[10px] font-medium text-[#4B4B4B]">
              <span className="font-semibold">{currentPage}</span>
              <span className="text-[#9CA3AF] mx-1">/</span>
              <span>{Math.ceil(filteredPositions.length / itemsPerPage)}</span>
            </div>
            <button 
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredPositions.length / itemsPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(filteredPositions.length / itemsPerPage)}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        )}

        {/* Table - full width, remove outer padding */}
        {!showNetPositions && !showClientNet && (
        <div>
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
                      className={`h-[28px] flex items-center justify-center px-1 cursor-pointer hover:bg-[#1450A0] transition-colors ${col.sticky ? 'sticky left-0 bg-[#1A63BC] z-30' : ''}`}
                      style={{border: 'none', outline: 'none', boxShadow: 'none'}}
                    >
                      <span>{col.label}</span>
                      {sortColumn === col.key && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="ml-1">
                          <path 
                            d={sortDirection === 'asc' ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} 
                            stroke="white" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>

                {/* Table Rows */}
                {filteredPositions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((pos, idx) => (
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
        )}

        {/* NET Position View */}
        {showNetPositions && (
          <div className="bg-[#F5F7FA] min-h-screen">
            {/* Face Cards Carousel */}
            <div className="pb-2 px-4">
              <div className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">NET Symbols</span>
                    <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] text-[#000000]">{netPositions.length}</span>
                  </div>
                </div>
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">NET Volume</span>
                    <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] text-[#000000]">{formatNum(netPositions.reduce((s,p)=>s+p.netVolume,0))}</span>
                  </div>
                </div>
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">NET P/L</span>
                    <div className={`w-[16px] h-[16px] ${netPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? 'bg-green-500' : 'bg-red-500'} rounded-[3px] flex items-center justify-center flex-shrink-0`}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className={`text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] ${netPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? '▲ ' : '▼ '}{formatNum(Math.abs(netPositions.reduce((s,p)=>s+p.totalProfit,0)))}
                    </span>
                  </div>
                </div>
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">Total Logins</span>
                    <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] text-[#000000]">{netPositions.reduce((s,p)=>s+p.loginCount,0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls with Search */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-3">
              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="h-[32px] min-w-[120px] bg-white border border-gray-300 rounded-lg px-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search"
                    value={netSearchInput}
                    onChange={(e) => setNetSearchInput(e.target.value)}
                    className="w-[80px] text-[11px] text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                  />
                </div>

                {/* Card Filter */}
                <div className="relative" ref={netCardFilterRef}>
                  <button onClick={() => setNetCardFilterOpen(v => !v)} className="h-[32px] px-2 rounded-lg border border-blue-200 bg-white text-[10px] font-medium flex items-center gap-1 text-gray-700">
                    <svg className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                    Cards
                  </button>
                  {netCardFilterOpen && (
                    <div className="absolute left-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-40">
                      {Object.entries(netCardsVisible).map(([k, v]) => (
                        <label key={k} className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-blue-50 cursor-pointer">
                          <input type="checkbox" checked={v} onChange={() => setNetCardsVisible(prev => ({ ...prev, [k]: !prev[k] }))} className="w-3 h-3" />
                          <span className="text-[10px] text-gray-700">{k === 'netSymbols' ? 'NET Symbols' : k === 'totalNetVolume' ? 'Total Volume' : k === 'totalNetPL' ? 'Total P/L' : 'Total Logins'}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Group Base Symbols */}
                <button
                  onClick={() => setGroupByBaseSymbol(v => !v)}
                  className={`h-[32px] px-2 rounded-lg border text-[10px] font-medium flex items-center gap-1 ${groupByBaseSymbol ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-indigo-200'}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 10h10M10 14h7M13 18h4"/></svg>
                  Base
                </button>

                {/* Columns */}
                <div className="relative" ref={netColumnSelectorRef}>
                  <button onClick={() => setNetShowColumnSelector(v => !v)} className="h-[32px] px-2 rounded-lg border border-purple-200 bg-white text-[10px] font-medium flex items-center gap-1 text-gray-700">
                    <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                    Cols
                  </button>
                  {netShowColumnSelector && (
                    <div className="absolute left-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-44 max-h-60 overflow-y-auto">
                      {Object.keys(netVisibleColumns).map(k => (
                        <label key={k} className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-blue-50 cursor-pointer">
                          <input type="checkbox" checked={netVisibleColumns[k]} onChange={() => setNetVisibleColumns(prev => ({ ...prev, [k]: !prev[k] }))} className="w-3 h-3" />
                          <span className="text-[10px] text-gray-700 capitalize">{
                            k === 'netType' ? 'NET Type' : 
                            k === 'netVolume' ? 'NET Volume' : 
                            k === 'avgPrice' ? 'Avg Price' : 
                            k === 'totalProfit' ? 'Total Profit' : 
                            k === 'totalStorage' ? 'Total Storage' :
                            k === 'totalCommission' ? 'Total Commission' :
                            k === 'loginCount' ? 'Login Count' : 
                            k === 'totalPositions' ? 'Total Positions' :
                            k === 'variantCount' ? 'Variant Count' :
                            k
                          }</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <button
                  onClick={() => setNetCurrentPage(p => Math.max(1, p - 1))}
                  disabled={netCurrentPage === 1}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${netCurrentPage === 1 ? 'text-gray-300 bg-gray-100' : 'text-gray-700 bg-white border border-gray-300'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="text-[10px] font-medium text-gray-700">
                  <span className="font-semibold">{netCurrentPage}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span>{netTotalPages}</span>
                </div>
                <button
                  onClick={() => setNetCurrentPage(p => Math.min(netTotalPages, p + 1))}
                  disabled={netCurrentPage === netTotalPages}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${netCurrentPage === netTotalPages ? 'text-gray-300 bg-gray-100' : 'text-gray-700 bg-white border border-gray-300'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* NET Positions Table */}
            <div className="pt-3">
              <div className="bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <div className="min-w-full">
                  {/* Header */}
                  <div className="flex bg-[#1A63BC] text-white text-[10px] font-semibold h-[28px]">
                    {netVisibleColumns.symbol && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Symbol</div>}
                    {netVisibleColumns.netType && <div className="flex items-center justify-center px-1 min-w-[60px] flex-shrink-0 bg-[#1A63BC]">Type</div>}
                    {netVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">NET Vol</div>}
                    {netVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Avg Price</div>}
                    {netVisibleColumns.totalProfit && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">P/L</div>}
                    {netVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Storage</div>}
                    {netVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Comm</div>}
                    {netVisibleColumns.loginCount && <div className="flex items-center justify-center px-1 min-w-[70px] flex-shrink-0 bg-[#1A63BC]">Logins</div>}
                    {netVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Positions</div>}
                    {netVisibleColumns.variantCount && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Variants</div>}
                  </div>

                  {/* Body */}
                  {netPaginatedPositions.length === 0 ? (
                    <div className="text-center py-8 text-[#6B7280] text-sm">No NET positions found</div>
                  ) : (
                    netPaginatedPositions.map((pos, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex text-[10px] text-[#4B4B4B] border-b border-[#E1E1E1] hover:bg-[#F8FAFC]">
                          {netVisibleColumns.symbol && (
                            <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 font-semibold bg-white">
                              {pos.symbol}
                              {groupByBaseSymbol && pos.variantCount > 1 && (
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedNetSymbols)
                                    if (newExpanded.has(pos.symbol)) {
                                      newExpanded.delete(pos.symbol)
                                    } else {
                                      newExpanded.add(pos.symbol)
                                    }
                                    setExpandedNetSymbols(newExpanded)
                                  }}
                                  className="ml-1 text-[8px] text-blue-600 underline hover:text-blue-800"
                                >
                                  {expandedNetSymbols.has(pos.symbol) ? 'Hide' : 'Show'} variants
                                </button>
                              )}
                            </div>
                          )}
                          {netVisibleColumns.netType && <div className={`flex items-center justify-center px-1 h-[40px] min-w-[60px] flex-shrink-0 font-semibold bg-white ${pos.netType === 'Buy' ? 'text-green-600' : 'text-red-600'}`}>{pos.netType}</div>}
                          {netVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.netVolume)}</div>}
                          {netVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.avgPrice)}</div>}
                          {netVisibleColumns.totalProfit && <div className={`flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 font-semibold bg-white ${pos.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNum(pos.totalProfit)}</div>}
                          {netVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.totalStorage || 0)}</div>}
                          {netVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.totalCommission || 0)}</div>}
                          {netVisibleColumns.loginCount && <div className="flex items-center justify-center px-1 h-[40px] min-w-[70px] flex-shrink-0 bg-white text-[#4B4B4B]">{pos.loginCount}</div>}
                          {netVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{pos.totalPositions}</div>}
                          {netVisibleColumns.variantCount && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{pos.variantCount}</div>}
                        </div>

                        {/* Variant Rows */}
                        {groupByBaseSymbol && expandedNetSymbols.has(pos.symbol) && pos.variants && pos.variants.length > 0 && (
                          pos.variants.map((variant, vIdx) => (
                            <div key={`${idx}-v-${vIdx}`} className="flex text-[10px] text-[#6B7280] bg-[#F8FAFC] border-b border-[#E1E1E1]">
                              {netVisibleColumns.symbol && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 pl-4 font-medium bg-[#F8FAFC]">{variant.exactSymbol}</div>}
                              {netVisibleColumns.netType && <div className={`flex items-center justify-center px-1 h-[40px] min-w-[60px] flex-shrink-0 bg-[#F8FAFC] ${variant.netType === 'Buy' ? 'text-green-600' : 'text-red-600'}`}>{variant.netType}</div>}
                              {netVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">{formatNum(variant.netVolume)}</div>}
                              {netVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">{formatNum(variant.avgPrice)}</div>}
                              {netVisibleColumns.totalProfit && <div className={`flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] ${variant.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatNum(variant.totalProfit)}</div>}
                              {netVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">{formatNum(variant.totalStorage || 0)}</div>}
                              {netVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">{formatNum(variant.totalCommission || 0)}</div>}
                              {netVisibleColumns.loginCount && <div className="flex items-center justify-center px-1 h-[40px] min-w-[70px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">-</div>}
                              {netVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">-</div>}
                              {netVisibleColumns.variantCount && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-[#F8FAFC] text-[#6B7280]">-</div>}
                            </div>
                          ))
                        )}
                      </React.Fragment>
                    ))
                  )}

                  {/* Footer */}
                  {netPaginatedPositions.length > 0 && (
                    <div className="flex bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-semibold h-[38px] border-t-2 border-[#1A63BC]">
                      {netVisibleColumns.symbol && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">Total</div>}
                      {netVisibleColumns.netType && <div className="flex items-center justify-center px-1 min-w-[60px] flex-shrink-0 bg-[#EFF4FB]">-</div>}
                      {netVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(netPositions.reduce((s,p)=>s+p.netVolume,0))}</div>}
                      {netVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">-</div>}
                      {netVisibleColumns.totalProfit && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(netPositions.reduce((s,p)=>s+p.totalProfit,0))}</div>}
                      {netVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(netPositions.reduce((s,p)=>s+(p.totalStorage||0),0))}</div>}
                      {netVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(netPositions.reduce((s,p)=>s+(p.totalCommission||0),0))}</div>}
                      {netVisibleColumns.loginCount && <div className="flex items-center justify-center px-1 min-w-[70px] flex-shrink-0 bg-[#EFF4FB]">{netPositions.reduce((s,p)=>s+p.loginCount,0)}</div>}
                      {netVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{netPositions.reduce((s,p)=>s+p.totalPositions,0)}</div>}
                      {netVisibleColumns.variantCount && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">-</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        {/* Client NET View */}
        {showClientNet && (
          <div className="bg-[#F5F7FA] min-h-screen">
            {/* Face Cards Carousel */}
            <div className="pb-2 px-4">
              <div className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">NET Rows</span>
                    <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] text-[#000000]">{clientNetPositions.length}</span>
                  </div>
                </div>
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">NET Volume</span>
                    <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] text-[#000000]">{formatNum(clientNetPositions.reduce((s,p)=>s+p.netVolume,0))}</span>
                  </div>
                </div>
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">NET P/L</span>
                    <div className={`w-[16px] h-[16px] ${clientNetPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? 'bg-green-500' : 'bg-red-500'} rounded-[3px] flex items-center justify-center flex-shrink-0`}>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className={`text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] ${clientNetPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {clientNetPositions.reduce((s,p)=>s+p.totalProfit,0) >= 0 ? '▲ ' : '▼ '}{formatNum(Math.abs(clientNetPositions.reduce((s,p)=>s+p.totalProfit,0)))}
                    </span>
                  </div>
                </div>
                <div className="min-w-[125px] w-[125px] h-[55px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1 flex flex-col justify-between snap-start flex-shrink-0">
                  <div className="flex items-start justify-between">
                    <span className="text-[#4B4B4B] text-[10px] font-semibold leading-[13px] pr-1">Logins</span>
                    <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                        <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-[4px]">
                    <span className="text-[15.5px] font-bold leading-[13px] tracking-[-0.01em] text-[#000000]">{new Set(clientNetPositions.map(r=>r.login)).size}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Controls with Search */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-3">
              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="h-[32px] min-w-[120px] bg-white border border-gray-300 rounded-lg px-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search"
                    value={clientNetSearchInput}
                    onChange={(e) => setClientNetSearchInput(e.target.value)}
                    className="w-[80px] text-[11px] text-gray-700 placeholder-gray-400 outline-none bg-transparent"
                  />
                </div>

                {/* Card Filter */}
                <div className="relative" ref={clientNetCardFilterRef}>
                  <button onClick={() => setClientNetCardFilterOpen(v => !v)} className="h-[32px] px-2 rounded-lg border border-blue-200 bg-white text-[10px] font-medium flex items-center gap-1 text-gray-700">
                    <svg className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                    Cards
                  </button>
                  {clientNetCardFilterOpen && (
                    <div className="absolute left-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-40">
                      {Object.entries(clientNetCardsVisible).map(([k, v]) => (
                        <label key={k} className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-blue-50 cursor-pointer">
                          <input type="checkbox" checked={v} onChange={() => setClientNetCardsVisible(prev => ({ ...prev, [k]: !prev[k] }))} className="w-3 h-3" />
                          <span className="text-[10px] text-gray-700">{k === 'clientNetRows' ? 'NET Rows' : k === 'totalNetVolume' ? 'Total Volume' : k === 'totalNetPL' ? 'Total P/L' : 'Total Logins'}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Group Base Symbols */}
                <button
                  onClick={() => setGroupByBaseSymbol(v => !v)}
                  className={`h-[32px] px-2 rounded-lg border text-[10px] font-medium flex items-center gap-1 ${groupByBaseSymbol ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-blue-200'}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 10h10M10 14h7M13 18h4"/></svg>
                  Base
                </button>

                {/* Columns */}
                <div className="relative" ref={clientNetColumnSelectorRef}>
                  <button onClick={() => setClientNetShowColumnSelector(v => !v)} className="h-[32px] px-2 rounded-lg border border-purple-200 bg-white text-[10px] font-medium flex items-center gap-1 text-gray-700">
                    <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                    Cols
                  </button>
                  {clientNetShowColumnSelector && (
                    <div className="absolute left-0 top-full mt-1 bg-white rounded shadow-lg border border-gray-200 p-2 z-50 w-44 max-h-60 overflow-y-auto">
                      {Object.keys(clientNetVisibleColumns).map(k => (
                        <label key={k} className="flex items-center gap-1.5 py-1 px-1 rounded hover:bg-blue-50 cursor-pointer">
                          <input type="checkbox" checked={clientNetVisibleColumns[k]} onChange={() => setClientNetVisibleColumns(prev => ({ ...prev, [k]: !prev[k] }))} className="w-3 h-3" />
                          <span className="text-[10px] text-gray-700 capitalize">{
                            k === 'netType' ? 'NET Type' : 
                            k === 'netVolume' ? 'NET Volume' : 
                            k === 'avgPrice' ? 'Avg Price' : 
                            k === 'totalProfit' ? 'Total Profit' : 
                            k === 'totalStorage' ? 'Total Storage' :
                            k === 'totalCommission' ? 'Total Commission' :
                            k === 'totalPositions' ? 'Positions' : 
                            k
                          }</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <button
                  onClick={() => setClientNetCurrentPage(p => Math.max(1, p - 1))}
                  disabled={clientNetCurrentPage === 1}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${clientNetCurrentPage === 1 ? 'text-gray-300 bg-gray-100' : 'text-gray-700 bg-white border border-gray-300'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="text-[10px] font-medium text-gray-700">
                  <span className="font-semibold">{clientNetCurrentPage}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span>{clientNetTotalPages}</span>
                </div>
                <button
                  onClick={() => setClientNetCurrentPage(p => Math.min(clientNetTotalPages, p + 1))}
                  disabled={clientNetCurrentPage === clientNetTotalPages}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${clientNetCurrentPage === clientNetTotalPages ? 'text-gray-300 bg-gray-100' : 'text-gray-700 bg-white border border-gray-300'}`}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Client NET Table */}
            <div className="pt-3">
              <div className="bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <div className="min-w-full">
                  {/* Header */}
                  <div className="flex bg-[#1A63BC] text-white text-[10px] font-semibold h-[28px]">
                    {clientNetVisibleColumns.login && <div className="flex items-center justify-center px-1 min-w-[70px] flex-shrink-0 bg-[#1A63BC]">Login</div>}
                    {clientNetVisibleColumns.symbol && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Symbol</div>}
                    {clientNetVisibleColumns.netType && <div className="flex items-center justify-center px-1 min-w-[60px] flex-shrink-0 bg-[#1A63BC]">Type</div>}
                    {clientNetVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">NET Vol</div>}
                    {clientNetVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Avg Price</div>}
                    {clientNetVisibleColumns.totalProfit && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">P/L</div>}
                    {clientNetVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Storage</div>}
                    {clientNetVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Comm</div>}
                    {clientNetVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#1A63BC]">Positions</div>}
                  </div>

                  {/* Body */}
                  {clientNetPaginatedPositions.length === 0 ? (
                    <div className="text-center py-8 text-[#6B7280] text-sm">No Client NET positions found</div>
                  ) : (
                    clientNetPaginatedPositions.map((pos, idx) => (
                      <div key={idx} className="flex text-[10px] text-[#4B4B4B] border-b border-[#E1E1E1] hover:bg-[#F8FAFC]">
                        {clientNetVisibleColumns.login && <div className="flex items-center justify-center px-1 h-[40px] min-w-[70px] flex-shrink-0 font-semibold bg-white">{pos.login}</div>}
                        {clientNetVisibleColumns.symbol && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 font-semibold bg-white text-[#4B4B4B]">{pos.symbol}</div>}
                        {clientNetVisibleColumns.netType && <div className={`flex items-center justify-center px-1 h-[40px] min-w-[60px] flex-shrink-0 font-semibold bg-white ${
                          pos.netType === 'Buy' ? 'text-green-600' : 'text-red-600'
                        }`}>{pos.netType}</div>}
                        {clientNetVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.netVolume)}</div>}
                        {clientNetVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.avgPrice)}</div>}
                        {clientNetVisibleColumns.totalProfit && <div className={`flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 font-semibold bg-white ${
                          pos.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>{formatNum(pos.totalProfit)}</div>}
                        {clientNetVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.totalStorage || 0)}</div>}
                        {clientNetVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{formatNum(pos.totalCommission || 0)}</div>}
                        {clientNetVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 h-[40px] min-w-[80px] flex-shrink-0 bg-white text-[#4B4B4B]">{pos.totalPositions}</div>}
                      </div>
                    ))
                  )}

                  {/* Footer */}
                  {clientNetPaginatedPositions.length > 0 && (
                    <div className="flex bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-semibold h-[38px] border-t-2 border-[#1A63BC]">
                      {clientNetVisibleColumns.login && <div className="flex items-center justify-center px-1 min-w-[70px] flex-shrink-0 bg-[#EFF4FB]">Total</div>}
                      {clientNetVisibleColumns.symbol && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">-</div>}
                      {clientNetVisibleColumns.netType && <div className="flex items-center justify-center px-1 min-w-[60px] flex-shrink-0 bg-[#EFF4FB]">-</div>}
                      {clientNetVisibleColumns.netVolume && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(clientNetPositions.reduce((s,p)=>s+p.netVolume,0))}</div>}
                      {clientNetVisibleColumns.avgPrice && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">-</div>}
                      {clientNetVisibleColumns.totalProfit && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(clientNetPositions.reduce((s,p)=>s+p.totalProfit,0))}</div>}
                      {clientNetVisibleColumns.totalStorage && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(clientNetPositions.reduce((s,p)=>s+(p.totalStorage||0),0))}</div>}
                      {clientNetVisibleColumns.totalCommission && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{formatNum(clientNetPositions.reduce((s,p)=>s+(p.totalCommission||0),0))}</div>}
                      {clientNetVisibleColumns.totalPositions && <div className="flex items-center justify-center px-1 min-w-[80px] flex-shrink-0 bg-[#EFF4FB]">{clientNetPositions.reduce((s,p)=>s+p.totalPositions,0)}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
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
                  className="w-full h-12 pl-12 pr-4 bg-gray-100 border-0 rounded-xl text-[10px] text-black font-semibold font-outfit placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    login: true,
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

      {/* Client Details Modal */}
      {selectedClient && (
        <ClientDetailsMobileModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          allPositionsCache={positions}
        />
      )}
    </div>
  )
}
