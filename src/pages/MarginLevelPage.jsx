import { useEffect, useRef, useState, useMemo } from 'react'
import { useData } from '../contexts/DataContext'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'

// Helpers
const getMarginLevelPercent = (obj) => {
  // Common keys from accounts: margin_level, marginLevel, margin_percent, marginPercent, margin
  let val = obj?.margin_level ?? obj?.marginLevel ?? obj?.margin_percent ?? obj?.marginPercent ?? obj?.margin
  if (val === undefined || val === null) return undefined
  const n = Number(val)
  if (Number.isNaN(n)) return undefined
  // If looks like ratio (0..1), convert to percent
  if (n > 0 && n <= 1) return n * 100
  return n
}

const MarginLevelPage = () => {
  // Use cached data from DataContext
  const { accounts: cachedAccounts, fetchAccounts, loading, connectionState } = useData()
  
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [error, setError] = useState('')
  const hasInitialLoad = useRef(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchRef = useRef(null)
  
  // Column visibility states
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef(null)
  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    name: true,
    group: true,
    balance: true,
    equity: true,
    margin: true,
    marginFree: true,
    marginLevel: true,
    profit: false,
    credit: false,
    leverage: false,
    currency: false
  })

  const allColumns = [
    { key: 'login', label: 'Login' },
    { key: 'name', label: 'Name' },
    { key: 'group', label: 'Group' },
    { key: 'balance', label: 'Balance' },
    { key: 'equity', label: 'Equity' },
    { key: 'margin', label: 'Margin' },
    { key: 'marginFree', label: 'Free Margin' },
    { key: 'marginLevel', label: 'Margin Level' },
    { key: 'profit', label: 'Floating Profit' },
    { key: 'credit', label: 'Credit' },
    { key: 'leverage', label: 'Leverage' },
    { key: 'currency', label: 'Currency' }
  ]

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }
  
  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false)
      }
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target)) {
        setShowColumnSelector(false)
      }
    }
    
    if (showSuggestions || showColumnSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions, showColumnSelector])

  const filtered = useMemo(() => {
    const result = cachedAccounts.filter((a) => {
      const ml = getMarginLevelPercent(a)
      // Filter out zero margin levels and only show margin level < 50
      return ml !== undefined && ml !== 0 && ml < 50
    })
    // Store count in localStorage for sidebar badge
    localStorage.setItem('marginLevelCount', result.length)
    // Trigger storage event for other components
    window.dispatchEvent(new Event('marginLevelCountChanged'))
    return result
  }, [cachedAccounts])

  // Generate dynamic pagination options based on data count
  const generatePageSizeOptions = () => {
    const options = ['All']
    const totalCount = filtered.length
    
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
  
  // Search function
  const searchAccounts = (accountsToSearch) => {
    if (!searchQuery.trim()) {
      return accountsToSearch
    }
    
    const query = searchQuery.toLowerCase().trim()
    return accountsToSearch.filter(account => {
      const login = String(account.login || '').toLowerCase()
      const name = String(account.name || '').toLowerCase()
      const group = String(account.group || '').toLowerCase()
      
      return login.includes(query) || name.includes(query) || group.includes(query)
    })
  }
  
  const handleSuggestionClick = (suggestion) => {
    const value = suggestion.split(': ')[1]
    setSearchQuery(value)
    setShowSuggestions(false)
  }
  
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false)
    }
  }
  
  // Sorting function with type detection
  const sortAccounts = (accountsToSort) => {
    if (!sortColumn) return accountsToSort
    
    const sorted = [...accountsToSort].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      // Default to string comparison
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
  
  const searchedAccounts = searchAccounts(filtered)
  const sortedAccounts = sortAccounts(searchedAccounts)
  
  // Get search suggestions
  const getSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 1) {
      return []
    }
    
    const query = searchQuery.toLowerCase().trim()
    const suggestions = new Set()
    
    sortedAccounts.forEach(account => {
      const login = String(account.login || '')
      const name = String(account.name || '')
      const group = String(account.group || '')
      
      if (login.toLowerCase().includes(query)) {
        suggestions.add(`Login: ${login}`)
      }
      if (name.toLowerCase().includes(query) && name) {
        suggestions.add(`Name: ${name}`)
      }
      if (group.toLowerCase().includes(query) && group) {
        suggestions.add(`Group: ${group}`)
      }
    })
    
    return Array.from(suggestions).slice(0, 10)
  }
  
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
  
  // Pagination logic
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedAccounts.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedAccounts.length : startIndex + itemsPerPage
  const displayedAccounts = sortedAccounts.slice(startIndex, endIndex)
  
  // Reset to page 1 when items per page changes
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  const formatNumber = (n, digits = 2) => {
    const num = Number(n)
    if (Number.isNaN(num)) return '-'
    return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }

  if (loading.accounts) return <LoadingSpinner />

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} marginLevelCount={filtered.length} />

      <main className="flex-1 p-3 sm:p-4 lg:p-6 lg:ml-60 overflow-x-hidden relative">
        <div className="max-w-full mx-auto relative z-0">
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Margin Level</h1>
                <p className="text-xs text-gray-500 mt-0.5">Shows accounts with margin level &lt; 50% (excludes zero margin levels)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4 relative z-0">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Under 50%</p>
              <p className="text-lg font-semibold text-gray-900">{filtered.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Avg Margin Level</p>
              <p className="text-lg font-semibold text-gray-900">
                {filtered.length ? formatNumber(filtered.reduce((s,o)=>s+(getMarginLevelPercent(o)||0),0)/filtered.length, 2) + '%' : '-'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Unique Logins</p>
              <p className="text-lg font-semibold text-gray-900">{new Set(filtered.map(o=>o.login)).size}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Logins Under 50%</p>
              <p className="text-lg font-semibold text-gray-900">{new Set(filtered.map(a=>a.login)).size}</p>
            </div>
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
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search login, name, group..."
                    className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  />
                  <svg 
                    className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
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
                Showing {startIndex + 1} - {Math.min(endIndex, sortedAccounts.length)} of {sortedAccounts.length}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div className="overflow-x-auto">
              {displayedAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                  <p className="text-gray-500 text-sm">No accounts with margin level below 50%.</p>
                  <p className="text-gray-400 text-xs mt-1">Live updates will appear here</p>
                </div>
              ) : (
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 sticky top-0">
                    <tr>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('login')}
                      >
                        <div className="flex items-center gap-1">
                          Login
                          {sortColumn === 'login' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Name
                          {sortColumn === 'name' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('equity')}
                      >
                        <div className="flex items-center gap-1">
                          Equity
                          {sortColumn === 'equity' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('margin')}
                      >
                        <div className="flex items-center gap-1">
                          Margin
                          {sortColumn === 'margin' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('marginFree')}
                      >
                        <div className="flex items-center gap-1">
                          Margin Free
                          {sortColumn === 'marginFree' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('marginLevel')}
                      >
                        <div className="flex items-center gap-1">
                          Margin Level
                          {sortColumn === 'marginLevel' ? (
                            <span className="text-blue-600">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          ) : (
                            <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">↕</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {displayedAccounts.map((a, idx) => {
                      const ml = getMarginLevelPercent(a)
                      return (
                        <tr key={a.login ?? idx} className={`hover:bg-blue-50 transition-colors`}>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{a.login}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{a.name || '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(a.equity, 2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(a.margin, 2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(a.marginFree ?? a.margin_free, 2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-800`}>
                              {formatNumber(ml, 2)}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Connection status helper */}
          <div className="mt-4 bg-gray-50 rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-600">
              <strong>Status:</strong> {connectionState === 'connected' ? 'Live via WebSocket' : connectionState}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default MarginLevelPage
