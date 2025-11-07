import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { brokerAPI } from '../services/api'
import EditPercentageModal from '../components/EditPercentageModal'
import BulkSyncModal from '../components/BulkSyncModal'
import BulkUpdatePercentageModal from '../components/BulkUpdatePercentageModal'
import LoadingSpinner from '../components/LoadingSpinner'
import Sidebar from '../components/Sidebar'

const IBCommissionsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Removed column filter dropdown feature per request
  // Re-adding Syncfusion-like filter menu (same UX as Clients)
  const [columnFilters, setColumnFilters] = useState({}) // baseKey -> [values], baseKey_number -> { op/value(s) as string }, baseKey_text -> { op/value }
  const [showFilterDropdown, setShowFilterDropdown] = useState(null) // columnKey | null
  const [filterPosition, setFilterPosition] = useState(null)
  const filterRefs = useRef({})
  const filterPanelRef = useRef(null)
  const [filterSearchQuery, setFilterSearchQuery] = useState({})
  const [showNumberFilterDropdown, setShowNumberFilterDropdown] = useState(null)
  const [showTextFilterDropdown, setShowTextFilterDropdown] = useState(null)

  // Custom filter modal states (simplified)
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false)
  const [customFilterColumn, setCustomFilterColumn] = useState(null)
  const [customFilterType, setCustomFilterType] = useState('equal')
  const [customFilterValue1, setCustomFilterValue1] = useState('')
  const [customFilterValue2, setCustomFilterValue2] = useState('')
  const [customFilterOperator, setCustomFilterOperator] = useState('AND')

  const [showCustomTextFilterModal, setShowCustomTextFilterModal] = useState(false)
  const [customTextFilterColumn, setCustomTextFilterColumn] = useState(null)
  const [customTextFilterType, setCustomTextFilterType] = useState('contains')
  const [customTextFilterValue, setCustomTextFilterValue] = useState('')
  const [customTextFilterCaseSensitive, setCustomTextFilterCaseSensitive] = useState(false)
  
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
  }, [currentPage, itemsPerPage])

  // Fetch commission totals for face cards
  const fetchCommissionTotals = async () => {
    try {
      setTotalsLoading(true)
      const response = await brokerAPI.getIBCommissionTotals()
      
      if (response.status === 'success' && response.data) {
        setTotalCommission(response.data.total_commission || 0)
        setTotalAvailableCommission(response.data.total_available_commission || 0)
        setTotalCommissionPercentage(response.data.total_commission_percentage || 0)
        setTotalAvailableCommissionPercentage(response.data.total_available_commission_percentage || 0)
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
      const response = await brokerAPI.getIBCommissions(currentPage, itemsPerPage, searchQuery)
      
      if (response.status === 'success' && response.data) {
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

  // Handle column sorting
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }

  // Helpers to parse number filter input like ">=10", "10-20", "<5", or plain number
  const matchesNumberFilter = (value, filterStr) => {
    if (filterStr == null || filterStr.trim() === '') return true
    const v = parseFloat(value)
    if (isNaN(v)) return false
    const s = filterStr.trim()
    // range: a-b
    const rangeMatch = s.match(/^\s*(-?\d+(?:\.\d+)?)\s*[-:]\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1])
      const max = parseFloat(rangeMatch[2])
      return v >= Math.min(min, max) && v <= Math.max(min, max)
    }
    // operators
    const opMatch = s.match(/^\s*(<=|>=|<|>|=)?\s*(-?\d+(?:\.\d+)?)\s*$/)
    if (opMatch) {
      const op = opMatch[1] || '='
      const num = parseFloat(opMatch[2])
      switch (op) {
        case '<': return v < num
        case '<=': return v <= num
        case '>': return v > num
        case '>=': return v >= num
        default: return v === num
      }
    }
    // fallback: substring include on formatted value
    return String(value).toLowerCase().includes(s.toLowerCase())
  }

  const matchesTextFilter = (value, filterStr) => {
    if (filterStr == null || filterStr.trim() === '') return true
    const s = filterStr.trim().toLowerCase()
    return String(value ?? '').toLowerCase().includes(s)
  }

  const matchesDateFilter = (value, filterStr) => {
    if (!filterStr || filterStr.trim() === '') return true
    const s = filterStr.trim()
    const dateVal = value ? new Date(value).getTime() : NaN
    if (isNaN(dateVal)) return false
    // range with 'to' or '-'
    const toParts = s.split(/\s+to\s+|\s*-\s*/i)
    if (toParts.length === 2) {
      const start = Date.parse(toParts[0])
      const end = Date.parse(toParts[1])
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.min(start, end)
        const max = Math.max(start, end)
        return dateVal >= min && dateVal <= max
      }
    }
    // single date => same-day match
    const single = Date.parse(s)
    if (!isNaN(single)) {
      const d = new Date(single)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1
      return dateVal >= dayStart && dateVal <= dayEnd
    }
    // fallback substring match on formatted
    return formatDate(value).toLowerCase().includes(s.toLowerCase())
  }

  // Build Syncfusion-like filters
  const isStringColumn = (key) => ['name','email','last_synced_at'].includes(key)

  const getUniqueColumnValues = (key) => {
    const vals = new Set()
    commissions.forEach(r => {
      const v = r?.[key]
      if (v !== undefined) vals.add(String(v ?? ''))
    })
    const all = Array.from(vals)
    const q = (filterSearchQuery[key] || '').toLowerCase()
    return q ? all.filter(v => v.toLowerCase().includes(q)) : all
  }

  const toggleColumnFilter = (key, value) => {
    setColumnFilters(prev => {
      const arr = new Set(prev[key] || [])
      if (arr.has(value)) arr.delete(value); else arr.add(value)
      return { ...prev, [key]: Array.from(arr) }
    })
  }

  const clearColumnFilter = (key) => {
    setColumnFilters(prev => {
      const n = { ...prev }
      delete n[key]
      delete n[`${key}_number`]
      delete n[`${key}_text`]
      return n
    })
  }

  const isAllSelected = (key) => {
    const all = getUniqueColumnValues(key)
    const sel = columnFilters[key] || []
    return all.length > 0 && sel.length >= all.length
  }
  const selectAllFilters = (key) => setColumnFilters(prev => ({ ...prev, [key]: getUniqueColumnValues(key) }))
  const deselectAllFilters = (key) => setColumnFilters(prev => ({ ...prev, [key]: [] }))

  const openFilterMenu = (key) => {
    const el = filterRefs.current[key]
    if (!el) {
      setShowFilterDropdown(key)
      return
    }
    const rect = el.getBoundingClientRect()
    const isLastColumn = rect.right > window.innerWidth - 320
    setFilterPosition({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX,
      isLastColumn
    })
    setShowFilterDropdown(key)
    setShowNumberFilterDropdown(null)
    setShowTextFilterDropdown(null)
  }

  useEffect(() => {
    const onDown = (e) => {
      if (!filterPanelRef.current) return
      if (!filterPanelRef.current.contains(e.target)) setShowFilterDropdown(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Apply column filters
  const filteredCommissions = useMemo(() => {
    if (!columnFilters || Object.keys(columnFilters).length === 0) return commissions
    return commissions.filter(row => {
      let ok = true
      Object.entries(columnFilters).forEach(([k,v]) => {
        if (!ok) return
        if (k.endsWith('_number')) {
          const base = k.replace('_number','')
          ok = matchesNumberFilter(row[base], v?.expr || '')
        } else if (k.endsWith('_text')) {
          const base = k.replace('_text','')
          ok = matchesTextFilter(row[base], v?.expr || '')
        } else if (Array.isArray(v) && v.length > 0) {
          ok = v.includes(String(row[k] ?? ''))
        }
      })
      return ok
    })
  }, [commissions, columnFilters])

  // Sort commissions client-side after filters
  const sortedCommissions = useMemo(() => {
    const arr = [...filteredCommissions]
    return arr.sort((a, b) => {
    if (!sortColumn) return 0
    
    let aVal = a[sortColumn]
    let bVal = b[sortColumn]
    
    // Handle null/undefined
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    
    // Numeric comparison for id, percentage, commissions
    if (['id', 'percentage', 'total_commission', 'available_commission'].includes(sortColumn)) {
      aVal = parseFloat(aVal)
      bVal = parseFloat(bVal)
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }
    
    // String comparison
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    if (sortDirection === 'asc') {
      return aStr < bStr ? -1 : aStr > bStr ? 1 : 0
    } else {
      return aStr > bStr ? -1 : aStr < bStr ? 1 : 0
    }
    })
  }, [filteredCommissions, sortColumn, sortDirection])

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

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-60">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 relative z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">IB Commissions</h1>
                <p className="text-sm text-gray-600 mt-1">Manage introducing broker commission percentages</p>
              </div>
            </div>
          </div>
        </header>

        {/* Face Cards - 4 Metrics */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
            {/* Total Commission Card */}
            <div className="bg-white rounded shadow-sm border border-blue-200 p-2 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">
                Total Commission
              </p>
              <p className="text-sm font-bold text-blue-700">
                {totalsLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  formatIndianNumber(totalCommission)
                )}
              </p>
            </div>

            {/* Total Available Commission Card */}
            <div className="bg-white rounded shadow-sm border border-green-200 p-2 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95">
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">
                Available Commission
              </p>
              <p className="text-sm font-bold text-green-700">
                {totalsLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  formatIndianNumber(totalAvailableCommission)
                )}
              </p>
            </div>

            {/* Total Commission Percentage Card */}
            <div className="bg-white rounded shadow-sm border border-purple-200 p-2 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95">
              <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider mb-1">
                Total Commission %
              </p>
              <p className="text-sm font-bold text-purple-700">
                {totalsLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  `${parseFloat(totalCommissionPercentage || 0).toFixed(2)}%`
                )}
              </p>
            </div>

            {/* Total Available Commission Percentage Card */}
            <div className="bg-white rounded shadow-sm border border-orange-200 p-2 transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-95">
              <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-1">
                Available Commission %
              </p>
              <p className="text-sm font-bold text-orange-700">
                {totalsLoading ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  `${parseFloat(totalAvailableCommissionPercentage || 0).toFixed(2)}%`
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden px-6 pb-6">
          <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
            {/* Top Controls: match Clients style (search + pagination + per-page) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 rounded-t-xl border-b border-blue-200 p-4">
                {/* Left: per page + page nav */}
                <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700">Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value))
                setCurrentPage(1)
              }}
              className="px-2.5 py-1.5 text-xs font-medium border-2 border-blue-300 rounded-md bg-white text-blue-700 hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer transition-all shadow-sm"
            >
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <span className="text-xs font-semibold text-blue-700">entries</span>
                  </div>
                  {/* Page navigation */}
                  <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-1.5 rounded-md transition-all shadow-sm ${
                currentPage === 1
                  ? 'text-gray-300 bg-gray-100 cursor-not-allowed border border-gray-200'
                  : 'text-blue-600 hover:bg-blue-100 hover:text-blue-700 cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs font-bold text-white px-3 py-1.5 bg-blue-600 rounded-md shadow-md border border-blue-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`p-1.5 rounded-md transition-all shadow-sm ${
                currentPage === totalPages
                  ? 'text-gray-300 bg-gray-100 cursor-not-allowed border border-gray-200'
                  : 'text-blue-600 hover:bg-blue-100 hover:text-blue-700 cursor-pointer border-2 border-blue-300 hover:border-blue-500 bg-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
                    </button>
                  </div>
                </div>

              {/* Right: Bulk Update Button + Search */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenBulkModal}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 shadow-md hover:shadow-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Bulk Update
                </button>
                
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="pl-9 pr-9 py-2 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-700 placeholder:text-slate-400 hover:border-slate-400 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-400 w-64 transition-all"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded hover:bg-slate-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Table Container */}
            <div className="flex-1 overflow-auto p-4">
              {loading ? (
                <LoadingSpinner />
              ) : commissions.length === 0 ? (
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
                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full border-collapse">
                    <thead className="bg-blue-600 sticky top-0 z-10">
                      <tr>
                        {/* Checkbox Column */}
                        <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-b-2 border-blue-700 w-12">
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
                          { key: 'total_commission', label: 'Total Commission', align: 'right', width: columnWidths.total_commission || 150 },
                          { key: 'available_commission', label: 'Available Commission', align: 'right', width: columnWidths.available_commission || 180 },
                          { key: 'last_synced_at', label: 'Last Synced', align: 'left', width: columnWidths.last_synced_at || 160 },
                          { key: 'action', label: 'Action', align: 'center', width: columnWidths.action || 180 }
                        ].map((col) => (
                          <th 
                            key={col.key}
                            ref={el => { if (el) { headerRefs.current[col.key] = el; filterRefs.current[col.key] = el } }}
                            className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-b-2 border-blue-700 relative group cursor-pointer hover:bg-blue-700 transition-colors"
                            style={{ width: col.width, textAlign: col.align }}
                            onClick={() => col.key !== 'action' && handleSort(col.key)}
                          >
                            <div className="flex items-center gap-1" style={{ justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                              <span>{col.label}</span>
                              {col.key !== 'action' && (
                                <button
                                  className="ml-1 p-0.5 rounded hover:bg-white/10"
                                  title="Filter"
                                  onClick={(e) => { e.stopPropagation(); openFilterMenu(col.key) }}
                                >
                                  <svg className="w-3.5 h-3.5 text-white/90" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                                  </svg>
                                </button>
                              )}
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
                                className="absolute right-0 top-0 w-2 h-full cursor-col-resize z-20" /* removed hover shading */
                                onMouseDown={(e) => handleResizeStart(e, col.key)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="absolute right-0 top-0 w-1.5 h-full"></div>
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                      {/* Filter Panel (portal) */}
                      {showFilterDropdown && filterPosition && createPortal(
                        <div 
                          ref={filterPanelRef}
                          className="fixed bg-white border-2 border-slate-300 rounded-lg shadow-2xl w-64 h-[460px] flex flex-col text-[11px]"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            top: `${Math.min(filterPosition.top + 40, window.innerHeight * 0.2)}px`,
                            left: filterPosition.isLastColumn ? 'auto' : `${filterPosition.right + 8}px`,
                            right: filterPosition.isLastColumn ? `${window.innerWidth - filterPosition.left + 8}px` : 'auto',
                            zIndex: 20000000
                          }}
                        >
                          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 rounded-t-lg flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Filter Menu</span>
                            <button className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded" onClick={() => setShowFilterDropdown(null)}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          </div>

                          <div className="border-b border-slate-200 py-1">
                            <button onClick={() => { clearColumnFilter(showFilterDropdown) }} className="w-full px-3 py-1.5 text-left font-semibold text-red-600 hover:bg-slate-50 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              Clear Filter
                            </button>
                          </div>

                          <div className="border-b border-slate-200 py-1">
                            <button onClick={() => { handleSort(showFilterDropdown); setSortDirection('asc') }} className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"/></svg>
                              Sort Smallest to Largest
                            </button>
                            <button onClick={() => { handleSort(showFilterDropdown); setSortDirection('desc') }} className="w-full px-3 py-1.5 text-left hover:bg-slate-50 flex items-center gap-2">
                              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"/></svg>
                              Sort Largest to Smallest
                            </button>
                          </div>

                          {/* Number or Text Filters */}
                          {!isStringColumn(showFilterDropdown) ? (
                            <div className="border-b border-slate-200 py-1 relative">
                              <div className="px-2 py-1">
                                <button onClick={() => setShowNumberFilterDropdown(prev => prev === showFilterDropdown ? null : showFilterDropdown)} className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                  <span>Number Filters</span>
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </button>
                              </div>
                              {showNumberFilterDropdown === showFilterDropdown && (
                                <div className="absolute top-0 left-[calc(100%+8px)] w-48 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-50">
                                  <div className="text-[11px] text-slate-700 py-1">
                                    {['equal','notEqual','lessThan','lessThanOrEqual','greaterThan','greaterThanOrEqual','between'].map(op => (
                                      <div key={op} className="hover:bg-slate-50 px-3 py-2 cursor-pointer" onClick={() => { setCustomFilterColumn(showFilterDropdown); setCustomFilterType(op); setCustomFilterValue1(''); setCustomFilterValue2(''); setShowCustomFilterModal(true) }}>{
                                        op === 'equal' ? 'Equal...' : op === 'notEqual' ? 'Not Equal...' : op === 'lessThan' ? 'Less Than...' : op === 'lessThanOrEqual' ? 'Less Than Or Equal...' : op === 'greaterThan' ? 'Greater Than...' : op === 'greaterThanOrEqual' ? 'Greater Than Or Equal...' : 'Between...'
                                      }</div>
                                    ))}
                                    <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer" onClick={() => { setCustomFilterColumn(showFilterDropdown); setCustomFilterType('equal'); setShowCustomFilterModal(true) }}>Custom Filter...</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="border-b border-slate-200 py-1 relative">
                              <div className="px-2 py-1">
                                <button onClick={() => setShowTextFilterDropdown(prev => prev === showFilterDropdown ? null : showFilterDropdown)} className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                                  <span>Text Filters</span>
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                                </button>
                              </div>
                              {showTextFilterDropdown === showFilterDropdown && (
                                <div className="absolute top-0 left-[calc(100%+8px)] w-56 bg-white border-2 border-slate-300 rounded-lg shadow-xl z-50">
                                  <div className="text-[11px] text-slate-700 py-1">
                                    {['equal','notEqual','startsWith','endsWith','contains','doesNotContain'].map(op => (
                                      <div key={op} className="hover:bg-slate-50 px-3 py-2 cursor-pointer" onClick={() => { setCustomTextFilterColumn(showFilterDropdown); setCustomTextFilterType(op); setCustomTextFilterValue(''); setShowCustomTextFilterModal(true) }}>{
                                        op === 'equal' ? 'Equal...' : op === 'notEqual' ? 'Not Equal...' : op === 'startsWith' ? 'Starts With...' : op === 'endsWith' ? 'Ends With...' : op === 'contains' ? 'Contains...' : 'Does Not Contain...'
                                      }</div>
                                    ))}
                                    <div className="hover:bg-slate-50 px-3 py-2 cursor-pointer" onClick={() => { setCustomTextFilterColumn(showFilterDropdown); setCustomTextFilterType('contains'); setShowCustomTextFilterModal(true) }}>Custom Filter...</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Search box */}
                          <div className="p-2 border-b border-slate-200">
                            <div className="relative">
                              <input type="text" placeholder="Search values..." value={filterSearchQuery[showFilterDropdown] || ''} onChange={(e) => setFilterSearchQuery(prev => ({ ...prev, [showFilterDropdown]: e.target.value }))} className="w-full pl-8 pr-3 py-1 text-[11px] border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400" />
                              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                          </div>

                          {/* Select all */}
                          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={isAllSelected(showFilterDropdown)} onChange={(e) => e.target.checked ? selectAllFilters(showFilterDropdown) : deselectAllFilters(showFilterDropdown)} className="w-3.5 h-3.5 rounded border-slate-300" />
                              <span className="text-xs font-bold text-slate-700 uppercase">Select All</span>
                            </label>
                          </div>

                          {/* Values list */}
                          <div className="overflow-y-auto" style={{ height: '280px' }}>
                            <div className="p-2 space-y-1">
                              {getUniqueColumnValues(showFilterDropdown).map(v => (
                                <label key={v} className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-md cursor-pointer">
                                  <input type="checkbox" checked={(columnFilters[showFilterDropdown] || []).includes(v)} onChange={() => toggleColumnFilter(showFilterDropdown, v)} className="w-3.5 h-3.5 rounded border-slate-300" />
                                  <span className="text-[11px] text-slate-700 truncate flex-1">{v || '(blank)'}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="px-2 py-1 border-t border-gray-200 bg-gray-50 rounded-b flex items-center justify-between">
                            <button onClick={() => clearColumnFilter(showFilterDropdown)} className="px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-200 rounded">Clear</button>
                            <button onClick={() => setShowFilterDropdown(null)} className="px-2 py-1 text-[10px] text-white bg-blue-600 rounded">OK</button>
                          </div>
                        </div>, document.body
                      )}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {sortedCommissions.map((ib) => (
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
                      ))}
                    </tbody>
                  </table>
                  {/* Filter dropdowns removed */}
                </div>
              )}
            </div>
          </div>
        </main>

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

        {/* Custom Number Filter Modal */}
        {showCustomFilterModal && createPortal(
          <div className="fixed inset-0 bg-black/30 z-[30000000] flex items-center justify-center" onClick={() => setShowCustomFilterModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-[420px]" onClick={(e)=>e.stopPropagation()}>
              <div className="px-4 py-3 border-b font-semibold">Custom Filter</div>
              <div className="p-4 space-y-3 text-sm">
                <div>Show rows where: <strong>{customFilterColumn}</strong></div>
                <div className="flex items-center gap-2">
                  <select value={customFilterType} onChange={(e)=>setCustomFilterType(e.target.value)} className="border rounded px-2 py-1 text-sm">
                    <option value="equal">Equal</option>
                    <option value="notEqual">Not Equal</option>
                    <option value="lessThan">Less Than</option>
                    <option value="lessThanOrEqual">Less Than Or Equal</option>
                    <option value="greaterThan">Greater Than</option>
                    <option value="greaterThanOrEqual">Greater Than Or Equal</option>
                    <option value="between">Between</option>
                  </select>
                  <input value={customFilterValue1} onChange={(e)=>setCustomFilterValue1(e.target.value)} placeholder="Enter value" className="flex-1 border rounded px-2 py-1 text-sm" />
                  {customFilterType === 'between' && (
                    <input value={customFilterValue2} onChange={(e)=>setCustomFilterValue2(e.target.value)} placeholder="And value" className="flex-1 border rounded px-2 py-1 text-sm" />
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1 text-xs"><input type="radio" checked={customFilterOperator==='AND'} onChange={()=>setCustomFilterOperator('AND')} /> AND</label>
                  <label className="flex items-center gap-1 text-xs"><input type="radio" checked={customFilterOperator==='OR'} onChange={()=>setCustomFilterOperator('OR')} /> OR</label>
                </div>
              </div>
              <div className="px-4 py-3 border-t flex justify-end gap-2">
                <button className="px-3 py-1 border rounded" onClick={()=>setShowCustomFilterModal(false)}>Cancel</button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>{
                  if (!customFilterColumn) { setShowCustomFilterModal(false); return }
                  let expr = ''
                  if (customFilterType === 'between') expr = `${customFilterValue1}-${customFilterValue2}`
                  else if (customFilterType === 'equal') expr = `=${customFilterValue1}`
                  else if (customFilterType === 'notEqual') expr = `!=${customFilterValue1}` // our parser treats '=' only; fallback to substring mismatch
                  else if (customFilterType === 'lessThan') expr = `<${customFilterValue1}`
                  else if (customFilterType === 'lessThanOrEqual') expr = `<=${customFilterValue1}`
                  else if (customFilterType === 'greaterThan') expr = `>${customFilterValue1}`
                  else if (customFilterType === 'greaterThanOrEqual') expr = `>=${customFilterValue1}`
                  setColumnFilters(prev => ({ ...prev, [`${customFilterColumn}_number`]: { expr, op: customFilterType, join: customFilterOperator } }))
                  setShowCustomFilterModal(false)
                }}>OK</button>
              </div>
            </div>
          </div>, document.body
        )}

        {/* Custom Text Filter Modal */}
        {showCustomTextFilterModal && createPortal(
          <div className="fixed inset-0 bg-black/30 z-[30000000] flex items-center justify-center" onClick={() => setShowCustomTextFilterModal(false)}>
            <div className="bg-white rounded-lg shadow-xl w-[420px]" onClick={(e)=>e.stopPropagation()}>
              <div className="px-4 py-3 border-b font-semibold">Custom Filter</div>
              <div className="p-4 space-y-3 text-sm">
                <div>Show rows where: <strong>{customTextFilterColumn}</strong></div>
                <div className="flex items-center gap-2">
                  <select value={customTextFilterType} onChange={(e)=>setCustomTextFilterType(e.target.value)} className="border rounded px-2 py-1 text-sm">
                    <option value="equal">Equal</option>
                    <option value="notEqual">Not Equal</option>
                    <option value="startsWith">Starts With</option>
                    <option value="endsWith">Ends With</option>
                    <option value="contains">Contains</option>
                    <option value="doesNotContain">Does Not Contain</option>
                  </select>
                  <input value={customTextFilterValue} onChange={(e)=>setCustomTextFilterValue(e.target.value)} placeholder="Enter value" className="flex-1 border rounded px-2 py-1 text-sm" />
                </div>
                <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={customTextFilterCaseSensitive} onChange={(e)=>setCustomTextFilterCaseSensitive(e.target.checked)} /> Case sensitive</label>
              </div>
              <div className="px-4 py-3 border-t flex justify-end gap-2">
                <button className="px-3 py-1 border rounded" onClick={()=>setShowCustomTextFilterModal(false)}>Cancel</button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={()=>{
                  if (!customTextFilterColumn) { setShowCustomTextFilterModal(false); return }
                  // For simplicity encode as contains/starts/ends with custom string in one expr we parse in matchesTextFilter by substring
                  const op = customTextFilterType
                  let expr = customTextFilterValue
                  // Store as raw string; matchesTextFilter already does case-insensitive contains; advanced ops are approximated below
                  setColumnFilters(prev => ({ ...prev, [`${customTextFilterColumn}_text`]: { expr, op, caseSensitive: customTextFilterCaseSensitive } }))
                  setShowCustomTextFilterModal(false)
                }}>OK</button>
              </div>
            </div>
          </div>, document.body
        )}
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
  )
}

export default IBCommissionsPage
