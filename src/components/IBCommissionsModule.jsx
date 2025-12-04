import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { brokerAPI } from '../services/api'
import CustomizeViewModal from './CustomizeViewModal'
import FilterModal from './FilterModal'
import IBFilterModal from './IBFilterModal'
import GroupModal from './GroupModal'
import LoginGroupsModal from './LoginGroupsModal'
import LoginGroupModal from './LoginGroupModal'
import EditPercentageModal from './EditPercentageModal'
import { useIB } from '../contexts/IBContext'
import { useGroups } from '../contexts/GroupContext'

const formatNum = (n, decimals = 2) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default function IBCommissionsModule() {
  const navigate = useNavigate()
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
  const [filters, setFilters] = useState({})
  const carouselRef = useRef(null)
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false)
  const [columnSearch, setColumnSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [visibleColumns, setVisibleColumns] = useState({
    checkbox: true,
    id: true,
    name: true,
    email: true,
    percentage: true,
    total_commission: false,
    available_commission: false,
    last_synced_at: false,
    actions: true
  })

  // Edit modal states
  const [editingIB, setEditingIB] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)

  // Bulk update states
  const [selectedIBs, setSelectedIBs] = useState([])
  const [bulkPercentage, setBulkPercentage] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)

  // API State
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totals, setTotals] = useState({
    total_commission: 0,
    total_available_commission: 0,
    disbursed_commission: 0,
    available_rebate: 0
  })

  // Fetch data on mount
  useEffect(() => {
    fetchAllIBCommissions()
    fetchCommissionTotals()
  }, [])

  const fetchAllIBCommissions = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await brokerAPI.getIBCommissions(1, 1000, '', 'id', 'asc')
      
      const commissionsData = response.data?.records || []
      setCommissions(commissionsData)
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching IB commissions:', err)
      setError('Failed to load IB commissions')
      setLoading(false)
    }
  }

  const fetchCommissionTotals = async () => {
    try {
      const response = await brokerAPI.getIBCommissionTotals()
      if (response?.data?.data) {
        const data = response.data.data
        setTotals({
          total_commission: data.total_commission || 0,
          total_available_commission: data.total_available_commission || 0,
          disbursed_commission: (data.total_commission || 0) - (data.total_available_commission || 0),
          available_rebate: data.total_available_commission || 0
        })
      }
    } catch (err) {
      console.error('Error fetching commission totals:', err)
    }
  }

  // Use commissions data
  const commissionsData = commissions

  // Apply group and IB filters
  const groupFilteredData = useMemo(() => {
    return filterByActiveGroup(commissionsData, 'ibcommissions')
  }, [commissionsData, filterByActiveGroup, activeGroupFilters])

  const ibFilteredData = useMemo(() => {
    return filterByActiveIB(groupFilteredData)
  }, [groupFilteredData, filterByActiveIB, selectedIB, ibMT5Accounts])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalRebate = totals.total_commission
    const disbursedRebate = totals.disbursed_commission
    const availableRebate = totals.total_available_commission
    
    return {
      totalRebate,
      disbursedRebate,
      availableRebate
    }
  }, [totals])

  // Filter data based on search
  const filteredData = useMemo(() => {
    let filtered = ibFilteredData.filter(item => {
      if (!searchInput.trim()) return true
      const query = searchInput.toLowerCase()
      return (
        String(item.id || '').toLowerCase().includes(query) ||
        String(item.name || '').toLowerCase().includes(query) ||
        String(item.email || '').toLowerCase().includes(query) ||
        String(item.percentage || '').toLowerCase().includes(query)
      )
    })

    // Apply sorting
    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal = a[sortColumn]
        let bVal = b[sortColumn]

        if (sortColumn === 'percentage' || sortColumn === 'total_commission' || sortColumn === 'available_commission') {
          aVal = parseFloat(aVal) || 0
          bVal = parseFloat(bVal) || 0
          if (sortDirection === 'asc') {
            return aVal - bVal
          } else {
            return bVal - aVal
          }
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
      { label: 'TOTAL REBATE', value: formatNum(summaryStats.totalRebate, 2) },
      { label: 'DISBURSED REBATE', value: formatNum(summaryStats.disbursedRebate, 2) },
      { label: 'AVAILABLE REBATE', value: formatNum(summaryStats.availableRebate, 2) }
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
    { key: 'checkbox', label: 'Select', width: '60px', sticky: false },
    { key: 'id', label: 'ID', width: '80px', sticky: true },
    { key: 'name', label: 'Name', width: '150px' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'percentage', label: 'Percentage', width: '120px' },
    { key: 'total_commission', label: 'Total Rebate', width: '150px' },
    { key: 'available_commission', label: 'Available Rebate', width: '150px' },
    { key: 'last_synced_at', label: 'Last Synced', width: '150px' },
    { key: 'actions', label: 'Actions', width: '80px' }
  ]

  const activeColumns = allColumns.filter(col => visibleColumns[col.key])
  const gridTemplateColumns = activeColumns.map(col => col.width).join(' ')

  const renderCellValue = (item, key, isSticky = false) => {
    let value = '-'
    
    switch (key) {
      case 'checkbox':
        return (
          <div className="h-[28px] flex items-center justify-center px-1">
            <input
              type="checkbox"
              checked={selectedIBs.includes(item.id)}
              onChange={() => handleSelectIB(item.id)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
          </div>
        )
      case 'id':
        value = item.id || '-'
        break
      case 'name':
        value = item.name || '-'
        break
      case 'email':
        value = item.email || '-'
        break
      case 'percentage':
        value = item.percentage ? `${item.percentage}%` : '-'
        break
      case 'total_commission':
        value = formatNum(item.total_commission || 0, 2)
        break
      case 'available_commission':
        value = formatNum(item.available_commission || 0, 2)
        break
      case 'last_synced_at':
        value = item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : '-'
        break
      case 'actions':
        return (
          <div className="h-[28px] flex items-center justify-center px-1">
            <button 
              onClick={() => {
                setEditingIB(item)
                setShowEditModal(true)
              }}
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
            case 'id':
              value = item.id || '-'
              break
            case 'name':
              value = item.name || '-'
              break
            case 'email':
              value = item.email || '-'
              break
            case 'percentage':
              value = item.percentage || 0
              break
            case 'total_commission':
              value = formatNum(item.total_commission || 0, 2)
              break
            case 'available_commission':
              value = formatNum(item.available_commission || 0, 2)
              break
            case 'last_synced_at':
              value = item.last_synced_at ? new Date(item.last_synced_at).toLocaleString() : '-'
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
      link.download = `ib_commissions_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('[IBCommissionsModule] Export failed:', error)
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
    setActiveGroupFilter('ibcommissions', getActiveGroupFilter('ibcommissions'))
    setIsGroupOpen(true)
  }

  const handleGroupApply = (groupId) => {
    setActiveGroupFilter('ibcommissions', groupId)
    setIsGroupOpen(false)
  }

  const handleEditSuccess = () => {
    setShowEditModal(false)
    setEditingIB(null)
    fetchAllIBCommissions()
    fetchCommissionTotals()
  }

  // Handle select all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIBs(paginatedData.map(ib => ib.id))
    } else {
      setSelectedIBs([])
    }
  }

  // Handle individual checkbox
  const handleSelectIB = (ibId) => {
    setSelectedIBs(prev => {
      if (prev.includes(ibId)) {
        return prev.filter(id => id !== ibId)
      } else {
        return [...prev, ibId]
      }
    })
  }

  // Handle opening bulk update modal
  const handleOpenBulkModal = () => {
    if (selectedIBs.length === 0) {
      setError('Please select at least one IB by checking the checkboxes')
      setTimeout(() => setError(''), 3000)
      return
    }
    setShowBulkUpdateModal(true)
  }

  // Handle bulk update
  const handleBulkUpdate = async () => {
    const percentage = parseFloat(bulkPercentage)
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      setError('Please enter a valid percentage between 0 and 100')
      setTimeout(() => setError(''), 3000)
      return
    }

    try {
      setBulkUpdating(true)
      
      const updates = selectedIBs.map(id => ({
        id,
        percentage
      }))
      
      const response = await brokerAPI.bulkUpdateIBPercentages(updates)
      
      if (response.status === 'success') {
        setSelectedIBs([])
        setBulkPercentage('')
        setShowBulkUpdateModal(false)
        fetchAllIBCommissions()
        fetchCommissionTotals()
      } else {
        setError('Bulk update failed: ' + (response.message || 'Unknown error'))
        setTimeout(() => setError(''), 3000)
      }
    } catch (error) {
      console.error('Error during bulk update:', error)
      setError('Bulk update failed: ' + (error.response?.data?.message || error.message))
      setTimeout(() => setError(''), 3000)
    } finally {
      setBulkUpdating(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#F5F7FA] overflow-hidden">
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
            <h1 className="text-xl font-bold text-[#1F2937]">IB Commissions</h1>
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
        <div className="pt-3 pb-2">
          <div className="flex items-center justify-between mb-3">
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
                onClick={handleOpenBulkModal}
                className="h-[37px] px-3 rounded-[12px] bg-blue-600 border border-blue-600 shadow-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                title="Bulk Update Selected IBs"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 3.5V10.5M3.5 7H10.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-white text-[10px] font-medium font-outfit">Bulk Update</span>
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
                className="flex-shrink-0 w-[156px] h-[55px] snap-start bg-white rounded-[12px] border border-[#E1E1E1] shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-shadow cursor-move"
              >
                <div className="flex items-start justify-between">
                  <p className="text-[9px] font-medium text-[#6B7280] leading-tight uppercase tracking-wide">{card.label}</p>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3.33334V12.6667M8 12.6667L12 8.66667M8 12.6667L4 8.66667" stroke={
                      card.label.includes('DISBURSED') ? '#10B981' : 
                      card.label.includes('AVAILABLE') ? '#F59E0B' : 
                      '#3B82F6'
                    } strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-[#000000] text-lg font-bold leading-none">{card.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Search and Pagination Controls */}
        <div className="pb-2 px-4">
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
        <div>
          <div className="bg-white shadow-[0_0_20px_rgba(75,75,75,0.08)] overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Table Header */}
                <div 
                  className="grid bg-[#1E40AF] text-white text-[10px] font-bold uppercase tracking-wide sticky top-0 z-20"
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
                      onClick={() => col.key !== 'actions' && col.key !== 'checkbox' && handleSort(col.key)}
                      className={`h-[36px] flex items-center justify-center px-1 ${
                        col.key !== 'checkbox' ? 'cursor-pointer hover:bg-[#1E3A8A]' : ''
                      } transition-colors ${
                        col.sticky ? 'sticky left-0 z-30' : ''
                      }`}
                      style={{
                        border: 'none',
                        outline: 'none',
                        backgroundColor: '#1E40AF',
                        boxShadow: col.sticky ? '2px 0 4px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      {col.key === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={paginatedData.length > 0 && selectedIBs.length === paginatedData.length}
                          onChange={handleSelectAll}
                          className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      ) : (
                        <>
                          <span className="truncate">{col.label}</span>
                          {sortColumn === col.key && (
                            <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </>
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

      {/* Customize View Modal */}
      <CustomizeViewModal
        isOpen={isCustomizeOpen}
        onClose={() => setIsCustomizeOpen(false)}
        onIBFilterClick={() => {
          setIsCustomizeOpen(false)
          setIsIBFilterOpen(true)
        }}
      />

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(newFilters) => handleModalApply('filter', newFilters)}
        currentFilters={filters}
      />

      {/* IB Filter Modal */}
      <IBFilterModal
        isOpen={isIBFilterOpen}
        onClose={() => setIsIBFilterOpen(false)}
        onApply={(ibId) => handleModalApply('ibfilter', ibId)}
        selectedIB={selectedIB}
      />

      {/* Group Modal */}
      <GroupModal
        isOpen={isGroupOpen}
        onClose={() => setIsGroupOpen(false)}
        onApply={handleGroupApply}
        groups={groups}
        activeGroupId={getActiveGroupFilter('ibcommissions')}
        onCreateNew={() => {
          setIsGroupOpen(false)
          setEditingGroup(null)
          setIsLoginGroupModalOpen(true)
        }}
        onEdit={(group) => {
          setIsGroupOpen(false)
          setEditingGroup(group)
          setIsLoginGroupModalOpen(true)
        }}
        onDelete={(groupId) => {
          if (window.confirm('Are you sure you want to delete this group?')) {
            deleteGroup(groupId)
          }
        }}
      />

      {/* Login Groups Modal */}
      <LoginGroupsModal
        isOpen={isLoginGroupsOpen}
        onClose={() => setIsLoginGroupsOpen(false)}
        onCreateNew={() => {
          setIsLoginGroupsOpen(false)
          setEditingGroup(null)
          setIsLoginGroupModalOpen(true)
        }}
        onEdit={(group) => {
          setIsLoginGroupsOpen(false)
          setEditingGroup(group)
          setIsLoginGroupModalOpen(true)
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
        moduleName="ibcommissions"
      />

      {/* Edit Percentage Modal */}
      {showEditModal && editingIB && (
        <EditPercentageModal
          ib={editingIB}
          onClose={() => {
            setShowEditModal(false)
            setEditingIB(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Edit Percentage Modal */}
      {showEditModal && editingIB && (
        <EditPercentageModal
          ib={editingIB}
          onClose={() => {
            setShowEditModal(false)
            setEditingIB(null)
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Bulk Update Modal */}
      {showBulkUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Bulk Update Percentage
                </h3>
                <button
                  onClick={() => {
                    setShowBulkUpdateModal(false)
                    setBulkPercentage('')
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                  disabled={bulkUpdating}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Info Message */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Please check the IDs you want to update using the checkboxes in the table, then enter the percentage value to apply.
                </p>
              </div>

              {/* Selected IDs Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Selected IB IDs ({selectedIBs.length})
                </label>
                <div className="p-3 bg-gray-50 border-2 border-gray-300 rounded-lg min-h-[60px] max-h-[120px] overflow-y-auto">
                  {selectedIBs.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedIBs.map(id => (
                        <span
                          key={id}
                          className="inline-flex items-center px-2.5 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-md"
                        >
                          #{id}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm italic">No IDs selected</p>
                  )}
                </div>
              </div>

              {/* Percentage Input Field */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Percentage Value (%)
                </label>
                <input
                  type="number"
                  value={bulkPercentage}
                  onChange={(e) => setBulkPercentage(e.target.value)}
                  placeholder="Enter percentage (0-100)"
                  min="0"
                  max="100"
                  step="0.01"
                  className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  disabled={bulkUpdating}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  This percentage will be applied to all {selectedIBs.length} selected IB(s)
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => {
                  setShowBulkUpdateModal(false)
                  setBulkPercentage('')
                }}
                disabled={bulkUpdating}
                className="flex-1 px-4 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdate}
                disabled={bulkUpdating || selectedIBs.length === 0}
                className="flex-1 px-4 py-3 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {bulkUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Update All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Sidebar - Hidden */}
      {false && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 shadow-xl overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#2563EB] flex items-center justify-center text-white font-bold">
                    B
                  </div>
                  <span className="font-bold text-lg">Broker Eye</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>

              <nav className="space-y-2">
                {[
                  {label:'Dashboard', path:'/dashboard', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" stroke="#404040"/><rect x="14" y="3" width="7" height="7" stroke="#404040"/><rect x="3" y="14" width="7" height="7" stroke="#404040"/><rect x="14" y="14" width="7" height="7" stroke="#404040"/></svg>
                  )},
                  {label:'Clients', path:'/clients', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="#404040"/><circle cx="12" cy="7" r="4" stroke="#404040"/></svg>
                  )},
                  {label:'Client 2', path:'/client2', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#404040"/><circle cx="9" cy="7" r="4" stroke="#404040"/><path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#404040"/><path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#404040"/></svg>
                  )},
                  {label:'Positions', path:'/positions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M21 10L12 3 3 10v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9z" stroke="#404040"/></svg>
                  )},
                  {label:'Pending Orders', path:'/pending-orders', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#404040"/><path d="M12 6v6l4 2" stroke="#404040"/></svg>
                  )},
                  {label:'Live Dealing', path:'/live-dealing', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="#404040"/></svg>
                  )},
                  {label:'Margin Level', path:'/margin-level', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 18 0" stroke="#404040"/><path d="M7 12a5 5 0 0 1 10 0" stroke="#404040"/></svg>
                  )},
                  {label:'Client Percentage', path:'/client-percentage', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6" stroke="#404040"/><circle cx="8" cy="8" r="2" stroke="#404040"/><circle cx="16" cy="16" r="2" stroke="#404040"/></svg>
                  )},
                  {label:'IB Commissions', path:'/ib-commissions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#404040"/></svg>
                  )}
                ].map((item, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      navigate(item.path)
                      setIsSidebarOpen(false)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      window.location.pathname === item.path 
                        ? 'bg-[#2563EB] text-white' 
                        : 'text-[#404040] hover:bg-gray-100'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
