import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import { brokerAPI } from '../services/api'
import websocketService from '../services/websocket'
const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'

// Extract orders array from various API/WS shapes (supports single object too)
const extractOrders = (payload) => {
  if (!payload) return []

  // Common direct forms
  const directArr =
    payload.data?.orders ||
    payload.data?.Orders ||
    payload.orders ||
    payload.Orders ||
    payload.data?.data?.orders ||
    payload.data?.items ||
    payload.items ||
    payload.list ||
    payload.data?.list ||
    payload.pending_orders ||
    payload.data?.pending_orders ||
    (Array.isArray(payload) ? payload : null)
  if (Array.isArray(directArr)) return directArr

  // Single object forms
  const single =
    payload.data?.order ||
    payload.order ||
    payload.item ||
    (payload && typeof payload === 'object' && (payload.order || payload.ticket || payload.id) ? payload : null)
  if (single && typeof single === 'object' && !Array.isArray(single)) return [single]

  // Heuristic: find the first array value in payload that looks like orders (has objects with 'order'/'ticket')
  if (payload && typeof payload === 'object') {
    for (const v of Object.values(payload)) {
      if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
        const looksLikeOrder = v.some((it) => it && (('order' in it) || ('ticket' in it) || ('symbol' in it && 'action' in it)))
        if (looksLikeOrder) return v
      }
    }
  }

  return []
}

// Get a stable order id (ticket/order/id)
const getOrderId = (order) => {
  const id = order?.order ?? order?.ticket ?? order?.id
  return id !== undefined && id !== null ? String(id) : undefined
}

// Identify if an item/event should be ignored because it's a market buy/sell
const isMarketOrder = (action) => {
  if (!action) return false
  const a = action.toString().toUpperCase()
  return a === 'BUY' || a === 'SELL'
}

// Compute margin level percent from various possible keys
const getMarginLevelPercent = (order) => {
  if (!order || typeof order !== 'object') return undefined
  let val =
    order.margin_level ??
    order.marginLevel ??
    order.margin_percent ??
    order.marginPercent ??
    order.margin
  if (val === undefined || val === null) return undefined
  const n = Number(val)
  if (Number.isNaN(n)) return undefined
  // If provided as a ratio (0..1) convert to percent
  if (n > 0 && n <= 1) return n * 100
  return n
}

// Normalize incoming WS message to an operation and list of items
const normalizeWsMessage = (msg) => {
  try {
    if (!msg || typeof msg !== 'object') return { op: 'unknown', items: [], raw: msg }

  const type = (msg.type || msg.event || '').toString().toUpperCase()

    // Map common order events to operations
    const opMap = {
      ORDER_ADDED: 'add',
      ORDER_CREATED: 'add',
      NEW_ORDER: 'add',
      ORDER_UPDATED: 'update',
      ORDER_CHANGED: 'update',
      ORDER_MODIFIED: 'update',
      ORDER_DELETED: 'delete',
      ORDER_REMOVED: 'delete',
      ORDER_CANCELLED: 'delete',
      ORDER_CANCELED: 'delete',
      ORDER_FILLED: 'delete', // filled = no longer pending
    }

    if (opMap[type]) {
      // Support common shapes: {data:{order}}, {order}, {item}, ticket root, or array
      let items = []
      const itemCandidate =
        msg.data?.order ??
        msg.order ??
        msg.data?.item ??
        msg.item ??
        msg.payload

      if (Array.isArray(itemCandidate)) {
        items = itemCandidate
      } else if (itemCandidate && typeof itemCandidate === 'object') {
        items = [itemCandidate]
      } else {
        // Try to extract from nested arrays if present
        items = extractOrders(msg)
      }

      // Ignore market BUY/SELL items
      const filtered = items.filter((it) => !isMarketOrder(it?.action))
      return { op: opMap[type], items: filtered, raw: msg }
    }

    // Generic channel 'orders' / 'ORDERS'
    if (type === 'ORDERS') {
      const data = msg.data || msg
      const items = extractOrders(data).filter((it) => !isMarketOrder(it?.action))
      const opRaw = (data?.op || data?.operation || data?.mode || data?.type || 'update').toString().toLowerCase()
      const op = ['full', 'snapshot'].includes(opRaw) ? 'full'
        : ['add', 'create', 'new'].includes(opRaw) ? 'add'
        : ['remove', 'delete', 'del', 'cancel', 'cancelled', 'canceled', 'filled'].includes(opRaw) ? 'delete'
        : 'update'
      return { op, items, raw: msg }
    }

    return { op: 'unknown', items: [], raw: msg }
  } catch (e) {
    console.error('[PendingOrders] normalizeWsMessage error:', e)
    return { op: 'unknown', items: [], raw: msg }
  }
}

const PendingOrdersPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionState, setConnectionState] = useState('disconnected')
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  
  const fallbackPollingInterval = useRef(null)
  const hasInitialLoad = useRef(false)
  // Transient UI flashes for updated orders
  const [flashes, setFlashes] = useState({})
  const flashTimeouts = useRef(new Map())
  // Debug: count incoming order-related events and show in a table
  const [orderEventCounts, setOrderEventCounts] = useState({})
  const [recentOrderEvents, setRecentOrderEvents] = useState([]) // last 20

  const incEventCount = (evt) => {
    if (!evt) return
    const t = evt.toString().toUpperCase()
    setOrderEventCounts((prev) => ({ ...prev, [t]: (prev[t] || 0) + 1, all: (prev.all || 0) + 1 }))
  }

  const queueFlash = (id, data = {}) => {
    if (!id) return
    const key = String(id)
    const prev = flashTimeouts.current.get(key)
    if (prev) clearTimeout(prev)
    setFlashes((p) => ({ ...p, [key]: { ts: Date.now(), ...data } }))
    const to = setTimeout(() => {
      setFlashes((p) => {
        const n = { ...p }
        delete n[key]
        return n
      })
      flashTimeouts.current.delete(key)
    }, 1500)
    flashTimeouts.current.set(key, to)
  }

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      fetchOrders().finally(() => setLoading(false))
      websocketService.connect()
    }

    const unsubState = websocketService.onConnectionStateChange((state) => {
      setConnectionState(state)
      if (state === 'connected') stopFallbackPolling()
      if (state === 'disconnected' || state === 'failed') startFallbackPolling()
    })

    const unsubOrders = websocketService.subscribe('orders', (msg) => handleWsMessage(msg))
    const unsubOrdersUpper = websocketService.subscribe('ORDERS', (msg) => handleWsMessage(msg))

    // Specific events
  const unsubAdded = websocketService.subscribe('ORDER_ADDED', (msg) => handleWsMessage(msg))
    const unsubCreated = websocketService.subscribe('ORDER_CREATED', (msg) => handleWsMessage(msg))
  const unsubNew = websocketService.subscribe('NEW_ORDER', (msg) => handleWsMessage(msg))
    const unsubUpdated = websocketService.subscribe('ORDER_UPDATED', (msg) => handleWsMessage(msg))
    const unsubChanged = websocketService.subscribe('ORDER_CHANGED', (msg) => handleWsMessage(msg))
    const unsubModified = websocketService.subscribe('ORDER_MODIFIED', (msg) => handleWsMessage(msg))
    const unsubDeleted = websocketService.subscribe('ORDER_DELETED', (msg) => handleWsMessage(msg))
    const unsubRemoved = websocketService.subscribe('ORDER_REMOVED', (msg) => handleWsMessage(msg))
    const unsubCancelled = websocketService.subscribe('ORDER_CANCELLED', (msg) => handleWsMessage(msg))
    const unsubCanceled = websocketService.subscribe('ORDER_CANCELED', (msg) => handleWsMessage(msg))
    const unsubFilled = websocketService.subscribe('ORDER_FILLED', (msg) => handleWsMessage(msg))

    // Debug logging for troubleshooting
    const unsubAll = websocketService.subscribe('all', (data) => {
      try {
        const t = (data?.type || data?.event || '').toString().toUpperCase()
        const hasOrdersArray = Array.isArray(data?.data?.orders) || Array.isArray(data?.orders)
        const isOrderEvent = t.includes('ORDER') || t === 'ORDERS'
        if (hasOrdersArray || isOrderEvent) {
          if (DEBUG_LOGS) console.log('[PendingOrders][WS][ALL] Incoming message possibly related to orders:', data)
          // increment event counts
          incEventCount(t || 'UNKNOWN')
          // store recent event summary (cap 20)
          setRecentOrderEvents((prev) => {
            const summary = {
              t: t || 'UNKNOWN',
              at: Date.now(),
              id: data?.order?.order || data?.order?.ticket || data?.data?.order?.order || data?.data?.order?.ticket || data?.item?.order || data?.item?.ticket,
            }
            const next = [summary, ...prev]
            return next.slice(0, 20)
          })
        }
      } catch {}
    })

    return () => {
      unsubState()
      unsubOrders()
      unsubOrdersUpper()
      unsubAdded()
      unsubCreated()
      unsubUpdated()
      unsubChanged()
      unsubModified()
      unsubDeleted()
      unsubRemoved()
      unsubCancelled()
      unsubCanceled()
      unsubFilled()
      unsubNew()
      unsubAll()
      stopFallbackPolling()
      // Clear flash timers
      try {
        flashTimeouts.current.forEach((to) => clearTimeout(to))
        flashTimeouts.current.clear()
      } catch {}
    }
  }, [])

  const fetchOrders = async () => {
    try {
      setError('')
      const response = await brokerAPI.getOrders()
      const items = extractOrders(response?.data || response)
      // Ignore market BUY/SELL and exclude margin level < 50% (they belong in Margin Level module)
      setOrders(
        items.filter(
          (it) => !isMarketOrder(it?.action) && !(getMarginLevelPercent(it) < 50)
        )
      )
    } catch (e) {
      console.error('[PendingOrders] Failed to fetch orders:', e)
      setError(e?.response?.data?.message || 'Failed to load orders')
    }
  }

  const startFallbackPolling = () => {
    if (fallbackPollingInterval.current) return
    fallbackPollingInterval.current = setInterval(() => {
      fetchOrders().catch(() => {})
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

    setOrders((prev) => {
      const map = new Map(prev.map((o) => [getOrderId(o), o]))

      if (op === 'full') {
        return items.filter((it) => !isMarketOrder(it?.action) && !(getMarginLevelPercent(it) < 50))
      }

      if (op === 'add') {
        items.forEach((it) => {
          if (isMarketOrder(it?.action) || getMarginLevelPercent(it) < 50) return
          const id = getOrderId(it)
          if (!map.has(id)) map.set(id, it)
          if (id) queueFlash(id, { type: 'add' })
        })
        return Array.from(map.values())
      }

      if (op === 'update') {
        const deltas = []
        items.forEach((it) => {
          const id = getOrderId(it)
          const prevItem = map.get(id)
          // If item now drops below margin < 50, remove it from Pending Orders module
          if (getMarginLevelPercent(it) < 50) {
            if (id) map.delete(id)
            return
          }
          // Also ignore market orders entirely
          if (isMarketOrder(it?.action)) return
          // compute deltas for visual feedback (prefer priceOrder for pending orders)
          const pricePrev = prevItem?.priceOrder ?? prevItem?.price ?? prevItem?.priceOpen ?? prevItem?.priceOpenExact ?? prevItem?.open_price
          const priceNext = it.priceOrder ?? it.price ?? it.priceOpen ?? it.priceOpenExact ?? it.open_price
          const priceDelta =
            priceNext !== undefined && pricePrev !== undefined ? Number(priceNext) - Number(pricePrev) : undefined

          const slPrev = prevItem?.priceSL ?? prevItem?.sl ?? prevItem?.stop_loss
          const slNext = it.priceSL ?? it.sl ?? it.stop_loss
          const slDelta = slNext !== undefined && slPrev !== undefined ? Number(slNext) - Number(slPrev) : undefined

          const tpPrev = prevItem?.priceTP ?? prevItem?.tp ?? prevItem?.take_profit
          const tpNext = it.priceTP ?? it.tp ?? it.take_profit
          const tpDelta = tpNext !== undefined && tpPrev !== undefined ? Number(tpNext) - Number(tpPrev) : undefined

          map.set(id, { ...(prevItem || {}), ...it })
          if (id && (priceDelta !== undefined || slDelta !== undefined || tpDelta !== undefined)) {
            deltas.push({ id, priceDelta, slDelta, tpDelta })
          }
        })
        deltas.forEach(({ id, priceDelta, slDelta, tpDelta }) =>
          queueFlash(id, { type: 'update', priceDelta, slDelta, tpDelta })
        )
        return Array.from(map.values())
      }

      if (op === 'delete') {
        const idsToRemove = new Set(items.map((it) => getOrderId(it)))
        return prev.filter((o) => !idsToRemove.has(getOrderId(o)))
      }

      return Array.from(map.values())
    })
  }

  const formatNumber = (n, digits = 2) => {
    const num = Number(n)
    if (Number.isNaN(num)) return '-'
    return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  }

  const formatTime = (ts) => {
    if (!ts) return '-'
    try {
      const d = new Date(ts * 1000)
      return d.toLocaleString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    } catch {
      return '-'
    }
  }

  // Generate dynamic pagination options based on data count
  const generatePageSizeOptions = () => {
    const options = ['All']
    const totalCount = orders.length
    
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
  const sortOrders = (ordersToSort) => {
    if (!sortColumn) return ordersToSort
    
    const sorted = [...ordersToSort].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number (including volume, prices, etc.)
      const aNum = Number(aVal)
      const bNum = Number(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      // Default to string comparison (for login, symbol, action, etc.)
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
  
  const sortedOrders = sortOrders(orders)
  
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
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedOrders.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedOrders.length : startIndex + itemsPerPage
  const displayedOrders = sortedOrders.slice(startIndex, endIndex)
  
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Pending Orders</h1>
                <p className="text-xs text-gray-500 mt-0.5">Live pending orders (ignoring market BUY/SELL)</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
              <button
                onClick={fetchOrders}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                title="Refresh orders"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Pending Orders</p>
              <p className="text-lg font-semibold text-gray-900">{orders.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Unique Logins</p>
              <p className="text-lg font-semibold text-gray-900">{new Set(orders.map(o=>o.login)).size}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Symbols</p>
              <p className="text-lg font-semibold text-gray-900">{new Set(orders.map(o=>o.symbol)).size}</p>
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
              Showing {startIndex + 1} - {Math.min(endIndex, orders.length)} of {orders.length}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div className="overflow-x-auto">
              {displayedOrders.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                  <p className="text-gray-500 text-sm">No pending orders</p>
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
                        onClick={() => handleSort('order')}
                      >
                        <div className="flex items-center gap-1">
                          Order
                          {sortColumn === 'order' ? (
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
                        onClick={() => handleSort('symbol')}
                      >
                        <div className="flex items-center gap-1">
                          Symbol
                          {sortColumn === 'symbol' ? (
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
                        onClick={() => handleSort('type')}
                      >
                        <div className="flex items-center gap-1">
                          Type
                          {sortColumn === 'type' ? (
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
                        onClick={() => handleSort('state')}
                      >
                        <div className="flex items-center gap-1">
                          State
                          {sortColumn === 'state' ? (
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
                        onClick={() => handleSort('volume')}
                      >
                        <div className="flex items-center gap-1">
                          Volume
                          {sortColumn === 'volume' ? (
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
                        onClick={() => handleSort('priceOrder')}
                      >
                        <div className="flex items-center gap-1">
                          Price
                          {sortColumn === 'priceOrder' ? (
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
                        onClick={() => handleSort('priceTrigger')}
                      >
                        <div className="flex items-center gap-1">
                          Trigger
                          {sortColumn === 'priceTrigger' ? (
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
                        onClick={() => handleSort('sl')}
                      >
                        <div className="flex items-center gap-1">
                          SL
                          {sortColumn === 'sl' ? (
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
                        onClick={() => handleSort('tp')}
                      >
                        <div className="flex items-center gap-1">
                          TP
                          {sortColumn === 'tp' ? (
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
                        onClick={() => handleSort('timeSetup')}
                      >
                        <div className="flex items-center gap-1">
                          Setup
                          {sortColumn === 'timeSetup' ? (
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
                    {displayedOrders.map((o, index) => {
                      const id = getOrderId(o)
                      const flash = id ? flashes[id] : undefined
                      const priceDelta = flash?.priceDelta
                      const slDelta = flash?.slDelta
                      const tpDelta = flash?.tpDelta
                      return (
                        <tr key={id ?? index} className={`hover:bg-blue-50 transition-colors`}>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{o.login}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{id}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{o.symbol}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{o.type ?? '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{o.state ?? '-'}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(o.volumeCurrent ?? o.volume ?? o.volumeInitial, 2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {formatNumber(o.priceOrder ?? o.price ?? o.priceOpen ?? o.priceOpenExact ?? o.open_price, 5)}
                              {priceDelta !== undefined && priceDelta !== 0 ? (
                                <span className={`ml-1 text-[11px] font-medium ${priceDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {priceDelta > 0 ? '▲' : '▼'} {Math.abs(priceDelta).toFixed(5)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(o.priceTrigger ?? o.trigger ?? 0, 5)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {formatNumber(o.priceSL ?? o.sl ?? o.stop_loss, 5)}
                              {slDelta !== undefined && slDelta !== 0 ? (
                                <span className={`ml-1 text-[11px] font-medium ${slDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {slDelta > 0 ? '▲' : '▼'} {Math.abs(slDelta).toFixed(5)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {formatNumber(o.priceTP ?? o.tp ?? o.take_profit, 5)}
                              {tpDelta !== undefined && tpDelta !== 0 ? (
                                <span className={`ml-1 text-[11px] font-medium ${tpDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {tpDelta > 0 ? '▲' : '▼'} {Math.abs(tpDelta).toFixed(5)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatTime(o.timeSetup || o.timeUpdate || o.timeCreate || o.updated_at)}</td>
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

          {/* Orders WebSocket events monitor */}
          <div className="mt-3 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Orders events (live)</h3>
              <span className="text-xs text-gray-500">Total: {Object.values(orderEventCounts).reduce((s,v)=>s+Number(v||0),0)}</span>
            </div>
            <div className="p-3 overflow-x-auto">
              {Object.keys(orderEventCounts).length === 0 ? (
                <p className="text-xs text-gray-500">No order events received yet.</p>
              ) : (
                <table className="min-w-[420px] w-full text-xs">
                  <thead>
                    <tr className="text-gray-600">
                      <th className="text-left px-2 py-1">Event</th>
                      <th className="text-left px-2 py-1">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(orderEventCounts).map(([k,v]) => (
                      <tr key={k}>
                        <td className="px-2 py-1 font-medium text-gray-800">{k}</td>
                        <td className="px-2 py-1 text-gray-700">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default PendingOrdersPage
