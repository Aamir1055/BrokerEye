import { useState, useEffect, useRef, useMemo } from 'react'
import { brokerAPI } from '../services/api'
import EditPercentageModal from '../components/EditPercentageModal'
import BulkSyncModal from '../components/BulkSyncModal'
import BulkUpdatePercentageModal from '../components/BulkUpdatePercentageModal'
import LoadingSpinner from '../components/LoadingSpinner'
import Sidebar from '../components/Sidebar'
import IBCommissionsModule from '../components/IBCommissionsModule'

const IBCommissionsPage = () => {
  // Detect mobile device
  const [isMobile, setIsMobile] = useState(false)
  
  const getInitialSidebarOpen = () => {
    try {
      const v = localStorage.getItem('sidebarOpen')
      if (v === null) return false
      return JSON.parse(v)
    } catch { return false }
  }
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen)
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [editingIB, setEditingIB] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBulkSyncModal, setShowBulkSyncModal] = useState(false)
  
  // Face card states
  const [totalCommission, setTotalCommission] = useState(0)
  const [totalAvailableCommission, setTotalAvailableCommission] = useState(0)
  const [totalCommissionPercentage, setTotalCommissionPercentage] = useState(0)
  const [totalAvailableCommissionPercentage, setTotalAvailableCommissionPercentage] = useState(0)
  const [totalsLoading, setTotalsLoading] = useState(true)
  
  // Bulk update states
  const [selectedIBs, setSelectedIBs] = useState([])
  const [bulkPercentage, setBulkPercentage] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)
  
  // Sorting states - default to created_at desc as per API
  const [sortColumn, setSortColumn] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')
  
  // Column resizing states
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('ibColumnWidths')
      return saved ? JSON.parse(saved) : {}
    } catch (e) {
      return {}
    }
  })
  const [resizingColumn, setResizingColumn] = useState(null)
  const resizeStartX = useRef(0)
  const resizeStartWidth = useRef(0)
  const headerRefs = useRef({})
  const resizeRAF = useRef(null)
  
  // Search debounce
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    fetchCommissions()
    fetchCommissionTotals()
    
    // Set up hourly interval for fetching commission totals
    const intervalId = setInterval(() => {
      fetchCommissionTotals()
    }, 60 * 60 * 1000) // 1 hour in milliseconds
    
    // Cleanup interval on unmount
    return () => clearInterval(intervalId)
  }, [currentPage, itemsPerPage, sortColumn, sortDirection])

  // Fetch commission totals for face cards
  const fetchCommissionTotals = async () => {
    try {
      setTotalsLoading(true)
      const response = await brokerAPI.getIBCommissionTotals()
      if (response?.data?.data) {
        const data = response.data.data
        // Backend handles USC normalization; use values as-is
        setTotalCommission(data.total_commission || 0)
        setTotalAvailableCommission(data.total_available_commission || 0)
        setTotalCommissionPercentage(data.total_commission_percentage || 0)
        setTotalAvailableCommissionPercentage(data.total_available_commission_percentage || 0)
      }
    } catch (error) {
      console.error('Error fetching commission totals:', error)
    } finally {
      setTotalsLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      if (currentPage === 1) {
        fetchCommissions()
      } else {
        setCurrentPage(1) // Reset to page 1, which will trigger fetchCommissions via the first useEffect
      }
    }, 500)
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery])

  const fetchCommissions = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await brokerAPI.getIBCommissions(currentPage, itemsPerPage, searchQuery, sortColumn, sortDirection)
      
      if (response?.data) {
        setCommissions(response.data.records || [])
        const pagination = response.data.pagination || {}
        setTotalPages(pagination.total_pages || 1)
        setTotalRecords(pagination.total_records || 0)
      } else {
        setError('Failed to load IB commissions')
      }
    } catch (error) {
      console.error('Error fetching IB commissions:', error)
      setError(error.response?.data?.message || 'Failed to load IB commissions')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (ib) => {
    setEditingIB(ib)
    setShowEditModal(true)
  }

  const handleUpdateSuccess = () => {
    setShowEditModal(false)
    setEditingIB(null)
    fetchCommissions() // Refresh the list
    fetchCommissionTotals() // Refresh face card totals
  }

  const handleBulkSyncSuccess = () => {
    setShowBulkSyncModal(false)
    fetchCommissions() // Refresh the list
    fetchCommissionTotals() // Refresh face card totals
  }

  // Handle select all checkbox
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIBs(sortedCommissions.map(ib => ib.id))
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
      
      // Format updates array as expected by API
      const updates = selectedIBs.map(id => ({
        id,
        percentage
      }))
      
      const response = await brokerAPI.bulkUpdateIBPercentages(updates)
      
      if (response.status === 'success') {
        setSelectedIBs([])
        setBulkPercentage('')
        setShowBulkUpdateModal(false)
        fetchCommissions()
        fetchCommissionTotals() // Refresh face card totals
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

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toFixed(2)}`
  }

  // Format number in Indian currency format (no $ symbol, with commas)
  const formatIndianNumber = (value) => {
    if (value === null || value === undefined || isNaN(value)) return '0.00'
    const num = parseFloat(value).toFixed(2)
    const [intPart, decPart] = num.split('.')
    const lastThree = intPart.slice(-3)
    const otherDigits = intPart.slice(0, -3)
    const formatted = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (otherDigits ? ',' : '') + lastThree
    return `${formatted}.${decPart}`
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  // Handle column sorting - triggers API call via useEffect
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction if clicking same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column - default to desc for most cases, asc for name
      setSortColumn(columnKey)
      setSortDirection(columnKey === 'name' ? 'asc' : 'desc')
    }
  }

  // Since sorting is now done by API, use commissions directly
  const sortedCommissions = commissions

  // Column resize handlers
  const handleResizeStart = (e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    resizeStartX.current = e.clientX
    const measured = headerRefs.current?.[columnKey]?.getBoundingClientRect()?.width
    resizeStartWidth.current = measured || columnWidths[columnKey] || 150
  }

  const handleResizeMove = (e) => {
    if (!resizingColumn) return
    const diff = e.clientX - resizeStartX.current
    const nextWidth = Math.max(100, resizeStartWidth.current + diff)
    if (resizeRAF.current) cancelAnimationFrame(resizeRAF.current)
    resizeRAF.current = requestAnimationFrame(() => {
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: nextWidth }))
    })
  }

  const handleResizeEnd = () => {
    setResizingColumn(null)
  }

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
  }, [resizingColumn])

  // Persist column widths
  useEffect(() => {
    try {
      localStorage.setItem('ibColumnWidths', JSON.stringify(columnWidths))
    } catch (e) {}
  }, [columnWidths])

  // Detect mobile and update state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // If mobile, use mobile module (after all hooks are called)
  if (isMobile) {
    return <IBCommissionsModule />
  }

  return (
    <div className="h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50 overflow-hidden">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => { setSidebarOpen(false); try { localStorage.setItem('sidebarOpen', JSON.stringify(false)) } catch {} }}
        onToggle={() => setSidebarOpen(v => { const n = !v; try { localStorage.setItem('sidebarOpen', JSON.stringify(n)) } catch {}; return n })}
      />
      
      <main className={`flex-1 p-3 sm:p-4 lg:p-6 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'} flex flex-col overflow-hidden`}>
        <div className="max-w-full mx-auto w-full flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="mb-4">
            {/* Title and Subtitle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-white shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-[#1F2937]">IB Commissions</h1>
                <p className="text-sm text-[#6B7280] mt-0.5">Manage introducing broker commission percentages</p>
              </div>
            </div>
            
            {/* Separator */}
            <div className="border-b border-[#E5E7EB] my-3"></div>
            
            {/* Action Buttons Row - Removed as Bulk Update moved to header */}
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#6B7280] mb-1">Total Rebate</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {totalsLoading ? (
                  <span className="text-[#9CA3AF]">...</span>
                ) : (
                  formatIndianNumber(totalCommission)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#6B7280] mb-1">Available Rebate</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {totalsLoading ? (
                  <span className="text-[#9CA3AF]">...</span>
                ) : (
                  formatIndianNumber(totalAvailableCommission)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#6B7280] mb-1">Disbursed Rebate</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {totalsLoading ? (
                  <span className="text-[#9CA3AF]">...</span>
                ) : (
                  formatIndianNumber(totalCommission - totalAvailableCommission)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#6B7280] mb-1">Total Rebate %</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {totalsLoading ? (
                  <span className="text-[#9CA3AF]">...</span>
                ) : (
                  parseFloat(totalCommissionPercentage || 0).toFixed(2)
                )}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-[#6B7280] mb-1">Available Rebate %</p>
              <p className="text-xl font-bold text-[#1F2937]">
                {totalsLoading ? (
                  <span className="text-[#9CA3AF]">...</span>
                ) : (
                  parseFloat(totalAvailableCommissionPercentage || 0).toFixed(2)
                )}
              </p>
            </div>
          </div>

          {/* Search and Controls Bar */}
          <div className="mb-4 bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Left: Search and Bulk Update */}
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 18 18">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    className="w-full h-10 pl-10 pr-10 text-sm border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
                      title="Clear search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <button
                  onClick={handleOpenBulkModal}
                  className="inline-flex items-center gap-2 h-10 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Bulk Update
                </button>
              </div>

              {/* Right: Pagination */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    currentPage === 1
                      ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                      : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div className="px-3 py-1.5 text-sm font-medium text-[#374151]">
                  <span className="text-[#1F2937] font-semibold">{currentPage}</span>
                  <span className="text-[#9CA3AF] mx-1">/</span>
                  <span className="text-[#6B7280]">{totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    currentPage === totalPages
                      ? 'text-[#D1D5DB] bg-[#F9FAFB] cursor-not-allowed'
                      : 'text-[#374151] bg-white border border-[#E5E7EB] hover:bg-gray-50'
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden">
            <div className="h-full bg-white rounded-lg shadow-sm border border-[#E5E7EB] flex flex-col">
            
            {/* Error Message */}
            {error && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Table Container */}
            <div className="flex-1 overflow-auto p-4">
              {commissions.length === 0 && !loading ? (
                <div className="text-center py-16">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500 text-lg font-medium mb-2">No IB commissions found</p>
                  {searchQuery && (
                    <p className="text-gray-400 text-sm">
                      Try adjusting your search terms
                    </p>
                  )}
                </div>
              ) : (
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full border-collapse">
                    <thead className="bg-blue-600 sticky top-0 z-10">
                      <tr>
                        {/* Checkbox Column */}
                        <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-b-2 border-blue-700 w-12 hover:bg-blue-700/80 transition-colors">
                          <input
                            type="checkbox"
                            checked={sortedCommissions.length > 0 && selectedIBs.length === sortedCommissions.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                          />
                        </th>
                        {[ 
                          { key: 'id', label: 'ID', align: 'left', width: columnWidths.id || 80 },
                          { key: 'name', label: 'Name', align: 'left', width: columnWidths.name || 200 },
                          { key: 'email', label: 'Email', align: 'left', width: columnWidths.email || 250 },
                          { key: 'percentage', label: 'Percentage', align: 'left', width: columnWidths.percentage || 120 },
                          { key: 'total_commission', label: 'Total Rebate', align: 'right', width: columnWidths.total_commission || 150 },
                          { key: 'available_commission', label: 'Available Rebate', align: 'right', width: columnWidths.available_commission || 180 },
                          { key: 'last_synced_at', label: 'Last Synced', align: 'left', width: columnWidths.last_synced_at || 160 },
                          { key: 'action', label: 'Action', align: 'center', width: columnWidths.action || 180 }
                        ].map((col) => (
                          <th 
                            key={col.key}
                            ref={el => { if (el) headerRefs.current[col.key] = el }}
                            className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-b-2 border-blue-700 border-r border-blue-500/50 relative group cursor-pointer hover:bg-blue-700/80 transition-colors"
                            style={{ width: col.width, textAlign: col.align }}
                            onClick={() => col.key !== 'action' && handleSort(col.key)}
                          >
                            <div className="flex items-center gap-1" style={{ justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                              <span>{col.label}</span>
                              {sortColumn === col.key && col.key !== 'action' && (
                                <svg
                                  className={`w-3 h-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              )}
                            </div>
                            {/* Resize Handle */}
                            {col.key !== 'action' && (
                              <div 
                                className="absolute right-0 top-0 w-2 h-full cursor-col-resize z-20 hover:bg-blue-700/80" 
                                onMouseDown={(e) => handleResizeStart(e, col.key)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="absolute right-0 top-0 w-1.5 h-full"></div>
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                      {/* Filter Panel removed */}
                    </thead>

                    {/* YouTube-style Loading Progress Bar */}
                    {loading && (
                      <thead className="sticky z-40" style={{ top: '48px' }}>
                        <tr>
                          <th colSpan="9" className="p-0" style={{ height: '3px' }}>
                            <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                              <style>{`
                                @keyframes shimmerSlideIB {
                                  0% { transform: translateX(-100%); }
                                  100% { transform: translateX(400%); }
                                }
                                .shimmer-loading-bar-ib {
                                  width: 30%;
                                  height: 100%;
                                  background: #2563eb;
                                  animation: shimmerSlideIB 0.9s linear infinite;
                                }
                              `}</style>
                              <div className="shimmer-loading-bar-ib absolute top-0 left-0 h-full" />
                            </div>
                          </th>
                        </tr>
                      </thead>
                    )}

                    <tbody className="bg-white divide-y divide-gray-100">
                      {loading ? (
                        <tr>
                          <td colSpan="9" className="px-6 py-8 text-center text-sm text-gray-400">
                            Loading IB commissions...
                          </td>
                        </tr>
                      ) : (
                      sortedCommissions.map((ib) => (
                        <tr key={ib.id} className={`hover:bg-blue-50 transition-colors ${selectedIBs.includes(ib.id) ? 'bg-blue-100' : ''}`}>
                          {/* Checkbox Cell */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedIBs.includes(ib.id)}
                              onChange={() => handleSelectIB(ib.id)}
                              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ib.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {ib.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {ib.email}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">
                            {parseFloat(ib.percentage).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right tabular-nums">
                            {formatCurrency(ib.total_commission)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600 text-right tabular-nums">
                            {formatCurrency(ib.available_commission)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(ib.last_synced_at)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleEdit(ib)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-sm transition-colors"
                              title="Edit Percentage"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        {/* Bulk Sync Modal */}
        {showBulkSyncModal && (
          <BulkSyncModal
            isOpen={showBulkSyncModal}
            onClose={() => setShowBulkSyncModal(false)}
            onSuccess={handleBulkSyncSuccess}
          />
        )}

        {/* Edit Modal */}
        {showEditModal && editingIB && (
          <EditPercentageModal
            ib={editingIB}
            onClose={() => {
              setShowEditModal(false)
              setEditingIB(null)
            }}
            onSuccess={handleUpdateSuccess}
          />
        )}

        {/* Bulk Update Modal */}
        {showBulkUpdateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full transform transition-all">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 rounded-t-xl">
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
              <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowBulkUpdateModal(false)
                    setBulkPercentage('')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                  disabled={bulkUpdating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdating || !bulkPercentage || selectedIBs.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
                >
                  {bulkUpdating ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Update All
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
        </div>
      </main>
    </div>
  )
}

export default IBCommissionsPage
