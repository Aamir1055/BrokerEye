import { useState, useEffect, useRef } from 'react'
import { brokerAPI } from '../services/api'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import WebSocketIndicator from '../components/WebSocketIndicator'

const ClientPercentagePage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    total_custom: 0,
    total_default: 0,
    default_percentage: 0
  })
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  
  // Groups states
  const [clientPctGroups, setClientPctGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('clientPctGroups')
      return saved ? JSON.parse(saved) : []
    } catch (err) {
      console.error('Failed to load client percentage groups:', err)
      return []
    }
  })
  const [selectedClients, setSelectedClients] = useState([])
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [groupSearchQuery, setGroupSearchQuery] = useState('')
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false)

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
    { key: 'login', label: 'Client Login' },
    { key: 'percentage', label: 'Percentage' },
    { key: 'type', label: 'Type' },
    { key: 'comment', label: 'Comment' },
    { key: 'updatedAt', label: 'Last Updated' },
    { key: 'actions', label: 'Actions' },
  ]

  const toggleColumn = (key) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }))
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
  
  // Save client percentage groups to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('clientPctGroups', JSON.stringify(clientPctGroups))
      console.log('Client percentage groups saved to localStorage:', clientPctGroups)
    } catch (err) {
      console.error('Failed to save client percentage groups:', err)
    }
  }, [clientPctGroups])

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
  
  // Group-related helper functions
  const getGroupSuggestions = (clientsData) => {
    if (!groupSearchQuery.trim()) {
      // Show first 50 clients by default when search is empty
      return clientsData.slice(0, 50)
    }
    
    const query = groupSearchQuery.toLowerCase()
    return clientsData.filter(client => {
      const login = String(client.client_login || '').toLowerCase()
      const comment = String(client.comment || '').toLowerCase()
      return login.includes(query) || comment.includes(query)
    })
  }
  
  const toggleClientSelection = (login) => {
    setSelectedClients(prev => {
      if (prev.includes(login)) {
        return prev.filter(l => l !== login)
      } else {
        return [...prev, login]
      }
    })
  }
  
  const createGroupFromSelected = () => {
    if (!newGroupName.trim()) {
      return
    }
    
    if (selectedClients.length === 0) {
      return
    }
    
    const newGroup = {
      name: newGroupName.trim(),
      clientLogins: [...selectedClients]
    }
    
    setClientPctGroups(prev => {
      const updatedGroups = [...prev, newGroup]
      console.log('Client percentage group created:', newGroup)
      console.log('Total groups:', updatedGroups.length)
      return updatedGroups
    })
    
    // Reset states
    setNewGroupName('')
    setSelectedClients([])
    setGroupSearchQuery('')
    setShowCreateGroupModal(false)
    setShowGroupSuggestions(false)
  }


  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion.replace('%', ''))
    setShowSuggestions(false)
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
    
    return [...searched].sort((a, b) => {
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
    const options = [10, 25, 50, 100, 200]
    
    return options.filter(opt => opt <= totalItems || opt === 50).concat(['All'])
  }

  const paginatedClients = () => {
    const sorted = sortedClients()
    if (itemsPerPage === 'All') return sorted
    
    const startIndex = (currentPage - 1) * itemsPerPage
    return sorted.slice(startIndex, startIndex + itemsPerPage)
  }

  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedClients().length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedClients().length : startIndex + itemsPerPage
  const displayedClients = paginatedClients()

  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-60">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Client Percentage</h1>
                <p className="text-sm text-gray-500">Manage custom profit-sharing percentages</p>
              </div>
            </div>
            <WebSocketIndicator />
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="text-indigo-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition-colors"
              title="Create client group"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-r p-4 shadow-sm">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Clients</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Custom Percentages</p>
              <p className="text-2xl font-semibold text-green-600">{stats.total_custom}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Using Default</p>
              <p className="text-2xl font-semibold text-purple-600">{stats.total_default}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Default Percentage</p>
              <p className="text-2xl font-semibold text-orange-600">{stats.default_percentage}%</p>
            </div>
          </div>

          {/* Pagination - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-lg shadow-sm border border-blue-100 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value === 'All' ? 'All' : parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {getAvailableOptions().map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <span className="text-sm text-gray-600">entries</span>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Page Navigation */}
              {itemsPerPage !== 'All' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded-md transition-colors ${
                      currentPage === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <span className="text-sm text-gray-700 font-medium px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded-md transition-colors ${
                      currentPage === totalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Module Type Filter removed per request (belongs to Live Dealing) */}

              {/* Columns Button */}
              <div className="relative">
                <button
                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Columns
                </button>
                {showColumnSelector && (
                  <div
                    ref={columnSelectorRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-56"
                    style={{ maxHeight: '400px', overflowY: 'auto' }}
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Show/Hide Columns</p>
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
                        <span className="ml-2 text-sm text-gray-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowSuggestions(true)
                      setCurrentPage(1)
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setShowSuggestions(false)
                      }
                    }}
                    placeholder="Search login, percentage..."
                    className="pl-9 pr-9 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 placeholder-gray-400 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('')
                        setShowSuggestions(false)
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Suggestions Dropdown */}
                {showSuggestions && getSuggestions().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto">
                    {getSuggestions().map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} - {Math.min(endIndex, sortedClients().length)} of {sortedClients().length}
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingSpinner />
          ) : clients.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No client data found</h3>
              <p className="text-sm text-gray-500">Client percentage data will appear here</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {visibleColumns.login && (
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => handleSort('client_login')}
                      >
                        <div className="flex items-center gap-1">
                          Client Login
                          {getSortIcon('client_login')}
                        </div>
                      </th>
                    )}
                    {visibleColumns.percentage && (
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => handleSort('percentage')}
                      >
                        <div className="flex items-center gap-1">
                          Percentage
                          {getSortIcon('percentage')}
                        </div>
                      </th>
                    )}
                    {visibleColumns.type && (
                      <th 
                        className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors"
                        onClick={() => handleSort('is_custom')}
                      >
                        <div className="flex items-center gap-1">
                          Type
                          {getSortIcon('is_custom')}
                        </div>
                      </th>
                    )}
                    {visibleColumns.comment && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Comment
                      </th>
                    )}
                    {visibleColumns.updatedAt && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Last Updated
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedClients.map((client, index) => (
                    <tr key={client.client_login} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {visibleColumns.login && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination - Bottom */}
        </main>
      </div>

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
      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Create Client Group</h3>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search and Select Clients
                </label>
                <input
                  type="text"
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  placeholder="Search by login, comment..."
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 mb-2"
                />
                
                {/* Client List - Always Visible */}
                <div className="bg-white rounded-md border border-gray-200">
                  <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-200 sticky top-0">
                    <p className="text-xs font-semibold text-indigo-700">
                      {selectedClients.length} client(s) selected • Showing {getGroupSuggestions(clients).length} clients
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {getGroupSuggestions(clients).length > 0 ? (
                      getGroupSuggestions(clients).map((client, idx) => (
                        <label key={idx} className="flex items-center px-3 py-2 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.client_login)}
                            onChange={() => toggleClientSelection(client.client_login)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">
                            <span className="font-medium">{client.client_login}</span> - {client.percentage}% ({client.type})
                          </span>
                        </label>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        No clients found
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {selectedClients.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Selected Clients ({selectedClients.length}):
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded">
                    {selectedClients.map((login, idx) => {
                      const client = clients.find(c => c.client_login === login)
                      return (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded">
                          {client ? `${login} - ${client.percentage}%` : login}
                          <button
                            onClick={() => toggleClientSelection(login)}
                            className="text-indigo-900 hover:text-indigo-700"
                          >
                            ×
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateGroupModal(false)
                  setNewGroupName('')
                  setSelectedClients([])
                  setGroupSearchQuery('')
                  setShowGroupSuggestions(false)
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createGroupFromSelected}
                className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClientPercentagePage
