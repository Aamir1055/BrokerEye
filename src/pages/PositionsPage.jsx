import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import WebSocketIndicator from '../components/WebSocketIndicator'
import LoadingSpinner from '../components/LoadingSpinner'
import { brokerAPI } from '../services/api'
import websocketService from '../services/websocket'

// Helper: extract array of positions from various response shapes
const extractPositions = (payload) => {
  if (!payload) return []
  // API/WS response could be many shapes:
  // - { data: { positions: [...] } }
  // - { positions: [...] }
  // - single object { position: 123, ... }
  // - array [...]
  const arr =
    payload.data?.positions ||
    payload.positions ||
    (Array.isArray(payload) ? payload : null)

  if (Array.isArray(arr)) return arr

  // If a single position-like object is provided, wrap it as an array
  const maybeObj = payload.data?.position || payload.position || null
  if (maybeObj && typeof maybeObj === 'object') return [maybeObj]
  if (payload && typeof payload === 'object' && 'position' in payload) return [payload]

  return []
}

// Normalize an incoming WS message into an operation and dataset
const normalizeWsMessage = (msg) => {
  try {
    if (!msg || typeof msg !== 'object') return { op: 'unknown', items: [], raw: msg }

    const type = msg.type || msg.event

    // Specific event names
    const event = (msg.event || msg.type || '').toUpperCase()

    // Common operations mapping
    const opMap = {
      // add/create
      POSITION_ADDED: 'add',
      POSITION_CREATED: 'add',
      POSITION_CREATE: 'add',
      NEW_POSITION: 'add',
      POSITION_ADD: 'add',
      // update
      POSITION_UPDATED: 'update',
      POSITION_CHANGED: 'update',
      POSITION_MODIFIED: 'update',
      POSITION_UPDATE: 'update',
      // delete
      POSITION_DELETED: 'delete',
      POSITION_REMOVED: 'delete',
      POSITION_DELETE: 'delete',
      // pnl
      POSITION_PNL_UPDATED: 'pnl',
      POSITION_PNL_UPDATE: 'pnl',
      POSITION_NPL_UPDATED: 'pnl', // handle possible typo / variant
      POSITION_NPL_UPDATE: 'pnl',
      POSITION_UPDATE_PNL: 'pnl', // additional variant
    }

    if (opMap[event]) {
      // The backend sends: { event: "POSITION_PNL_UPDATE", data: { position: 821, profit: -27.5, ... } }
      // We need msg.data directly (the whole position object), NOT msg.data.position (which is just the ID number)
      let item = null
      
      // Check if msg.data is an object with position fields
      if (msg.data && typeof msg.data === 'object' && 'position' in msg.data) {
        // msg.data IS the position object
        item = msg.data
      } else if (msg.data?.position && typeof msg.data.position === 'object') {
        // msg.data has a nested position object
        item = msg.data.position
      } else if (msg.data?.item && typeof msg.data.item === 'object') {
        item = msg.data.item
      } else if (msg.position && typeof msg.position === 'object') {
        item = msg.position
      } else if (msg.item && typeof msg.item === 'object') {
        item = msg.item
      } else if (msg.payload && typeof msg.payload === 'object') {
        item = msg.payload
      }
      
      // Log the extracted item for debugging
      console.log(`[Positions] 📥 Event: ${event}, Operation: ${opMap[event]}`)
      console.log('[Positions] 📦 Raw message:', msg)
      console.log('[Positions] 📋 Extracted item:', item)
      console.log('[Positions] 🔑 Position ID:', item?.position)
      
      // For pnl updates, attach timestamp fallback
      if (opMap[event] === 'pnl' && item && typeof item === 'object') {
        const ts = msg.timestamp || msg.time || msg.ts
        if (ts && !item.timeUpdate) {
          item.timeUpdate = ts
          console.log('[Positions] ⏰ Added timestamp to item:', ts)
        }
      }
      
      const result = { op: opMap[event], items: item && typeof item === 'object' ? [item] : [], raw: msg }
      console.log('[Positions] 📤 Returning normalized result:', result)
      return result
    }

    // Generic 'positions' channel
    if (type && type.toLowerCase() === 'positions') {
  const data = msg.data || msg
  const items = extractPositions(data)
      const op = (data?.op || data?.operation || data?.mode || data?.type || 'update').toString().toLowerCase()
      // normalize op keywords
      const normalizedOp = ['full', 'snapshot'].includes(op) ? 'full'
        : ['add', 'create', 'new'].includes(op) ? 'add'
        : ['remove', 'delete', 'del'].includes(op) ? 'delete'
        : ['pnl', 'npl', 'pnl_update', 'profit', 'profit_update'].includes(op) ? 'pnl'
        : 'update'
      // Attach timestamp on pnl items if missing
      if (normalizedOp === 'pnl') {
        const ts = msg.timestamp || msg.time || msg.ts
        if (ts) {
          items.forEach((it) => { if (it && !it.timeUpdate) it.timeUpdate = ts })
        }
      }
      return { op: normalizedOp, items, raw: msg }
    }

    return { op: 'unknown', items: [], raw: msg }
  } catch (e) {
    console.error('[Positions] normalizeWsMessage error:', e)
    return { op: 'unknown', items: [], raw: msg }
  }
}

