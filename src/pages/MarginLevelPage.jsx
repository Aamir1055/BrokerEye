import { useEffect, useRef, useState, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import { brokerAPI } from '../services/api'
import websocketService from '../services/websocket'

// Helpers
const extractAccounts = (payload) => {
  if (!payload) return []
  // Common containers for accounts/clients
  const arr =
    payload?.data?.accounts ||
    payload?.accounts ||
    payload?.data?.clients ||
    payload?.clients ||
    payload?.data?.items ||
    payload?.items ||
    (Array.isArray(payload) ? payload : null)
  if (Array.isArray(arr)) return arr

  // Single account-like object
  const single = payload?.data?.account || payload?.account || payload?.data || (payload && typeof payload === 'object' && ('login' in payload || 'marginLevel' in payload) ? payload : null)
  if (single && typeof single === 'object') return [single]

  // Fallback heuristic: first array of objects with 'login'
  if (payload && typeof payload === 'object') {
    for (const v of Object.values(payload)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        const looksLikeAccount = v.some((it) => it && ('login' in it))
        if (looksLikeAccount) return v
      }
    }
  }
  return []
}

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

const normalizeWsMessage = (msg) => {
  try {
    if (!msg || typeof msg !== 'object') return { op: 'unknown', items: [], raw: msg }

    const type = (msg.type || msg.event || '').toString().toUpperCase()

    // Account event mapping
    const opMap = {
      ACCOUNT_UPDATED: 'update',
      ACCOUNT_UPDATE: 'update',
      ACCOUNT_CHANGED: 'update',
      ACCOUNT_MODIFIED: 'update',
      ACCOUNTS_SNAPSHOT: 'full',
    }

    if (opMap[type]) {
      // common shapes: {data:{account}}, {account}, {data}, etc
      const candidate = msg.data?.account ?? msg.account ?? msg.data ?? msg.payload ?? msg
      const items = extractAccounts(candidate)
      return { op: opMap[type], items, raw: msg }
    }

    if (type === 'ACCOUNTS' || type === 'CLIENTS') {
      const data = msg.data || msg
      const items = extractAccounts(data)
      const opRaw = (data?.op || data?.operation || data?.mode || data?.type || 'update').toString().toLowerCase()
      const op = ['full', 'snapshot'].includes(opRaw) ? 'full' : 'update'
      return { op, items, raw: msg }
    }

    return { op: 'unknown', items: [], raw: msg }
  } catch (e) {
    console.error('[MarginLevel] normalizeWsMessage error:', e)
    return { op: 'unknown', items: [], raw: msg }
  }
}

const MarginLevelPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionState, setConnectionState] = useState('disconnected')
  const fallbackPollingInterval = useRef(null)
  const hasInitialLoad = useRef(false)
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      fetchAccounts().finally(() => setLoading(false))
      websocketService.connect()
    }

    const unsubState = websocketService.onConnectionStateChange((state) => {
      setConnectionState(state)
      if (state === 'connected') stopFallbackPolling()
      if (state === 'disconnected' || state === 'failed') startFallbackPolling()
    })

  // channels for accounts/clients
  const unsubAccountsLower = websocketService.subscribe('accounts', (msg) => handleWsMessage(msg))
  const unsubAccountsUpper = websocketService.subscribe('ACCOUNTS', (msg) => handleWsMessage(msg))
  const unsubClientsLower = websocketService.subscribe('clients', (msg) => handleWsMessage(msg))
  const unsubClientsUpper = websocketService.subscribe('CLIENTS', (msg) => handleWsMessage(msg))

  // specific account events
  const unsubAccUpdated = websocketService.subscribe('ACCOUNT_UPDATED', (msg) => handleWsMessage(msg))
  const unsubAccUpdate = websocketService.subscribe('ACCOUNT_UPDATE', (msg) => handleWsMessage(msg))
  const unsubAccChanged = websocketService.subscribe('ACCOUNT_CHANGED', (msg) => handleWsMessage(msg))
  const unsubAccModified = websocketService.subscribe('ACCOUNT_MODIFIED', (msg) => handleWsMessage(msg))

    // debug
    const unsubAll = websocketService.subscribe('all', (data) => {
      try {
        const t = (data?.type || data?.event || '').toString().toUpperCase()
        const looksLikeAccounts = t.includes('ACCOUNT') || t === 'ACCOUNTS' || t === 'CLIENTS'
        if (looksLikeAccounts) {
          console.log('[MarginLevel][WS][ALL]', data)
        }
      } catch {}
    })

    return () => {
      unsubState()
      unsubAccountsLower()
      unsubAccountsUpper()
      unsubClientsLower()
      unsubClientsUpper()
      unsubAccUpdated()
      unsubAccUpdate()
      unsubAccChanged()
      unsubAccModified()
      unsubAll()
      stopFallbackPolling()
    }
  }, [])

  const fetchAccounts = async () => {
    try {
      setError('')
      const response = await brokerAPI.getClients()
      const items = extractAccounts(response?.data || response)
      setAccounts(items)
    } catch (e) {
      console.error('[MarginLevel] Failed to fetch accounts:', e)
      setError(e?.response?.data?.message || 'Failed to load accounts')
    }
  }

  const startFallbackPolling = () => {
    if (fallbackPollingInterval.current) return
    fallbackPollingInterval.current = setInterval(() => {
      fetchAccounts().catch(() => {})
    }, 5000)
  }

  const stopFallbackPolling = () => {
    if (fallbackPollingInterval.current) {
      clearInterval(fallbackPollingInterval.current)
      fallbackPollingInterval.current = null
    }
  }

  const handleWsMessage = (msg) => {
    const { op, items } = normalizeWsMessage(msg)
    if (op === 'unknown' || !items || items.length === 0) return

    setAccounts((prev) => {
      const map = new Map(prev.map((a) => [a.login, a]))

      if (op === 'full') {
        return items
      }

      if (op === 'add' || op === 'update') {
        items.forEach((it) => {
          const id = it?.login
          if (!id) return
          const prevItem = map.get(id)
          map.set(id, { ...(prevItem || {}), ...it })
        })
        return Array.from(map.values())
      }

      if (op === 'delete') {
        const idsToRemove = new Set(items.map((it) => it?.login))
        return prev.filter((a) => !idsToRemove.has(a?.login))
      }

      return Array.from(map.values())
    })
  }

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const ml = getMarginLevelPercent(a)
      return ml !== undefined && ml < 50
    })
  }, [accounts])

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
  
  const sortedAccounts = sortAccounts(filtered)
  
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

  if (loading) return <LoadingSpinner />

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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Margin Level</h1>
                <p className="text-xs text-gray-500 mt-0.5">Shows accounts with margin level &lt; 50% (from ACCOUNT_UPDATE events)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
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
          <div className="mb-3 flex items-center justify-between bg-white rounded-lg shadow-sm border border-blue-100 p-3">
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
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} - {Math.min(endIndex, filtered.length)} of {filtered.length}
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
