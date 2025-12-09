import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../contexts/DataContext'
import { brokerAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import CustomizeViewModal from './CustomizeViewModal'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import SetCustomPercentageModal from './SetCustomPercentageModal'
import ClientDetailsMobileModal from './ClientDetailsMobileModal'
import { useIB } from '../contexts/IBContext'
import { useGroups } from '../contexts/GroupContext'

const formatNum = (n, decimals = 2) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function ClientPercentageModule() {
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
  const [isIBFilterOpen, setIsIBFilterOpen] = useState(false)
  const [isGroupOpen, setIsGroupOpen] = useState(false)
  const [isLoginGroupsOpen, setIsLoginGroupsOpen] = useState(false)
  const [isLoginGroupModalOpen, setIsLoginGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [filters, setFilters] = useState({ hasFloating: false, hasCredit: false, noDeposit: false })
  const [selectedClientForDetails, setSelectedClientForDetails] = useState(null)
  const carouselRef = useRef(null)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    percentage: true,
    type: true,
    comment: false,
    updatedAt: false,
    actions: true
  })

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)

  // API State
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    total_custom: 0,
    total_default: 0,
    default_percentage: 0
  })

  // Listen for global request to open Customize View from child modals
  useEffect(() => {
    const handler = () => {
      setIsFilterOpen(false)
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

  // Fetch data on mount
  useEffect(() => {
    fetchAllClientPercentages()
  }, [])

  const fetchAllClientPercentages = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await brokerAPI.getAllClientPercentages()
      
      const clientsData = response.data?.clients || []
      setClients(clientsData)
      setStats({
        total: response.data?.total || clientsData.length,
        total_custom: response.data?.total_custom || 0,
        total_default: response.data?.total_default || 0,
        default_percentage: response.data?.default_percentage || 0
      })
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching client percentages:', err)
      setError('Failed to load client percentages')
      setLoading(false)
    }
  }

  // Handle edit click
  const handleEditClick = (client) => {
    setSelectedClient(client)
    setShowEditModal(true)
  }

  // Handle edit success
  const handleEditSuccess = async () => {
    await fetchAllClientPercentages()
    setShowEditModal(false)
    setSelectedClient(null)
  }

  // Use clients data instead of placeholder
  const percentageData = clients

  // Apply group and IB filters
  const groupFilteredData = useMemo(() => {
    return filterByActiveGroup(percentageData, 'clientpercentage')
  }, [percentageData, filterByActiveGroup, activeGroupFilters])

  const ibFilteredData = useMemo(() => {
    return filterByActiveIB(groupFilteredData)
  }, [groupFilteredData, filterByActiveIB, selectedIB, ibMT5Accounts])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalClients = ibFilteredData.length
    const customClients = ibFilteredData.filter(c => c.is_custom).length
    const defaultClients = totalClients - customClients
    const avgPercentage = totalClients > 0 
      ? ibFilteredData.reduce((sum, c) => sum + (Number(c.percentage) || 0), 0) / totalClients 
      : 0
    
    return {
      totalClients,
      customClients,
      defaultClients,
      avgPercentage
    }
  }, [ibFilteredData])

  // Filter data based on search
  const filteredData = useMemo(() => {
    let filtered = ibFilteredData.filter(item => {
      if (!searchInput.trim()) return true
      const query = searchInput.toLowerCase()
      return (
        String(item.client_login || item.login || '').toLowerCase().includes(query) ||
        String(item.percentage || '').toLowerCase().includes(query) ||
        String(item.comment || '').toLowerCase().includes(query)
      )
    })

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]
        
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
    }

    return filtered
  }, [ibFilteredData, searchInput, sortColumn, sortDirection])

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
      { label: 'TOTAL CLIENTS', value: String(summaryStats.totalClients), numericValue: summaryStats.totalClients },
      { label: 'CUSTOM %', value: String(summaryStats.customClients), numericValue: summaryStats.customClients },
      { label: 'DEFAULT', value: String(summaryStats.defaultClients), numericValue: summaryStats.defaultClients },
      { label: 'AVG %', value: formatNum(summaryStats.avgPercentage, 2) + '%', numericValue: summaryStats.avgPercentage }
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

  // Pagination
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredData.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredData, currentPage, itemsPerPage])

  // Get visible columns
  const allColumns = [
    { key: 'login', label: 'Login', width: '100px', sticky: true },
    { key: 'percentage', label: 'Percentage', width: '120px' },
    { key: 'type', label: 'Type', width: '100px' },
    { key: 'comment', label: 'Comment', width: '200px' },
    { key: 'updatedAt', label: 'Last Updated', width: '150px' },
    { key: 'actions', label: 'Actions', width: '80px' }
  ]

  const activeColumns = allColumns.filter(col => visibleColumns[col.key])
  const gridTemplateColumns = activeColumns.map(col => col.width).join(' ')

  const renderCellValue = (item, key, isSticky = false) => {
    let value = '-'
    
    switch (key) {
      case 'login':
        value = item.client_login || item.login || '-'
        return (
          <div 
            className={`h-[28px] flex items-center justify-center px-1 cursor-pointer hover:underline text-blue-600 font-semibold ${isSticky ? 'sticky left-0 bg-white z-10' : ''}`}
            style={{
              border: 'none', 
              outline: 'none', 
              boxShadow: isSticky ? '2px 0 4px rgba(0,0,0,0.05)' : 'none'
            }}
            onClick={() => setSelectedClientForDetails({ login: value, email: '' })}
          >
            <span className="truncate">{value}</span>
          </div>
        )
      case 'percentage':
        value = item.percentage ? `${item.percentage}%` : '-'
        break
      case 'type':
        value = item.is_custom ? 'Custom' : 'Default'
        break
      case 'comment':
        value = item.comment || '-'
        break
      case 'updatedAt':
        value = item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'
        break
      case 'actions':
        return (
          <div className="h-[28px] flex items-center justify-center px-1">
            <button 
              onClick={() => handleEditClick(item)}
              className="text-blue-600 hover:text-blue-800 text-xs font-medium"
            >
              Edit
            </button>
          </div>
        )
      default:
        value = item[key] || '-'
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

  // Export to CSV
  const handleExportToCSV = () => {
    try {
      const dataToExport = filteredData
      if (!dataToExport || dataToExport.length === 0) {
        alert('No data to export')
        return
      }

      const exportColumns = activeColumns
      const headers = exportColumns.map(col => col.label).join(',')
      
      const rows = dataToExport.map(item => {
        return exportColumns.map(col => {
          let value = ''
          
          switch(col.key) {
            case 'login':
              value = item.client_login || item.login || '-'
              break
            case 'percentage':
              value = item.percentage || 0
              break
            case 'type':
              value = item.is_custom ? 'Custom' : 'Default'
              break
            case 'comment':
              value = item.comment || '-'
              break
            case 'updatedAt':
              value = item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'
              break
            case 'actions':
              value = 'N/A'
              break
            default:
              value = item[col.key] || '-'
          }
          
          if (typeof value === 'string') {
            value = value.replace(/"/g, '""')
            if (value.includes(',') || value.includes('"')) {
              value = `"${value}"`
            }
          }
          
          return value
        }).join(',')
      }).join('\n')
      
      const csvContent = headers + '\n' + rows
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `client_percentage_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[ClientPercentageModule] Export failed:', error)
      alert('Export failed. Please try again.')
    }
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleModalApply = (type, value) => {
    if (type === 'filter') {
      setFilters(value)
    } else if (type === 'ibfilter') {
      if (value) {
        selectIB(value)
      } else {
        clearIBSelection()
      }
    }
  }

  const handleOpenGroup = () => {
    setActiveGroupFilter('clientpercentage', getActiveGroupFilter('clientpercentage'))
    setIsGroupOpen(true)
  }

  const handleGroupApply = (groupId) => {
    setActiveGroupFilter('clientpercentage', groupId)
    setIsGroupOpen(false)
  }

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
    <div className="h-screen flex flex-col bg-[#F5F7FA] overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-gray-700 font-medium">Loading...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border-l-4 border-red-500 rounded-r p-4 shadow-lg z-50 max-w-md">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={() => setError('')}
            className="mt-2 text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sticky Header */}
      <div className="flex-shrink-0 bg-white border-b border-[#E5E7EB] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 12h18M3 6h18M3 18h18" stroke="#1F2937" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <h1 className="text-xl font-bold text-[#1F2937]">Client Percentage</h1>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-semibold hover:bg-[#1D4ED8] transition-colors"
          >
            U
          </button>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Action Buttons + View All */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-[8px]">
              <button 
                onClick={() => {
                  setIsCustomizeOpen(true)
                }} 
                className="h-[37px] px-3 rounded-[12px] bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4.5 6.5H9.5M2.5 3.5H11.5M5.5 9.5H8.5" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[#4B4B4B] text-[10px] font-medium font-outfit">Filters</span>
              </button>
              <button 
                onClick={handleExportToCSV}
                className="h-[37px] px-3 rounded-[12px] bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                title="Download as CSV"
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
                  flex: 'none',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'pan-x'
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

        {/* Search and Pagination Controls */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
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
                style={{ color: '#000000' }}
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
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredData.length / itemsPerPage), prev + 1))}
              disabled={currentPage >= Math.ceil(filteredData.length / itemsPerPage)}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="pb-4" style={{ maxWidth: '100vw', overflow: 'hidden' }}>
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

                {/* Table Body */}
                {paginatedData.map((item, idx) => (
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
                        {renderCellValue(item, col.key, col.sticky)}
                      </React.Fragment>
                    ))}
                  </div>
                ))}

                {/* Empty state */}
                {paginatedData.length === 0 && (
                  <div className="text-center py-8 text-[#9CA3AF] text-sm">
                    No data available
                  </div>
                )}
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
          setActiveGroupFilter('clientpercentage', null)
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
          selectIB(ib)
          setIsIBFilterOpen(false)
        }}
        onClearSelection={() => {
          clearIBSelection()
          setIsIBFilterOpen(false)
        }}
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
        activeGroupName={getActiveGroupFilter('clientpercentage')}
        onSelectGroup={(group) => {
          if (group === null) {
            setActiveGroupFilter('clientpercentage', null)
          } else {
            setActiveGroupFilter('clientpercentage', group.name)
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
        editingGroup={editingGroup}
        moduleName="clientpercentage"
      />

      {/* Column Selector Modal */}
      {isColumnSelectorOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-[9998]"
            onClick={() => setIsColumnSelectorOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[20px] z-[9999] max-h-[80vh] flex flex-col animate-slide-up">
            <div className="flex-shrink-0 pt-3 pb-4 px-5 border-b border-[#F2F2F7]">
              <div className="w-[47px] h-[2px] bg-[#E5E7EB] rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#000000] font-outfit">Show/Hide Columns</h2>
                <button 
                  onClick={() => setIsColumnSelectorOpen(false)}
                  className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M15 5L5 15M5 5L15 15" stroke="#000000" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              <div className="mb-3">
                <input 
                  type="text"
                  value={columnSearch}
                  onChange={(e) => setColumnSearch(e.target.value)}
                  placeholder="Search Columns"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {allColumns
                .filter(col => col.label.toLowerCase().includes(columnSearch.toLowerCase()))
                .map(col => (
                <label 
                  key={col.key} 
                  className="flex items-center justify-between py-3 border-b border-[#F2F2F7] last:border-0 cursor-pointer hover:bg-gray-50 px-2 rounded"
                >
                  <span className="text-sm text-[#000000] font-outfit">{col.label}</span>
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => toggleColumn(col.key)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>
            <div className="flex-shrink-0 px-5 py-3 border-t border-[#F2F2F7] flex gap-2">
              <button
                onClick={() => {
                  const allChecked = allColumns.every(col => visibleColumns[col.key])
                  const newState = {}
                  allColumns.forEach(col => {
                    newState[col.key] = !allChecked
                  })
                  setVisibleColumns(newState)
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {allColumns.every(col => visibleColumns[col.key]) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => setIsColumnSelectorOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {/* Sidebar */}
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
                  {label:'Client 2', path:'/client2', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#404040"/><circle cx="16" cy="8" r="3" stroke="#404040"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#404040"/></svg>
                  )},
                  {label:'Positions', path:'/positions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#404040"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="#404040"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="#404040"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="#404040"/></svg>
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
                  {label:'Client Percentage', path:'/client-percentage', active:true, icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6" stroke="#1A63BC"/><circle cx="8" cy="8" r="2" stroke="#1A63BC"/><circle cx="16" cy="16" r="2" stroke="#1A63BC"/></svg>
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
              <button onClick={logout} className="flex items-center gap-3 px-2 h-[37px] text-[10px] text-[#404040]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="#404040" strokeWidth="2"/><path d="M4 12h11" stroke="#404040" strokeWidth="2"/></svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Custom Percentage Modal */}
      {showEditModal && selectedClient && (
        <SetCustomPercentageModal
          client={selectedClient}
          onClose={() => {
            setShowEditModal(false)
            setSelectedClient(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Client Details Modal */}
      {selectedClientForDetails && (
        <ClientDetailsMobileModal
          client={selectedClientForDetails}
          onClose={() => setSelectedClientForDetails(null)}
          allPositionsCache={cachedPositions}
        />
      )}
    </div>
  )
}