const getPosKey = (obj) => {
  const id = obj?.position
  return id !== undefined && id !== null ? String(id) : undefined
}

const PositionsPage = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [connectionState, setConnectionState] = useState('disconnected')
  // Transient UI flash map: { [positionId]: { ts, type: 'add'|'update'|'pnl', priceDelta?, profitDelta? } }
  const [flashes, setFlashes] = useState({})
  const flashTimeouts = useRef(new Map())
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Sorting states
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'

  // Helper to queue a transient highlight for a given position id
  const queueFlash = (id, data = {}) => {
    if (!id) return
    const key = String(id)
    // Clear previous timeout if any
    const prevTo = flashTimeouts.current.get(key)
    if (prevTo) clearTimeout(prevTo)

    setFlashes((prev) => ({
      ...prev,
      [key]: {
        ts: Date.now(),
        ...data,
      },
    }))

    const to = setTimeout(() => {
      setFlashes((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      flashTimeouts.current.delete(key)
    }, 1500)
    flashTimeouts.current.set(key, to)
  }
  const fallbackPollingInterval = useRef(null)
  const hasInitialLoad = useRef(false)
  const wsDataReceived = useRef(false)

  useEffect(() => {
    if (!hasInitialLoad.current) {
      hasInitialLoad.current = true
      // Don't fetch from API, wait for WebSocket data
      console.log('[Positions] Waiting for WebSocket data...')
      websocketService.connect()
      
      // Set loading to false after a short delay if no WebSocket data
      setTimeout(() => {
        if (!wsDataReceived.current) {
          console.log('[Positions] No WebSocket data received yet, but showing UI')
          setLoading(false)
        }
      }, 2000)
    }

    // Subscribe to connection state
    const unsubscribeState = websocketService.onConnectionStateChange((state) => {
      setConnectionState(state)
      if (state === 'connected') {
        console.log('[Positions] WebSocket connected! Requesting position snapshot...')
        stopFallbackPolling()
        // Request full position snapshot from WebSocket
        websocketService.send({
          type: 'GET_POSITIONS',
          action: 'snapshot'
        })
      } else if (state === 'disconnected' || state === 'failed') {
        startFallbackPolling()
      }
    })

    // Subscribe to generic positions channel (lower + upper case variants)
    const unsubPositions = websocketService.subscribe('positions', (msg) => {
      handleWsMessage(msg)
    })
    const unsubPositionsUpper = websocketService.subscribe('POSITIONS', (msg) => {
      handleWsMessage(msg)
    })

    // Subscribe to specific events for robustness
    const unsubAdded = websocketService.subscribe('POSITION_ADDED', (msg) => handleWsMessage(msg))
    const unsubCreated = websocketService.subscribe('POSITION_CREATED', (msg) => handleWsMessage(msg))
    const unsubCreate = websocketService.subscribe('POSITION_CREATE', (msg) => handleWsMessage(msg))
    const unsubUpdated = websocketService.subscribe('POSITION_UPDATED', (msg) => handleWsMessage(msg))
    const unsubDeleted = websocketService.subscribe('POSITION_DELETED', (msg) => handleWsMessage(msg))
    const unsubRemoved = websocketService.subscribe('POSITION_REMOVED', (msg) => handleWsMessage(msg))
  const unsubPnl = websocketService.subscribe('POSITION_PNL_UPDATED', (msg) => handleWsMessage(msg))
  const unsubPnl2 = websocketService.subscribe('POSITION_PNL_UPDATE', (msg) => handleWsMessage(msg))
  const unsubPnl3 = websocketService.subscribe('POSITION_UPDATE_PNL', (msg) => handleWsMessage(msg))
  const unsubNpl = websocketService.subscribe('POSITION_NPL_UPDATED', (msg) => handleWsMessage(msg))
  const unsubNpl2 = websocketService.subscribe('POSITION_NPL_UPDATE', (msg) => handleWsMessage(msg))
  // Additional generic single-word variants
  const unsubAdd = websocketService.subscribe('POSITION_ADD', (msg) => handleWsMessage(msg))
  const unsubUpd = websocketService.subscribe('POSITION_UPDATE', (msg) => handleWsMessage(msg))
  const unsubDel = websocketService.subscribe('POSITION_DELETE', (msg) => handleWsMessage(msg))

    // Debug: log any incoming messages that look like positions for troubleshooting
    const unsubAll = websocketService.subscribe('all', (data) => {
      try {
        const t = (data?.type || data?.event || '').toString().toUpperCase()
        const hasPositionsArray = Array.isArray(data?.data?.positions) || Array.isArray(data?.positions)
        const isPositionEvent = t.includes('POSITION') || t === 'POSITIONS'
        if (hasPositionsArray || isPositionEvent) {
          console.log('[Positions][WS][ALL] Incoming message possibly related to positions:', data)
        }
      } catch {}
    })

    return () => {
      unsubscribeState()
      unsubPositions()
      unsubPositionsUpper()
      unsubAll()
      unsubAdded()
      unsubCreated()
      unsubCreate()
      unsubUpdated()
      unsubDeleted()
      unsubRemoved()
  unsubPnl()
  unsubPnl2()
  unsubPnl3()
  unsubNpl()
  unsubNpl2()
  unsubAdd()
  unsubUpd()
  unsubDel()
      stopFallbackPolling()
      // Clear any pending flash timeouts
      try {
        flashTimeouts.current.forEach((to) => clearTimeout(to))
        flashTimeouts.current.clear()
      } catch {}
    }
  }, [])

  const fetchPositions = async () => {
    try {
      setError('')
      console.log('[Positions] Fetching from API as fallback...')
      const response = await brokerAPI.getPositions()
      const items = extractPositions(response?.data || response)
      console.log('[Positions] API fallback returned', items.length, 'positions')
      setPositions(items)
      wsDataReceived.current = true
      setLoading(false)
    } catch (e) {
      console.error('[Positions] Failed to fetch positions from API:', e)
      setError(e?.response?.data?.message || 'Failed to load positions')
    }
  }

  const startFallbackPolling = () => {
    console.log('[Positions] Starting fallback polling (WebSocket disconnected)')
    if (fallbackPollingInterval.current) return
    // Fetch immediately when starting polling
    fetchPositions().catch(() => {})
    fallbackPollingInterval.current = setInterval(() => {
      fetchPositions().catch(() => {})
    }, 5000)
  }

  const stopFallbackPolling = () => {
    console.log('[Positions] Stopping fallback polling (WebSocket connected)')
    if (fallbackPollingInterval.current) {
      clearInterval(fallbackPollingInterval.current)
      fallbackPollingInterval.current = null
    }
  }

  const handleWsMessage = (msg) => {
    const { op, items, raw } = normalizeWsMessage(msg)
    
    // Mark that we've received WebSocket data
    if (!wsDataReceived.current && items && items.length > 0) {
      wsDataReceived.current = true
      setLoading(false)
      console.log('[Positions] ✅ First WebSocket data received!')
    }
    
    console.log('[Positions] Processing WS message:', {
      event: msg.event || msg.type,
      operation: op,
      itemsCount: items?.length || 0,
      items: items
    })
    
    if (op === 'unknown') {
      console.warn('[Positions] Unknown WS message:', raw)
      return
    }

    if (op === 'full') {
      console.log('[Positions] 🔄 Full position refresh, count:', items.length)
      setPositions(items)
      return
    }

    if (op === 'add') {
      if (!items || items.length === 0) return
      console.log('[Positions] ➕ Adding new positions:', items.length)
      setPositions((prev) => {
        const byId = new Set(prev.map((p) => getPosKey(p)))
        const merged = [...prev]
        items.forEach((it) => {
          const key = getPosKey(it)
          if (key && !byId.has(key)) {
            console.log('[Positions] ➕ New position added:', key, it)
            merged.unshift(it)
          }
        })
        return merged
      })
      // Flash newly added rows
      items.forEach((it) => queueFlash(getPosKey(it), { type: 'add' }))
      return
    }

    if (op === 'update') {
      if (!items || items.length === 0) return
      console.log('[Positions] 🔄 Updating positions:', items.length)
      let deltaList = []
      setPositions((prev) => {
        const map = new Map(prev.map((p) => [getPosKey(p), p]))
        items.forEach((it) => {
          const key = getPosKey(it)
          if (!key) return
          const prevItem = map.get(key)
          // Compute deltas for visible fields when present in payload
          const priceDelta =
            it.priceCurrent !== undefined && prevItem?.priceCurrent !== undefined
              ? Number(it.priceCurrent) - Number(prevItem.priceCurrent)
              : undefined
          const profitDelta =
            it.profit !== undefined && prevItem?.profit !== undefined
              ? Number(it.profit) - Number(prevItem.profit)
              : undefined

          console.log('[Positions] 🔄 Updated position:', key, { 
            priceDelta, 
            profitDelta,
            old: prevItem,
            new: it 
          })
          
          map.set(key, { ...(prevItem || {}), ...it })
          if (priceDelta !== undefined || profitDelta !== undefined) {
            deltaList.push({ key, priceDelta, profitDelta })
          }
        })
        return Array.from(map.values())
      })
      // Queue flashes after state merge
      deltaList.forEach(({ key, priceDelta, profitDelta }) =>
        queueFlash(key, { type: 'update', priceDelta, profitDelta })
      )
      return
    }

    if (op === 'delete') {
      if (!items || items.length === 0) return
      console.log('[Positions] ❌ Deleting positions:', items.length)
      setPositions((prev) => {
        const idsToRemove = new Set(items.map((it) => getPosKey(it)))
        return prev.filter((p) => {
          const key = getPosKey(p)
          const shouldRemove = idsToRemove.has(key)
          if (shouldRemove) {
            console.log('[Positions] ❌ Position deleted:', key)
          }
          return !shouldRemove
        })
      })
      return
    }

    if (op === 'pnl') {
      if (!items || items.length === 0) return
      console.log('[Positions] 💰 PnL update for positions:', items.length)
      let deltaList = []
      setPositions((prev) => {
        const map = new Map(prev.map((p) => [getPosKey(p), p]))
        items.forEach((it) => {
          const key = getPosKey(it)
          if (!key) return
          const prevItem = map.get(key)
          
          if (!prevItem) {
            // Position doesn't exist yet, add it
            console.log('[Positions] 💰 New position from PnL update:', key, it)
            map.set(key, it)
            return
          }
          
          const next = {
            ...(prevItem || {}),
            ...it,
          }
          // Keep only selective fields if incoming is partial
          next.profit = it.profit ?? prevItem?.profit
          next.priceCurrent = it.priceCurrent ?? prevItem?.priceCurrent
          next.timeUpdate = it.timeUpdate ?? prevItem?.timeUpdate
          map.set(key, next)

          // Compute deltas for visual feedback
          const priceDelta =
            it.priceCurrent !== undefined && prevItem?.priceCurrent !== undefined
              ? Number(next.priceCurrent) - Number(prevItem.priceCurrent)
              : undefined
          const profitDelta =
            it.profit !== undefined && prevItem?.profit !== undefined
              ? Number(next.profit) - Number(prevItem.profit)
              : undefined
          
          console.log('[Positions] 💰 PnL updated for position:', key, {
            priceDelta,
            profitDelta,
            oldProfit: prevItem?.profit,
            newProfit: next.profit,
            oldPrice: prevItem?.priceCurrent,
            newPrice: next.priceCurrent
          })
          
          if (priceDelta !== undefined || profitDelta !== undefined) {
            deltaList.push({ key, priceDelta, profitDelta })
          }
        })
        return Array.from(map.values())
      })
      // Queue flashes after state merge
      deltaList.forEach(({ key, priceDelta, profitDelta }) =>
        queueFlash(key, { type: 'pnl', priceDelta, profitDelta })
      )
      return
    }
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
    const totalCount = positions.length
    
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
  const sortPositions = (positionsToSort) => {
    if (!sortColumn) return positionsToSort
    
    const sorted = [...positionsToSort].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      
      // Detect data type and sort accordingly
      // Check if it's a number (including volume, prices, profit, etc.)
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
  
  const sortedPositions = sortPositions(positions)
  
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
  const totalPages = itemsPerPage === 'All' ? 1 : Math.ceil(sortedPositions.length / itemsPerPage)
  const startIndex = itemsPerPage === 'All' ? 0 : (currentPage - 1) * itemsPerPage
  const endIndex = itemsPerPage === 'All' ? sortedPositions.length : startIndex + itemsPerPage
  const displayedPositions = sortedPositions.slice(startIndex, endIndex)
  
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
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Positions</h1>
                <p className="text-xs text-gray-500 mt-0.5">Live open positions across accounts</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WebSocketIndicator />
              <button
                onClick={() => {
                  console.log('[Positions] Requesting fresh position snapshot from WebSocket...')
                  websocketService.send({
                    type: 'GET_POSITIONS',
                    action: 'snapshot'
                  })
                }}
                className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                title="Refresh positions from WebSocket"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-4">
            <div className="bg-white rounded-lg shadow-sm border border-blue-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Positions</p>
              <p className="text-lg font-semibold text-gray-900">{positions.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Total Profit</p>
              <p className={`text-lg font-semibold ${positions.reduce((s,p)=>s+(p.profit||0),0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNumber(positions.reduce((s,p)=>s+(p.profit||0),0))}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Unique Logins</p>
              <p className="text-lg font-semibold text-gray-900">{new Set(positions.map(p=>p.login)).size}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-orange-100 p-3">
              <p className="text-xs text-gray-500 mb-1">Symbols</p>
              <p className="text-lg font-semibold text-gray-900">{new Set(positions.map(p=>p.symbol)).size}</p>
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
              Showing {startIndex + 1} - {Math.min(endIndex, positions.length)} of {positions.length}
            </div>
          </div>

          {/* Positions Table */}
          <div className="bg-white rounded-lg shadow-sm border border-blue-100 overflow-hidden">
            <div className="overflow-x-auto">
              {displayedPositions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                  <p className="text-gray-500 text-sm">No positions found</p>
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
                        onClick={() => handleSort('position')}
                      >
                        <div className="flex items-center gap-1">
                          Position
                          {sortColumn === 'position' ? (
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
                        onClick={() => handleSort('action')}
                      >
                        <div className="flex items-center gap-1">
                          Action
                          {sortColumn === 'action' ? (
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
                        onClick={() => handleSort('priceOpen')}
                      >
                        <div className="flex items-center gap-1">
                          Open
                          {sortColumn === 'priceOpen' ? (
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
                        onClick={() => handleSort('priceCurrent')}
                      >
                        <div className="flex items-center gap-1">
                          Current
                          {sortColumn === 'priceCurrent' ? (
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
                        onClick={() => handleSort('profit')}
                      >
                        <div className="flex items-center gap-1">
                          Profit
                          {sortColumn === 'profit' ? (
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
                        onClick={() => handleSort('timeUpdate')}
                      >
                        <div className="flex items-center gap-1">
                          Updated
                          {sortColumn === 'timeUpdate' ? (
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
                    {displayedPositions.map((p) => {
                      const key = getPosKey(p)
                      const flash = key ? flashes[key] : undefined
                      const profitDelta = flash?.profitDelta
                      const priceDelta = flash?.priceDelta
                      const flashType = flash?.type
                      
                      // Determine row background color based on flash type
                      const rowClass = flashType === 'add' ? 'bg-green-100 animate-pulse'
                        : flashType === 'pnl' || flashType === 'update' ? 'bg-blue-100 animate-pulse'
                        : 'hover:bg-blue-50'
                      
                      return (
                        <tr key={p.position} className={`${rowClass} transition-all duration-300`}>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.login}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.position}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.symbol}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{p.action}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.volume, 2)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatNumber(p.priceOpen, 5)}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`${flash ? 'font-bold text-blue-600' : ''}`}>
                                {formatNumber(p.priceCurrent, 5)}
                              </span>
                              {priceDelta !== undefined && priceDelta !== 0 ? (
                                <span className={`text-xs font-bold animate-pulse ${priceDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {priceDelta > 0 ? '▲' : '▼'} {Math.abs(priceDelta).toFixed(5)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded transition-all duration-300 ${
                                (p.profit || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              } ${flash ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}>
                                {formatNumber(p.profit, 2)}
                              </span>
                              {profitDelta !== undefined && profitDelta !== 0 ? (
                                <span className={`text-xs font-bold animate-bounce ${profitDelta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {profitDelta > 0 ? '▲' : '▼'} {Math.abs(profitDelta).toFixed(2)}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{formatTime(p.timeUpdate || p.timeCreate)}</td>
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

export default PositionsPage
