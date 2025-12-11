import { useState, useEffect, useRef } from 'react'
import { brokerAPI } from '../services/api'
import { useGroups } from '../contexts/GroupContext'
import { useIB } from '../contexts/IBContext'
import { useData } from '../contexts/DataContext'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import WebSocketIndicator from '../components/WebSocketIndicator'
import ClientPositionsModal from '../components/ClientPositionsModal'
import GroupSelector from '../components/GroupSelector'
import GroupModal from '../components/GroupModal'
import ClientPercentageModule from '../components/ClientPercentageModule'

const ClientPercentagePage = () => {
  // Detect mobile device
  const [isMobile, setIsMobile] = useState(false)
  
  const { filterByActiveGroup, activeGroupFilters, getActiveGroupFilter } = useGroups()
  const { filterByActiveIB, selectedIB, ibMT5Accounts } = useIB()
  const { positions: cachedPositions } = useData()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const v = localStorage.getItem('sidebarOpen')
      return v ? JSON.parse(v) : false
    } catch {
      return false
    }
  })
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLogin, setSelectedLogin] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    total_custom: 0,
    total_default: 0,
    default_percentage: 0
  })
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(200)
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)

  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef(null)
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    percentage: true,
    type: true,
    comment: true,
    updatedAt: true,
    actions: true,
  })

  const allColumns = [
    { key: 'login', label: 'Client Login', sticky: true },
    { key: 'percentage', label: 'Percentage' },
    { key: 'type', label: 'Type' },
    { key: 'comment', label: 'Comment' },
    { key: 'updatedAt', label: 'Last Updated' },
    { key: 'actions', label: 'Actions' },
  ]

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Column filter states
  const [columnFilters, setColumnFilters] = useState({})
  const [showFilterDropdown, setShowFilterDropdown] = useState(null)
  const filterRefs = useRef({})
  const [filterSearchQuery, setFilterSearchQuery] = useState({})
  const [showNumberFilterDropdown, setShowNumberFilterDropdown] = useState(null)
  const [showTextFilterDropdown, setShowTextFilterDropdown] = useState(null)
  
  // Custom filter modal states
  const [showCustomFilterModal, setShowCustomFilterModal] = useState(false)
  const [customFilterColumn, setCustomFilterColumn] = useState(null)
  const [customFilterType, setCustomFilterType] = useState('equal')
  const [customFilterValue1, setCustomFilterValue1] = useState('')
  const [customFilterValue2, setCustomFilterValue2] = useState('')
  const [customFilterOperator, setCustomFilterOperator] = useState('AND')

  // Column filter helper functions
  const getUniqueColumnValues = (columnKey) => {
    const values = new Set()
    clients.forEach(client => {
      const value = client[columnKey]
      if (value !== null && value !== undefined && value !== '') {
        values.add(value)
      }
    })
    const sortedValues = Array.from(values).sort((a, b) => {
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b
      }
      return String(a).localeCompare(String(b))
    })
    
    // Filter by search query if exists
    const searchQuery = filterSearchQuery[columnKey]?.toLowerCase() || ''
    if (searchQuery) {
      return sortedValues.filter(value => 
        String(value).toLowerCase().includes(searchQuery)
      )
    }
    
    return sortedValues
  }

  const toggleColumnFilter = (columnKey, value) => {
    setColumnFilters(prev => {
      const currentFilters = prev[columnKey] || []
      const newFilters = currentFilters.includes(value)
        ? currentFilters.filter(v => v !== value)
        : [...currentFilters, value]
      
      if (newFilters.length === 0) {
        const { [columnKey]: _, ...rest } = prev
        return rest
      }
      
      return { ...prev, [columnKey]: newFilters }
    })
  }

  const clearColumnFilter = (columnKey) => {
    setColumnFilters(prev => {
      const numberFilterKey = `${columnKey}_number`
      const { [columnKey]: _, [numberFilterKey]: __, ...rest } = prev
      return rest
    })
    setFilterSearchQuery(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })
    setShowFilterDropdown(null)
  }

  const selectAllFilters = (columnKey) => {
    const allValues = getUniqueColumnValues(columnKey)
    setColumnFilters(prev => ({
      ...prev,
      [columnKey]: allValues
    }))
  }

  const deselectAllFilters = (columnKey) => {
    setColumnFilters(prev => {
      const { [columnKey]: _, ...rest } = prev
      return rest
    })
  }

  const getActiveFilterCount = (columnKey) => {
    // Check for regular checkbox filters
    const checkboxCount = columnFilters[columnKey]?.length || 0
    
    // Check for number filter
    const numberFilterKey = `${columnKey}_number`
    const hasNumberFilter = columnFilters[numberFilterKey] ? 1 : 0
    
    return checkboxCount + hasNumberFilter
  }

  const isAllSelected = (columnKey) => {
    const allValues = getUniqueColumnValues(columnKey)
    const selectedValues = columnFilters[columnKey] || []
    return allValues.length > 0 && selectedValues.length === allValues.length
  }

  // Apply custom number filter
  const applyCustomNumberFilter = () => {
    if (!customFilterColumn || !customFilterValue1) return

    const isTextColumn = customFilterColumn === 'is_custom'
    const filterConfig = {
      type: customFilterType,
      value1: isTextColumn ? customFilterValue1 : parseFloat(customFilterValue1),
      value2: customFilterValue2 ? (isTextColumn ? customFilterValue2 : parseFloat(customFilterValue2)) : null,
      operator: customFilterOperator
    }

    const filterKey = isTextColumn ? `${customFilterColumn}_text` : `${customFilterColumn}_number`
    setColumnFilters(prev => ({
      ...prev,
      [filterKey]: filterConfig
    }))

    // Close modal and dropdown
    setShowCustomFilterModal(false)
    setShowFilterDropdown(null)
    setShowNumberFilterDropdown(null)
    setShowTextFilterDropdown(null)
    
    // Reset form
    setCustomFilterValue1('')
    setCustomFilterValue2('')
    setCustomFilterType('equal')
  }

  // Check if value matches number filter
  const matchesNumberFilter = (value, filterConfig) => {
    if (!filterConfig) return true
    
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return false

    const { type, value1, value2 } = filterConfig

    switch (type) {
      case 'equal':
        return numValue === value1
      case 'notEqual':
        return numValue !== value1
      case 'lessThan':
        return numValue < value1
      case 'lessThanOrEqual':
        return numValue <= value1
      case 'greaterThan':
        return numValue > value1
      case 'greaterThanOrEqual':
        return numValue >= value1
      case 'between':
        return value2 !== null && numValue >= value1 && numValue <= value2
      default:
        return true
    }
  }

  // Check if value matches text filter
  const matchesTextFilter = (value, filterConfig) => {
    if (!filterConfig) return true
    
    const strValue = String(value || '').toLowerCase()
    const { type, value1 } = filterConfig
    const searchValue = String(value1 || '').toLowerCase()

    switch (type) {
      case 'equal':
        return strValue === searchValue
      case 'notEqual':
        return strValue !== searchValue
      case 'startsWith':
        return strValue.startsWith(searchValue)
      case 'endsWith':
        return strValue.endsWith(searchValue)
      case 'contains':
        return strValue.includes(searchValue)
      case 'doesNotContain':
        return !strValue.includes(searchValue)
      default:
        return true
    }
  }
  
  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [editPercentage, setEditPercentage] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState('client_login')
  const [sortDirection, setSortDirection] = useState('asc')

  // Module filter removed (belongs to Live Dealing)

  useEffect(() => {
    fetchAllClientPercentages()
  }, [])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }
    
    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

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

  const handleEditClick = (client) => {
    setSelectedClient(client)
    setEditPercentage(client.percentage || '')
    setEditComment(client.comment || '')
    setShowEditModal(true)
  }

  const handleSavePercentage = async () => {
    if (!selectedClient) return
    
    const percentage = parseFloat(editPercentage)
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      alert('Please enter a valid percentage between 0 and 100')
      return
    }
    
    try {
      setSaving(true)
      await brokerAPI.setClientPercentage(
        selectedClient.client_login,
        percentage,
        editComment || `Custom percentage: ${percentage}%`
      )
      
      // Refresh the list
      await fetchAllClientPercentages()
      
      setShowEditModal(false)
      setSelectedClient(null)
      setEditPercentage('')
      setEditComment('')
      setSaving(false)
    } catch (err) {
      console.error('Error setting client percentage:', err)
      alert('Failed to save percentage. Please try again.')
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setShowEditModal(false)
    setSelectedClient(null)
    setEditPercentage('')
    setEditComment('')
  }

  // Search filtering
  const searchClients = () => {
    if (!searchQuery.trim()) return clients
    
    const query = searchQuery.toLowerCase()
    return clients.filter(client => 
      client.client_login?.toString().includes(query) ||
      client.comment?.toLowerCase().includes(query) ||
      client.percentage?.toString().includes(query)
    )
  }

  // Get autocomplete suggestions
  const getSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    
    const query = searchQuery.toLowerCase()
    const suggestions = new Set()
    
    clients.forEach(client => {
      if (client.client_login?.toString().includes(query)) {
        suggestions.add(client.client_login.toString())
      }
      if (client.percentage?.toString().includes(query)) {
        suggestions.add(`${client.percentage}%`)
      }
    })
    
    return Array.from(suggestions).slice(0, 10)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.replace('%', ''))
    setShowSuggestions(false)
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false)
    }
  }

  // Sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedClients = () => {
    const searched = searchClients(clients)
    
    // Apply group filter if active (use 'client_login' as the login field and 'clientpercentage' as module name)
    let groupFiltered = filterByActiveGroup(searched, 'client_login', 'clientpercentage')
    
    // Apply IB filter if active (use 'client_login' as the login field)
    let ibFiltered = filterByActiveIB(groupFiltered, 'client_login')
    
    // Apply column filters
    Object.entries(columnFilters).forEach(([columnKey, values]) => {
      if (columnKey.endsWith('_number')) {
        // Apply number filter
        const actualColumn = columnKey.replace('_number', '')
        ibFiltered = ibFiltered.filter(client => matchesNumberFilter(client[actualColumn], values))
      } else if (columnKey.endsWith('_text')) {
        // Apply text filter
        const actualColumn = columnKey.replace('_text', '')
        ibFiltered = ibFiltered.filter(client => matchesTextFilter(client[actualColumn], values))
      } else if (values && values.length > 0) {
        // Apply checkbox filter
        ibFiltered = ibFiltered.filter(client => {
          const clientValue = client[columnKey]
          // Special handling for is_custom field - compare boolean/number values
          if (columnKey === 'is_custom') {
            // Convert clientValue to comparable format
            const normalizedClientValue = clientValue === true || clientValue === 1 || clientValue === '1'
            return values.some(filterValue => {
              const normalizedFilterValue = filterValue === true || filterValue === 1 || filterValue === '1'
              return normalizedClientValue === normalizedFilterValue
            })
          }
          return values.includes(clientValue)
        })
      }
    })
    
    return [...ibFiltered].sort((a, b) => {
      let aVal = a[sortColumn]
      let bVal = b[sortColumn]
      
      // Handle nulls
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''
      
      // Convert to string for comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase()
      if (typeof bVal === 'string') bVal = bVal.toLowerCase()
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  // Pagination
  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const getAvailableOptions = () => {
    const totalItems = sortedClients().length
    const options = []
    
    // Start from 200 and increment by 200, dynamically based on total data
    for (let i = 200; i <= totalItems; i += 200) {
      options.push(i)
      if (options.length >= 10) break // Limit to 10 options
    }
    
    // If no options generated or total is less than 200, add at least one option
    if (options.length === 0) {
      options.push(Math.max(200, totalItems))
    }
    
    return options
  }

  const paginatedClients = () => {
    const sorted = sortedClients()
    const startIndex = (currentPage - 1) * itemsPerPage
    return sorted.slice(startIndex, startIndex + itemsPerPage)
  }

  const totalPages = Math.ceil(sortedClients().length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const displayedClients = paginatedClients()

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && filterRefs.current[showFilterDropdown]) {
        if (!filterRefs.current[showFilterDropdown].contains(event.target)) {
          setShowFilterDropdown(null)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showFilterDropdown])

  // Close column selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showColumnSelector && columnSelectorRef.current) {
        if (!columnSelectorRef.current.contains(event.target)) {
          setShowColumnSelector(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColumnSelector])

  // Helper function to render table header with filter
  const renderHeaderCell = (columnKey, label, sortKey = null) => {
    const filterCount = getActiveFilterCount(columnKey)
    const actualSortKey = sortKey || columnKey
    
    return (
      <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider hover:bg-blue-700 transition-colors select-none group border-b border-blue-500">
        <div className="flex items-center gap-2 justify-between">
          <div 
            className="flex items-center gap-1 cursor-pointer flex-1 text-white"
            onClick={() => {
              setSortColumn(actualSortKey)
              setSortDirection(prev => sortColumn === actualSortKey && prev === 'asc' ? 'desc' : 'asc')
            }}
          >
            <span>{label}</span>
            {getSortIcon(actualSortKey)}
          </div>
          
          <div className="relative" ref={el => {
            if (!filterRefs.current) filterRefs.current = {}
            filterRefs.current[columnKey] = el
          }}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowFilterDropdown(showFilterDropdown === columnKey ? null : columnKey)
              }}
              className={`p-1 rounded hover:bg-blue-700 transition-colors ${filterCount > 0 ? 'text-yellow-300' : 'text-white/80'}`}
              title="Filter column"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {filterCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-300 text-blue-900 text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {filterCount}
                </span>
              )}
            </button>

            {showFilterDropdown === columnKey && (
              <div className="fixed bg-white border border-gray-300 rounded shadow-2xl z-[9999] w-44" 
                style={{
                  top: `${filterRefs.current[columnKey]?.getBoundingClientRect().bottom + 5}px`,
                  left: (() => {
                    const rect = filterRefs.current[columnKey]?.getBoundingClientRect()
                    if (!rect) return '0px'
                    // Check if dropdown would go off-screen on the right
                    const dropdownWidth = 176 // 44 * 4 (w-44 in pixels)
                    const wouldOverflow = rect.left + dropdownWidth > window.innerWidth
                    // If would overflow, align to the right edge of the button
                    return wouldOverflow 
                      ? `${rect.right - dropdownWidth}px`
                      : `${rect.left}px`
                  })()
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-1.5 py-1 border-b border-gray-200 bg-gray-50 rounded-t">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-semibold text-gray-700">Filter Menu</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowFilterDropdown(null)
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Sort Options */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSort(columnKey)
                      setSortDirection('asc')
                    }}
                    className="w-full px-1.5 py-1 text-left text-[9px] text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                  >
                    <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    Sort Smallest to Largest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSort(columnKey)
                      setSortDirection('desc')
                    }}
                    className="w-full px-1.5 py-1 text-left text-[9px] text-gray-700 hover:bg-gray-50 flex items-center gap-1 border-t border-gray-100"
                  >
                    <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    Sort Largest to Smallest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearColumnFilter(columnKey)
                    }}
                    className="w-full px-1.5 py-1 text-left text-[9px] text-gray-700 hover:bg-gray-50 flex items-center gap-1 border-t border-gray-100"
                  >
                    <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Clear Filter
                  </button>
                </div>

                {/* Search Box */}
                <div className="p-1 border-b border-gray-200">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={filterSearchQuery[columnKey] || ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        setFilterSearchQuery(prev => ({
                          ...prev,
                          [columnKey]: e.target.value
                        }))
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-1.5 py-1 text-[9px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                    <svg className="absolute right-1 top-1 w-2.5 h-2.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Select All / Deselect All */}
                <div className="px-1.5 py-1 border-b border-gray-200 bg-gray-50">
                  <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isAllSelected(columnKey)}
                      onChange={(e) => {
                        e.stopPropagation()
                        if (e.target.checked) {
                          selectAllFilters(columnKey)
                        } else {
                          deselectAllFilters(columnKey)
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-2.5 h-2.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[9px] font-medium text-gray-700">SELECT ALL</span>
                  </label>
                </div>

                {/* Filter List */}
                <div className="max-h-48 overflow-y-auto">
                  <div className="p-1 space-y-0">
                    {getUniqueColumnValues(columnKey).length === 0 ? (
                      <div className="px-1.5 py-1.5 text-center text-[9px] text-gray-500">
                        No items found
                      </div>
                    ) : (
                      getUniqueColumnValues(columnKey).map(value => (
                        <label 
                          key={value} 
                          className="flex items-center gap-1 hover:bg-blue-50 px-1 py-1 rounded cursor-pointer transition-colors bg-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={(columnFilters[columnKey] || []).includes(value)}
                            onChange={(e) => {
                              e.stopPropagation()
                              toggleColumnFilter(columnKey, value)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-2.5 h-2.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-[9px] text-gray-700 font-medium truncate">
                            {value === true || value === 1 ? 'Custom' : value === false || value === 0 ? 'Default' : value}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-1.5 py-1 border-t border-gray-200 bg-gray-50 rounded-b flex items-center justify-end gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      clearColumnFilter(columnKey)
                    }}
                    className="px-1.5 py-1 text-[9px] text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    Clear
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowFilterDropdown(null)
                    }}
                    className="px-1.5 py-1 text-[9px] text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </th>
    )
  }

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 opacity-0 group-hover:opacity-40 text-white transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
      return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-white transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-white rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    )
  }

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
    return <ClientPercentageModule />
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => { setSidebarOpen(false); try { localStorage.setItem('sidebarOpen', JSON.stringify(false)) } catch {} }}
        onToggle={() => setSidebarOpen(v => { const n = !v; try { localStorage.setItem('sidebarOpen', JSON.stringify(n)) } catch {}; return n })}
      />
      
      <main className={`flex-1 p-3 sm:p-4 lg:p-6 ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-16'} flex flex-col overflow-hidden`}>
        <div className="max-w-full mx-auto w-full flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="mb-4">
            {/* Single Line Header Layout */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-white shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* Flex container for title and buttons */}
              <div className="flex items-center justify-between flex-1">
                {/* Title Section */}
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">Client Percentage</h1>
                  <p className="text-sm text-[#6B7280] mt-0.5">Manage custom profit-sharing percentages</p>
                </div>
                
                {/* Action Buttons - Groups on right side */}
                <div className="flex items-center gap-2">
                  <GroupSelector 
                    moduleName="clientpercentage" 
                    onCreateClick={() => {
                      console.log('[ClientPercentagePage] onCreateClick called')
                      console.log('[ClientPercentagePage] Current showGroupModal:', showGroupModal)
                      setEditingGroup(null)
                      setShowGroupModal(true)
                      console.log('[ClientPercentagePage] Set showGroupModal to true')
                    }}
                    onEditClick={(group) => {
                      console.log('[ClientPercentagePage] onEditClick called for group:', group)
                      setEditingGroup(group)
                      setShowGroupModal(true)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-r p-4 shadow-sm">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Summary Cards - Client2 Face Card Design */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Total Clients</span>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-[#2563EB] rounded-md flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="white" strokeWidth="1.2" fill="none"/>
                    <rect x="5.5" y="5.5" width="7" height="7" rx="1" fill="white" stroke="white" strokeWidth="1.2"/>
                  </svg>
                </div>
              </div>
              <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                <span>{stats.total}</span>
                <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">CLI</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Custom Percentages</span>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-[#2563EB] rounded-md flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="white" strokeWidth="1.2" fill="none"/>
                    <rect x="5.5" y="5.5" width="7" height="7" rx="1" fill="white" stroke="white" strokeWidth="1.2"/>
                  </svg>
                </div>
              </div>
              <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                <span>{stats.total_custom}</span>
                <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">CUST</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Using Default</span>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-[#2563EB] rounded-md flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="white" strokeWidth="1.2" fill="none"/>
                    <rect x="5.5" y="5.5" width="7" height="7" rx="1" fill="white" stroke="white" strokeWidth="1.2"/>
                  </svg>
                </div>
              </div>
              <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                <span>{stats.total_default}</span>
                <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">DEF</span>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-2 hover:md:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider leading-none">Default Percentage</span>
                <div className="w-4 h-4 md:w-5 md:h-5 bg-[#2563EB] rounded-md flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <rect x="1.5" y="1.5" width="7" height="7" rx="1" stroke="white" strokeWidth="1.2" fill="none"/>
                    <rect x="5.5" y="5.5" width="7" height="7" rx="1" fill="white" stroke="white" strokeWidth="1.2"/>
                  </svg>
                </div>
              </div>
              <div className="text-sm md:text-base font-bold text-[#000000] flex items-center gap-1.5 leading-none">
                <span>{stats.default_percentage}</span>
                <span className="text-[10px] md:text-xs font-normal text-[#6B7280]">%</span>
              </div>
            </div>
          </div>

          {/* Search and Controls Bar */}
          {sortedClients() && sortedClients().length > 0 && (
          <div className="mb-4 bg-white rounded-xl shadow-sm border border-[#F2F2F7] p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Left: Search and Columns */}
              <div className="flex items-center gap-2 flex-1">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md" ref={searchRef}>
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 18 18">
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                      setCurrentPage(1)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search"
                    className="w-full h-10 pl-10 pr-10 text-sm border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
                      title="Clear search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Suggestions Dropdown */}
                  {showSuggestions && getSuggestions().length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-50 max-h-60 overflow-y-auto">
                      {getSuggestions().map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-blue-50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Columns Button (icon only) */}
                <div className="relative">
                  <button
                    onClick={() => setShowColumnSelector(!showColumnSelector)}
                    className="h-10 w-10 rounded-lg bg-white border border-[#E5E7EB] shadow-sm flex items-center justify-center hover:bg-gray-50 transition-colors"
                    title="Show/Hide Columns"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="3" width="4" height="10" rx="1" stroke="#4B5563" strokeWidth="1.2"/>
                      <rect x="8" y="3" width="6" height="10" rx="1" stroke="#4B5563" strokeWidth="1.2"/>
                    </svg>
                  </button>
                  {showColumnSelector && (
                    <div
                      ref={columnSelectorRef}
                      className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-2 z-50 w-56"
                      style={{ maxHeight: '400px', overflowY: 'auto' }}
                    >
                      <div className="px-3 py-2 border-b border-[#F3F4F6]">
                        <p className="text-xs font-semibold text-[#1F2937] uppercase">Show/Hide Columns</p>
                      </div>
                      {allColumns.map(col => (
                        <label
                          key={col.key}
                          className="flex items-center px-3 py-1.5 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns[col.key]}
                            onChange={() => toggleColumn(col.key)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                          />
                          <span className="ml-2 text-sm text-[#374151]">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Pagination */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
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
                  onClick={() => handlePageChange(currentPage + 1)}
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
          )}

          {/* Table */}
          {clients.length === 0 && !loading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No client data found</h3>
              <p className="text-sm text-gray-500">Client percentage data will appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden flex flex-col flex-1">
              <div className="overflow-y-auto flex-1">
                <table className="min-w-full divide-y divide-[#E5E7EB]">
                <thead className="bg-blue-600 sticky top-0 z-10">
                  <tr>
                    {visibleColumns.login && renderHeaderCell('client_login', 'Client Login', 'client_login')}
                    {visibleColumns.percentage && renderHeaderCell('percentage', 'Percentage')}
                    {visibleColumns.type && renderHeaderCell('is_custom', 'Type', 'is_custom')}
                    {visibleColumns.comment && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Comment
                      </th>
                    )}
                    {visibleColumns.updatedAt && renderHeaderCell('updated_at', 'Last Updated', 'updated_at')}
                    {visibleColumns.actions && (
                      <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>

                {/* YouTube-style Loading Progress Bar */}
                {loading && (
                  <thead>
                    <tr>
                      <th colSpan={Object.values(visibleColumns).filter(v => v).length} className="p-0" style={{ height: '3px' }}>
                        <div className="relative w-full h-full bg-gray-200 overflow-hidden">
                          <style>{`
                            @keyframes shimmerSlidePercentage {
                              0% { transform: translateX(-100%); }
                              100% { transform: translateX(400%); }
                            }
                            .shimmer-loading-bar-percentage {
                              width: 30%;
                              height: 100%;
                              background: #2563eb;
                              animation: shimmerSlidePercentage 0.9s linear infinite;
                            }
                          `}</style>
                          <div className="shimmer-loading-bar-percentage absolute top-0 left-0 h-full" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                )}

                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-sm text-gray-400">
                        Loading client percentages...
                      </td>
                    </tr>
                  ) : displayedClients.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-gray-600 text-lg font-semibold mb-2">No clients found</p>
                            <p className="text-gray-500 text-sm mb-4">Try adjusting your filters</p>
                          </div>
                          <button
                            onClick={() => {
                              setColumnFilters({})
                              setFilterSearchQuery({})
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md text-sm font-semibold"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear All Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                  displayedClients.map((client, index) => (
                    <tr key={client.client_login} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {visibleColumns.login && (
                        <td 
                          className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer hover:underline"
                          onClick={() => setSelectedLogin(client.client_login)}
                          title="Click to view login details"
                        >
                          {client.client_login}
                        </td>
                      )}
                      {visibleColumns.percentage && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-sm font-semibold ${
                            client.is_custom 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {client.percentage}%
                          </span>
                        </td>
                      )}
                      {visibleColumns.type && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            client.is_custom 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {client.is_custom ? 'Custom' : 'Default'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.comment && (
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                          {client.comment || '-'}
                        </td>
                      )}
                      {visibleColumns.updatedAt && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {client.updated_at ? new Date(client.updated_at).toLocaleString() : '-'}
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEditClick(client)}
                            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {showEditModal && selectedClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Set Custom Percentage
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Client Login: <span className="font-medium text-gray-900">{selectedClient.client_login}</span>
              </p>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={editPercentage}
                  onChange={(e) => setEditPercentage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Enter percentage (0-100)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comment
                </label>
                <textarea
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="Optional comment about this percentage"
                />
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePercentage}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Percentage'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Group Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => {
          setShowGroupModal(false)
          setEditingGroup(null)
        }}
        availableItems={clients}
        loginField="client_login"
        displayField="percentage"
        secondaryField="type"
        editGroup={editingGroup}
      />

      {/* Custom Filter Modal */}
      {showCustomFilterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg shadow-xl w-96 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Custom Filter</h3>
              <button
                onClick={() => {
                  setShowCustomFilterModal(false)
                  setCustomFilterValue1('')
                  setCustomFilterValue2('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Show rows where:</p>
                <p className="text-sm text-gray-600 mb-3">{customFilterColumn}</p>
              </div>

              {/* Filter Type Dropdown */}
              <div>
                <select
                  value={customFilterType}
                  onChange={(e) => setCustomFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
                >
                  {customFilterColumn === 'is_custom' ? (
                    // Text filter options
                    <>
                      <option value="equal">Equal</option>
                      <option value="notEqual">Not Equal</option>
                      <option value="startsWith">Starts With</option>
                      <option value="endsWith">Ends With</option>
                      <option value="contains">Contains</option>
                      <option value="doesNotContain">Does Not Contain</option>
                    </>
                  ) : (
                    // Number filter options
                    <>
                      <option value="equal">Equal</option>
                      <option value="notEqual">Not Equal</option>
                      <option value="lessThan">Less Than</option>
                      <option value="lessThanOrEqual">Less Than Or Equal</option>
                      <option value="greaterThan">Greater Than</option>
                      <option value="greaterThanOrEqual">Greater Than Or Equal</option>
                      <option value="between">Between</option>
                    </>
                  )}
                </select>
              </div>

              {/* Value Input */}
              <div>
                <input
                  type={customFilterColumn === 'is_custom' ? 'text' : 'number'}
                  value={customFilterValue1}
                  onChange={(e) => setCustomFilterValue1(e.target.value)}
                  placeholder="Enter the value"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 bg-white"
                />
              </div>

              {/* Second Value for Between */}
              {customFilterType === 'between' && (
                <>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={customFilterOperator === 'AND'}
                        onChange={() => setCustomFilterOperator('AND')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">AND</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={customFilterOperator === 'OR'}
                        onChange={() => setCustomFilterOperator('OR')}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">OR</span>
                    </label>
                  </div>

                  <div>
                    <input
                      type="number"
                      value={customFilterValue2}
                      onChange={(e) => setCustomFilterValue2(e.target.value)}
                      placeholder="Enter the value"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setShowCustomFilterModal(false)
                  setCustomFilterValue1('')
                  setCustomFilterValue2('')
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyCustomNumberFilter}
                disabled={!customFilterValue1}
                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Positions Modal */}
      {selectedLogin && (
        <ClientPositionsModal
          client={{ login: selectedLogin }}
          onClose={() => setSelectedLogin(null)}
          onClientUpdate={() => {}}
          allPositionsCache={cachedPositions}
          onCacheUpdate={() => {}}
        />
      )}
    </div>
  )
}

export default ClientPercentagePage
