import { useState, useEffect, useRef } from 'react'
import { useData } from '../contexts/DataContext'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import ClientPositionsModal from '../components/ClientPositionsModal'
import WebSocketIndicator from '../components/WebSocketIndicator'

const ClientsPage = () => {
  const { clients: cachedClients, positions: cachedPositions, fetchClients, fetchPositions, loading, connectionState } = useData()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showDisplayMenu, setShowDisplayMenu] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const columnSelectorRef = useRef(null)
  const filterMenuRef = useRef(null)
  const displayMenuRef = useRef(null)
  const hasInitialLoad = useRef(false)
  
  // Use cached data
  const clients = cachedClients
  const positions = cachedPositions
  const isLoading = loading.clients || loading.positions
  
  // Filter states
  const [filterByPositions, setFilterByPositions] = useState(false)
  const [filterByDeals, setFilterByDeals] = useState(false)
  // Display mode for values vs percentages
  // 'value' | 'percentage' | 'both'
  const [displayMode, setDisplayMode] = useState('value')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'

  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  
  // Client Groups state
  const [clientGroups, setClientGroups] = useState(() => {
    // Load groups from localStorage on initial render
    try {
      const saved = localStorage.getItem('clientGroups')
      const groups = saved ? JSON.parse(saved) : []
      console.log('Loading client groups from localStorage:', groups.length, 'groups found')
      return groups
    } catch (error) {
      console.error('Failed to load client groups:', error)
      return []
    }
  })
  const [selectedClients, setSelectedClients] = useState([]) // Array of client login IDs for group creation
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [activeGroupFilter, setActiveGroupFilter] = useState(null) // null or group name
  const [groupSearchQuery, setGroupSearchQuery] = useState('') // Separate search for group modal
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false)
  
  // Column widths state (percentage based)
  const [columnWidths, setColumnWidths] = useState({})
  const [resizing, setResizing] = useState(null)
  const tableRef = useRef(null)

  // Default visible columns (matching the screenshot)
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    name: true,
    group: true,
    country: true,
    clientID: true,
    balance: true,
    equity: true,
    profit: true,
    // Hidden by default
    pnl: false,
    lastName: false,
    middleName: false,
    email: false,
    phone: false,
    credit: false,
    margin: false,
    marginFree: false,
    marginLevel: false,
    leverage: false,
    floating: false,
    currency: false,
    registration: false,
    lastAccess: false,
    rights: false,
    appliedPercentage: false,
    appliedPercentageIsCustom: false,
    assets: false,
    blockedCommission: false,
    blockedProfit: false,
    city: false,
    address: false,
    zipCode: false,
    state: false,
    company: false,
    comment: false,
    color: false,
    agent: false,
    leadCampaign: false,
    leadSource: false,
    liabilities: false,
    marginInitial: false,
    marginMaintenance: false,
    marginLeverage: false,
    soActivation: false,
    soEquity: false,
    soLevel: false,
    soMargin: false,
    soTime: false,
    status: false,
    storage: false,
    mqid: false,
    language: false,
    currencyDigits: false,
    rightsMask: false,
    accountLastUpdate: false,
    userLastUpdate: false,
    lastUpdate: false
  })

  const allColumns = [
    { key: 'login', label: 'Login' },
    { key: 'name', label: 'Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'middleName', label: 'Middle Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'group', label: 'Group' },
    { key: 'country', label: 'Country' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'address', label: 'Address' },
    { key: 'zipCode', label: 'Zip Code' },
    { key: 'clientID', label: 'Client ID' },
    { key: 'balance', label: 'Balance' },
    { key: 'credit', label: 'Credit' },
    { key: 'equity', label: 'Equity' },
    { key: 'margin', label: 'Margin' },
    { key: 'marginFree', label: 'Margin Free' },
    { key: 'marginLevel', label: 'Margin Level' },
    { key: 'marginInitial', label: 'Margin Initial' },
    { key: 'marginMaintenance', label: 'Margin Maintenance' },
    { key: 'marginLeverage', label: 'Margin Leverage' },
    { key: 'leverage', label: 'Leverage' },
    { key: 'profit', label: 'Floating Profit' },
    { key: 'pnl', label: 'PNL' },
    { key: 'floating', label: 'Floating' },
    { key: 'currency', label: 'Currency' },
    { key: 'currencyDigits', label: 'Currency Digits' },
    { key: 'appliedPercentage', label: 'Applied %' },
    { key: 'appliedPercentageIsCustom', label: 'Custom %' },
    { key: 'assets', label: 'Assets' },
    { key: 'liabilities', label: 'Liabilities' },
    { key: 'blockedCommission', label: 'Blocked Commission' },
    { key: 'blockedProfit', label: 'Blocked Profit' },
    { key: 'storage', label: 'Storage' },
    { key: 'company', label: 'Company' },
    { key: 'comment', label: 'Comment' },
    { key: 'color', label: 'Color' },
    { key: 'agent', label: 'Agent' },
    { key: 'leadCampaign', label: 'Lead Campaign' },
    { key: 'leadSource', label: 'Lead Source' },
    { key: 'soActivation', label: 'SO Activation' },
    { key: 'soEquity', label: 'SO Equity' },
    { key: 'soLevel', label: 'SO Level' },
    { key: 'soMargin', label: 'SO Margin' },
    { key: 'soTime', label: 'SO Time' },
    { key: 'status', label: 'Status' },
    { key: 'mqid', label: 'MQID' },
    { key: 'language', label: 'Language' },
    { key: 'registration', label: 'Registration' },
    { key: 'lastAccess', label: 'Last Access' },
    { key: 'lastUpdate', label: 'Last Update' },
    { key: 'accountLastUpdate', label: 'Account Last Update' },
    { key: 'userLastUpdate', label: 'User Last Update' },
    { key: 'rights', label: 'Rights' },
    { key: 'rightsMask', label: 'Rights Mask' }
  ]

  // Map base metric keys to their percentage field names from API
  const percentageFieldMap = {
    balance: 'balance_percentage',
    credit: 'credit_percentage',
    equity: 'equity_percentage',
    marginFree: 'marginFree_percentage',
    margin: 'margin_percentage',
    profit: 'profit_percentage',
    storage: 'storage_percentage',
    pnl: 'pnl_percentage'
  }

  const isMetricColumn = (key) => Object.prototype.hasOwnProperty.call(percentageFieldMap, key)

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      // Fetch data from context (will use cache if available)
      fetchClients().catch(err => console.error('Failed to load clients:', err))
      fetchPositions().catch(err => console.error('Failed to load positions:', err))
    }
  }, [fetchClients, fetchPositions])

  // Save client groups to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('clientGroups', JSON.stringify(clientGroups))
      console.log('Saved client groups to localStorage:', clientGroups.length, 'groups')
    } catch (error) {
      console.error('Failed to save client groups:', error)
    }
  }, [clientGroups])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target)) {
        setShowFilterMenu(false)
      }
      if (displayMenuRef.current && !displayMenuRef.current.contains(event.target)) {
        setShowDisplayMenu(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle column resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing || !tableRef.current) return
      
      const tableWidth = tableRef.current.offsetWidth
      const minWidth = 80 // minimum column width in pixels
      const minWidthPercent = (minWidth / tableWidth) * 100
      
      const deltaX = e.clientX - resizing.startX
      const newWidth = Math.max(minWidthPercent, resizing.startWidth + (deltaX / tableWidth) * 100)
      
      setColumnWidths(prev => ({
        ...prev,
        [resizing.columnKey]: newWidth
      }))
    }

    const handleMouseUp = () => {
      setResizing(null)
    }

    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizing])

  const handleResizeStart = (e, columnKey, currentWidth) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing({
      columnKey,
      startX: e.clientX,
      startWidth: currentWidth
    })
  }


  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }
  
  // Get filtered clients based on filter settings
  const getFilteredClients = () => {
    let filtered = [...clients]
    
    if (filterByPositions) {
      // Filter clients who have at least one position
      const clientsWithPositions = new Set(positions.map(p => p.login))
      filtered = filtered.filter(c => clientsWithPositions.has(c.login))
    }
    
    if (filterByDeals) {
      // For deals, we check if client has floating/profit values indicating trading activity
      filtered = filtered.filter(c => 
        (c.floating && Math.abs(c.floating) > 0) || 
        (c.profit && Math.abs(c.profit) > 0)
      )
    }
    
    return filtered
  }
  
  // Sorting function with type detection
  const sortClients = (clientsToSort) => {
    if (!sortColumn) return clientsToSort
    
    const sorted = [...clientsToSort].sort((a, b) => {
      // Determine actual field to sort by
      let sortKey = sortColumn
      let aVal
      let bVal

      // If sorting a virtual percentage display column in 'both' mode
      if (sortKey.endsWith('_percentage_display')) {
        const baseKey = sortKey.replace('_percentage_display', '')
        const percKey = percentageFieldMap[baseKey]
        aVal = percKey ? a[percKey] : undefined
        bVal = percKey ? b[percKey] : undefined
      } else if (displayMode === 'percentage' && isMetricColumn(sortKey)) {
        // In percentage mode, sort by percentage field for metric columns
        const percKey = percentageFieldMap[sortKey]
        aVal = percKey ? a[percKey] : undefined
        bVal = percKey ? b[percKey] : undefined
      } else {
        aVal = a[sortKey]
        bVal = b[sortKey]
      }
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number (including balance, equity, profit, etc.)
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum) && typeof aVal !== 'string') {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      // Check if it's a date/timestamp (registration, lastAccess)
      if ((sortColumn === 'registration' || sortColumn === 'lastAccess') && !isNaN(aVal) && !isNaN(bVal)) {
        const aTime = Number(aVal)
        const bTime = Number(bVal)
        return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
      }
      
      // Default to string comparison (alphabetical)
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr)
      } else {
        return bStr.localeCompare(aStr)
      }
    })
    
    return sorted
  }
  
  // Search helpers
  const searchClients = (list) => {
    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(c => {
      const login = String(c.login || '').toLowerCase()
      const name = String(c.name || '').toLowerCase()
      const email = String(c.email || '').toLowerCase()
      const phone = String(c.phone || '').toLowerCase()
      const group = String(c.group || '').toLowerCase()
      return login.includes(q) || name.includes(q) || email.includes(q) || phone.includes(q) || group.includes(q)
    })
  }

  const getSuggestions = (sorted) => {
    if (!searchQuery || typeof searchQuery !== 'string' || !searchQuery.trim() || searchQuery.length < 1) return []
    const q = searchQuery.toLowerCase().trim()
    const matchedClients = []
    sorted.forEach(c => {
      const login = String(c.login || '')
      const name = String(c.name || '')
      const email = String(c.email || '')
      const phone = String(c.phone || '')
      if (login.toLowerCase().includes(q) || name.toLowerCase().includes(q) || 
          email.toLowerCase().includes(q) || phone.toLowerCase().includes(q)) {
        matchedClients.push(c)
      }
    })
    return matchedClients.slice(0, 10)
  }

  const handleSuggestionClick = (client) => {
    setSearchQuery(String(client.login || ''))
    setShowSuggestions(false)
    setCurrentPage(1)
  }
  
  // Group modal search helpers
  const getGroupSuggestions = (sorted) => {
    // If no search query, show all clients (limited to first 50 for performance)
    if (!groupSearchQuery || typeof groupSearchQuery !== 'string' || !groupSearchQuery.trim()) {
      return sorted.slice(0, 50)
    }
    
    const q = groupSearchQuery.toLowerCase().trim()
    const matchedClients = []
    sorted.forEach(c => {
      const login = String(c.login || '')
      const name = String(c.name || '')
      const email = String(c.email || '')
      const phone = String(c.phone || '')
      if (login.toLowerCase().includes(q) || name.toLowerCase().includes(q) || 
          email.toLowerCase().includes(q) || phone.toLowerCase().includes(q)) {
        matchedClients.push(c)
      }
    })
    return matchedClients.slice(0, 50)
  }
  
  const toggleClientSelection = (login) => {
    setSelectedClients(prev => 
      prev.includes(login) ? prev.filter(l => l !== login) : [...prev, login]
    )
  }
  
  const createGroupFromSelected = () => {
    if (!newGroupName.trim()) {
      alert('Please enter a group name')
      return
    }
    if (selectedClients.length === 0) {
      alert('Please select at least one client')
      return
    }
    const newGroup = {
      name: newGroupName.trim(),
      clientLogins: [...selectedClients]
    }
    const updatedGroups = [...clientGroups, newGroup]
    setClientGroups(updatedGroups)
    
    // Debug: Log to console
    console.log('Group created:', newGroup)
    console.log('Total groups:', updatedGroups.length)
    
    // Show success message
    alert(`Group "${newGroup.name}" created successfully with ${newGroup.clientLogins.length} client(s)!`)
    
    setNewGroupName('')
    setSelectedClients([])
    setShowCreateGroupModal(false)
    setGroupSearchQuery('')
    setShowGroupSuggestions(false)
  }

  const filteredBase = getFilteredClients()
  const searchedBase = searchClients(filteredBase)
  
  // Apply group filter if active
  const groupFilteredBase = activeGroupFilter 
    ? searchedBase.filter(c => {
        const group = clientGroups.find(g => g.name === activeGroupFilter)
        return group && group.clientLogins.includes(c.login)
      })
    : searchedBase
  
  const filteredClients = sortClients(groupFilteredBase)
  
  // Handle column header click for sorting
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      // Toggle direction if same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(columnKey)
      setSortDirection('asc')
    }
  }
  
  // Generate dynamic pagination options based on data count
  const generatePageSizeOptions = () => {
    const options = ['All']
    const totalCount = filteredClients.length
    
    // Generate options incrementing by 50, up to total count
    for (let i = 50; i < totalCount; i += 50) {
      options.push(i)
    }
    
    // Always show total count as an option if it's not already included
    if (totalCount > 0 && totalCount % 50 !== 0 && !options.includes(totalCount)) {
      options.push(totalCount)
    }
    
    return options
  }
  
  const pageSizeOptions = generatePageSizeOptions()
  
  // Pagination logic
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(filteredClients.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? filteredClients.length : startIndex + itemsPerPage
  const displayedClients = filteredClients.slice(startIndex, endIndex)
  
  // Reset to page 1 when filters or items per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filterByPositions, filterByDeals, itemsPerPage, searchQuery, displayMode])
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const formatPercent = (value) => {
    if (value === null || value === undefined || value === '') return '-'
    const num = Number(value)
    if (isNaN(num)) return '-'
    // Header will carry the % label; values remain numeric
    return num.toFixed(2)
  }

  const formatValue = (key, value, client = null) => {
    if (value === null || value === undefined || value === '') {
      // Handle PNL calculation
      if (key === 'pnl' && client) {
        const pnl = (client.credit || 0) - (client.equity || 0)
        return pnl.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })
      }
      return '-'
    }
    
    // Numeric currency fields
    if (['balance', 'credit', 'equity', 'margin', 'marginFree', 'profit', 'floating', 'pnl', 'assets', 'liabilities', 
         'blockedCommission', 'blockedProfit', 'storage', 'marginInitial', 'marginMaintenance', 
         'soEquity', 'soMargin'].includes(key)) {
      // For PNL, calculate credit - equity
      if (key === 'pnl' && client) {
        const pnl = (client.credit || 0) - (client.equity || 0)
        return pnl.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })
      }
      return parseFloat(value).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })
    }
    
    // Percentage fields
    if (key === 'marginLevel' || key === 'appliedPercentage' || key === 'soLevel') {
      return value > 0 ? `${parseFloat(value).toFixed(2)}%` : '-'
    }
    
    // Integer fields
    if (['leverage', 'marginLeverage', 'agent', 'clientID', 'soActivation', 'soTime', 
         'currencyDigits', 'rightsMask', 'language'].includes(key)) {
      return parseInt(value).toLocaleString('en-US')
    }
    
    // Boolean fields
    if (key === 'appliedPercentageIsCustom') {
      return value ? 'Yes' : 'No'
    }
    
    // Date/timestamp fields (Unix timestamps in seconds)
    if (['registration', 'lastAccess', 'lastUpdate', 'accountLastUpdate', 'userLastUpdate'].includes(key)) {
      return new Date(value * 1000).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    
    // Array fields (rights)
    if (key === 'rights' && Array.isArray(value)) {
      return value.join(', ')
    }
    
    return value
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-x-hidden">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-white shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Clients</h1>
                <p className="text-xs text-gray-500 mt-0.5">Manage and view all client accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
              
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setShowFilterMenu(!showFilterMenu)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filter
                  {(filterByPositions || filterByDeals) && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      {(filterByPositions ? 1 : 0) + (filterByDeals ? 1 : 0)}
                    </span>
                  )}
                </button>
                {showFilterMenu && (
                  <div
                    ref={filterMenuRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-56"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Filter Options</p>
                    </div>
                    <div className="py-2">
                      <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={filterByPositions}
                          onChange={(e) => setFilterByPositions(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">Has Positions</span>
                      </label>
                      <label className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={filterByDeals}
                          onChange={(e) => setFilterByDeals(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="ml-2 text-sm text-gray-700">Has Deals</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

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
              
              {/* Groups Button */}
              <div className="relative">
                <button
                  onClick={() => setShowGroupsModal(!showGroupsModal)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Groups
                  {clientGroups.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                      {clientGroups.length}
                    </span>
                  )}
                  {activeGroupFilter && (
                    <span className="ml-1 px-1.5 py-0.5 bg-green-600 text-white text-xs rounded-full">
                      Active
                    </span>
                  )}
                </button>
                {showGroupsModal && (
                  <div
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-64"
                  >
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Client Groups</p>
                      <button
                        onClick={() => {
                          setShowCreateGroupModal(true)
                          setShowGroupsModal(false)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        + New
                      </button>
                    </div>
                    {clientGroups.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-gray-500">
                        No groups created yet
                      </div>
                    ) : (
                      <div className="py-1 max-h-80 overflow-y-auto">
                        <button
                          onClick={() => {
                            setActiveGroupFilter(null)
                            setShowGroupsModal(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            activeGroupFilter === null 
                              ? 'bg-blue-50 text-blue-700 font-medium' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          All Clients
                        </button>
                        {clientGroups.map((group, idx) => (
                          <div key={idx} className="flex items-center hover:bg-gray-50">
                            <button
                              onClick={() => {
                                setActiveGroupFilter(group.name)
                                setShowGroupsModal(false)
                              }}
                              className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${
                                activeGroupFilter === group.name 
                                  ? 'bg-blue-50 text-blue-700 font-medium' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {group.name}
                              <span className="ml-2 text-xs text-gray-500">
                                ({group.clientLogins.length})
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete group "${group.name}"?`)) {
                                  setClientGroups(clientGroups.filter((_, i) => i !== idx))
                                  if (activeGroupFilter === group.name) {
                                    setActiveGroupFilter(null)
                                  }
                                }
                              }}
                              className="px-2 py-2 text-red-600 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={fetchClients}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 bg-red-50 border-l-4 border-red-500 rounded-r p-3 shadow-sm">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
            {displayMode === 'value' && (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Clients</p>
                  <p className="text-base font-semibold text-gray-900">{filteredClients.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Balance</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-green-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Credit</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Equity</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">PNL</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Floating Profit</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
            {displayMode === 'percentage' && (
              <>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Clients</p>
                  <p className="text-base font-semibold text-gray-900">{filteredClients.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-green-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Credit %</p>
                  <p className="text-base font-semibold text-green-600">
                    {filteredClients.reduce((sum, c) => sum + (c.credit_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Balance %</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.balance_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Equity %</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.equity_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">PNL %</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Floating Profit %</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
            {displayMode === 'both' && (
              <>
                {/* Value Cards - First Row */}
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Clients</p>
                  <p className="text-base font-semibold text-gray-900">{filteredClients.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Balance</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-green-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Credit</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Equity</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.equity || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">PNL</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Floating Profit</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                
                {/* Percentage Indicator Card - Start of Second Row */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-2 flex items-center justify-center">
                  <p className="text-sm font-semibold text-blue-700 flex items-center gap-1">
                    By Percentage 
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </p>
                </div>
                
                {/* Percentage Cards - Second Row */}
                <div className="bg-white rounded-lg shadow-sm border border-green-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Credit %</p>
                  <p className="text-base font-semibold text-green-600">
                    {filteredClients.reduce((sum, c) => sum + (c.credit_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Balance %</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.balance_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Equity %</p>
                  <p className="text-base font-semibold text-gray-900">
                    {filteredClients.reduce((sum, c) => sum + (c.equity_percentage || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">PNL %</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.pnl_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-2">
                  <p className="text-[10px] text-gray-500 mb-0.5">Total Floating Profit %</p>
                  <p className={`text-base font-semibold ${filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '▲ ' : '▼ '}
                    {filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0) >= 0 ? '' : '-'}
                    {Math.abs(filteredClients.reduce((sum, c) => sum + (c.profit_percentage || 0), 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Pagination Controls - Top */}
          <div className="mb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-lg shadow-sm border border-blue-100 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(e.target.value === 'All' ? 'All' : parseInt(e.target.value))}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
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
              
              {/* Percentage View Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowDisplayMenu(!showDisplayMenu)}
                  className="text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-white border border-gray-300 transition-colors inline-flex items-center gap-1.5 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Percentage View
                </button>
                {showDisplayMenu && (
                  <div
                    ref={displayMenuRef}
                    className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 w-56"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Display Mode</p>
                    </div>
                    <div className="px-3 py-2 space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700 hover:bg-blue-50 p-2 rounded cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="value"
                          checked={displayMode === 'value'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span>Without Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 hover:bg-blue-50 p-2 rounded cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="percentage"
                          checked={displayMode === 'percentage'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span>Show My Percentage</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 hover:bg-blue-50 p-2 rounded cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="displayModeToggle"
                          value="both"
                          checked={displayMode === 'both'}
                          onChange={(e) => setDisplayMode(e.target.value)}
                          className="w-3.5 h-3.5 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span>Both</span>
                      </label>
                    </div>
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
                    onKeyDown={(e) => { if (e.key === 'Enter') setShowSuggestions(false) }}
                    placeholder="Search login, name, email..."
                    className="pl-9 pr-8 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setShowSuggestions(false) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {showSuggestions && getSuggestions(filteredClients).length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto">
                    {showCreateGroupModal && (
                      <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                        <p className="text-xs font-semibold text-blue-700">
                          Select clients for group ({selectedClients.length} selected)
                        </p>
                      </div>
                    )}
                    {getSuggestions(filteredClients).map((client, idx) => (
                      <div key={idx} className="flex items-center hover:bg-blue-50 transition-colors">
                        {showCreateGroupModal && (
                          <label className="flex items-center px-3 py-2 flex-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedClients.includes(client.login)}
                              onChange={() => toggleClientSelection(client.login)}
                              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700">
                              {client.login} - {client.name || 'N/A'}
                            </span>
                          </label>
                        )}
                        {!showCreateGroupModal && (
                          <button 
                            onClick={() => handleSuggestionClick(client)} 
                            className="w-full text-left px-3 py-2 text-sm text-gray-700"
                          >
                            {client.login} - {client.name || 'N/A'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div>
              <table ref={tableRef} className="w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    {(() => {
                      // Build the list of columns to render in header based on display mode
                      const baseVisible = allColumns.filter(c => visibleColumns[c.key])
                      const renderCols = []
                      baseVisible.forEach(col => {
                        const widthBaseTotal = baseVisible.length + (displayMode === 'both' ? baseVisible.filter(c => isMetricColumn(c.key)).length : 0)
                        const defaultWidth = 100 / widthBaseTotal
                        const width = columnWidths[col.key] || defaultWidth

                        // For base column header, adjust label if percentage mode and metric
                        const isMetric = isMetricColumn(col.key)
                        const headerLabel = (displayMode === 'percentage' && isMetric) ? `${col.label} %` : col.label

                        renderCols.push({ key: col.key, label: headerLabel, width, baseKey: col.key })

                        if (displayMode === 'both' && isMetric) {
                          // Add a virtual percentage column next to it
                          const virtKey = `${col.key}_percentage_display`
                          const virtWidth = columnWidths[virtKey] || defaultWidth
                          renderCols.push({ key: virtKey, label: `${col.label} %`, width: virtWidth, baseKey: col.key })
                        }
                      })

                      return renderCols.map(col => (
                        <th
                          key={col.key}
                          className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider relative group cursor-pointer hover:bg-blue-100 transition-colors"
                          style={{ width: `${col.width}%` }}
                          onClick={() => handleSort(col.key)}
                        >
                          <div className="flex items-center gap-1 truncate" title={col.label}>
                            <span>{col.label}</span>
                            {sortColumn === col.key && (
                              <svg
                                className={`w-3 h-3 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            )}
                            {sortColumn !== col.key && (
                              <svg
                                className="w-3 h-3 opacity-0 group-hover:opacity-30"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            )}
                          </div>
                          <div
                            className="absolute right-0 top-0 bottom-0 w-px cursor-col-resize bg-black opacity-30 hover:opacity-60"
                            onMouseDown={(e) => handleResizeStart(e, col.key, col.width)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ opacity: resizing?.columnKey === col.key ? 0.8 : undefined }}
                          />
                        </th>
                      ))
                    })()}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {displayedClients.map((client) => {
                    // Build render columns for each row consistent with header
                    const baseVisible = allColumns.filter(c => visibleColumns[c.key])
                    const renderCols = []
                    const widthBaseTotal = baseVisible.length + (displayMode === 'both' ? baseVisible.filter(c => isMetricColumn(c.key)).length : 0)
                    const defaultWidth = 100 / widthBaseTotal

                    baseVisible.forEach(col => {
                      const isMetric = isMetricColumn(col.key)
                      const colWidth = columnWidths[col.key] || defaultWidth

                      // Compute displayed value for base column
                      let titleVal
                      let displayVal
                      if (displayMode === 'percentage' && isMetric) {
                        const percKey = percentageFieldMap[col.key]
                        const val = percKey ? client[percKey] : undefined
                        titleVal = formatPercent(val)
                        displayVal = formatPercent(val)
                      } else {
                        titleVal = formatValue(col.key, client[col.key], client)
                        displayVal = formatValue(col.key, client[col.key], client)
                      }

                      renderCols.push({ key: col.key, width: colWidth, value: displayVal, title: titleVal })

                      if (displayMode === 'both' && isMetric) {
                        const virtKey = `${col.key}_percentage_display`
                        const virtWidth = columnWidths[virtKey] || defaultWidth
                        const percKey = percentageFieldMap[col.key]
                        const val = percKey ? client[percKey] : undefined
                        renderCols.push({ key: virtKey, width: virtWidth, value: formatPercent(val), title: formatPercent(val) })
                      }
                    })

                    return (
                      <tr
                        key={client.login}
                        onClick={() => setSelectedClient(client)}
                        className="hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        {renderCols.map(col => (
                          <td key={col.key} className="px-3 py-2 text-sm text-gray-900" style={{ width: `${col.width}%` }}>
                            <div className="truncate" title={col.title}>
                              {col.value}
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls - Bottom */}
          {itemsPerPage !== 'All' && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentPage === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                }`}
              >
                Previous
              </button>
              
              <div className="flex gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => handlePageChange(1)}
                      className="px-3 py-2 text-sm rounded-lg bg-white text-gray-700 hover:bg-blue-50 border border-gray-300"
                    >
                      1
                    </button>
                    {currentPage > 4 && <span className="px-2 py-2 text-gray-500">...</span>}
                  </>
                )}
                
                {/* Page numbers around current page */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage || 
                           page === currentPage - 1 || 
                           page === currentPage + 1 ||
                           (currentPage <= 2 && page <= 3) ||
                           (currentPage >= totalPages - 1 && page >= totalPages - 2)
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white font-medium'
                          : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                
                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && <span className="px-2 py-2 text-gray-500">...</span>}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      className="px-3 py-2 text-sm rounded-lg bg-white text-gray-700 hover:bg-blue-50 border border-gray-300"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  currentPage === totalPages
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-300'
                }`}
              >
                Next
              </button>
            </div>
          )}

        </div>
      </main>

      {/* Client Positions Modal */}
      {selectedClient && (
        <ClientPositionsModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onClientUpdate={fetchClients}
          allPositionsCache={cachedPositions}
          onCacheUpdate={(newAllPositions) => {
            // Positions are managed by DataContext, no need to update local state
          }}
        />
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
                  placeholder="Search by login, name, email..."
                  className="w-full px-3 py-2 text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 mb-2"
                />
                
                {/* Client List - Always Visible */}
                <div className="bg-white rounded-md border border-gray-200">
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 sticky top-0">
                    <p className="text-xs font-semibold text-blue-700">
                      {selectedClients.length} client(s) selected • Showing {getGroupSuggestions(clients).length} clients
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {getGroupSuggestions(clients).length > 0 ? (
                      getGroupSuggestions(clients).map((client, idx) => (
                        <label key={idx} className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                          <input
                            type="checkbox"
                            checked={selectedClients.includes(client.login)}
                            onChange={() => toggleClientSelection(client.login)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">
                            <span className="font-medium">{client.login}</span> - {client.name || 'N/A'}
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
                      const client = clients.find(c => c.login === login)
                      return (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                          {client ? `${client.login} - ${client.name || 'N/A'}` : login}
                          <button
                            onClick={() => toggleClientSelection(login)}
                            className="text-blue-900 hover:text-blue-700"
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
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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

export default ClientsPage
