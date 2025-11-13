import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { brokerAPI } from '../services/api'
import websocketService from '../services/websocket'
import { useAuth } from './AuthContext'

const DataContext = createContext()

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) {
    // Provide a resilient, no-crash fallback with sensible defaults.
    // This preserves the UI if a subtree renders outside the provider
    // (e.g., during lazy routes, portals mounted early, or test mounts),
    // while surfacing a clear console warning for developers.
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn('[DataContext] useData called outside of DataProvider; returning fallback context')
    }
    const noop = async () => {}
    return {
      clients: [],
      positions: [],
      orders: [],
      deals: [],
      accounts: [],
      latestServerTimestamp: null,
      latestMeasuredLagMs: null,
      lastWsReceiveAt: null,
      clientStats: {
        totalClients: 0,
        totalBalance: 0,
        totalCredit: 0,
        totalEquity: 0,
        totalPnl: 0,
        totalProfit: 0,
        dailyDeposit: 0,
        dailyWithdrawal: 0,
        dailyPnL: 0,
        thisWeekPnL: 0,
        thisMonthPnL: 0,
        lifetimePnL: 0,
        totalDeposit: 0
      },
      fetchClients: noop,
      fetchPositions: noop,
      fetchOrders: noop,
      fetchDeals: noop,
      fetchAccounts: noop,
      loading: { clients: false, positions: false, orders: false, deals: false, accounts: false },
      lastFetch: { clients: null, positions: null, orders: null, deals: null, accounts: null },
      connectionState: 'disconnected',
      statsDrift: {
        lastSource: null,
        lastReconciledAt: null,
        lastVerifiedAt: null,
        lastDeltas: null,
        lastApiStats: null,
        lastLocalStats: null,
        lastCount: null
      }
    }
  }
  return context
}

// Robust numeric parser shared across all data processing functions
// Handles strings with commas, nulls, NaN, and various edge cases
const toNum = (v) => {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const cleaned = v.replace(/,/g, '').trim()
    if (cleaned === '' || cleaned === '-') return 0
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export const DataProvider = ({ children }) => {
  // Helper to schedule heavy state updates at low priority to avoid blocking navigation/route transitions
  const lowPriority = (cb) => startTransition(cb)
  const { isAuthenticated } = useAuth()
  const [clients, setClients] = useState([])
  const [positions, setPositions] = useState([])
  const [orders, setOrders] = useState([])
  const [deals, setDeals] = useState([])
  const [accounts, setAccounts] = useState([]) // For margin level
  const [latestServerTimestamp, setLatestServerTimestamp] = useState(null) // Track latest batch timestamp
  const [latestMeasuredLagMs, setLatestMeasuredLagMs] = useState(null) // Wall-clock latency between server timestamp and receipt
  const [lastWsReceiveAt, setLastWsReceiveAt] = useState(null) // Last time we received a WS update (ms)
  // Lightweight performance metrics via ref + window leak-free export (avoid context re-renders)
  const perfRef = useRef({
    pendingUpdatesSize: 0,
    lastBatchProcessMs: 0,
    lastBatchAgeMs: 0,
    totalProcessedUpdates: 0,
    lastFlushAt: 0
  })
  // Throttle re-renders from lastWsReceiveAt updates
  const lastReceiveEmitRef = useRef(0)
  // Expose to window for debug UI without causing provider re-renders
  useEffect(() => {
    try { window.__brokerPerf = perfRef.current } catch {}
  }, [])
  
  // Aggregated stats for face cards - updated incrementally
  const [clientStats, setClientStats] = useState({
    totalClients: 0,
    totalBalance: 0,
    totalCredit: 0,
    totalEquity: 0,
    totalPnl: 0,
    totalProfit: 0,
    dailyDeposit: 0,
    dailyWithdrawal: 0,
    dailyPnL: 0,
    thisWeekPnL: 0,
    thisMonthPnL: 0,
    lifetimePnL: 0,
    totalDeposit: 0
  })
  
  // Batch stats updates to avoid excessive re-renders
  const statsUpdateBatchRef = useRef({
    pending: false,
    deltas: {
      totalBalance: 0,
      totalCredit: 0,
      totalEquity: 0,
      totalPnl: 0,
      totalProfit: 0,
      dailyDeposit: 0,
      dailyWithdrawal: 0,
      dailyPnL: 0,
      thisWeekPnL: 0,
      thisMonthPnL: 0,
      lifetimePnL: 0,
      totalDeposit: 0
    }
  })
  // Adaptive batching delay for stats updates (ms)
  const statsBatchDelayRef = useRef(1000)
  const perfLastEmitRef = useRef(0)
  
  // Track last processed state per client to prevent duplicate delta calculations
  const lastClientStateRef = useRef(new Map())
  
  // Flag to prevent multiple simultaneous full stats calculations
  const isCalculatingStatsRef = useRef(false)
  
  // Lock to prevent concurrent fetchClients calls
  const isFetchingClientsRef = useRef(false)
  
  // Track if initial sync has been done
  const hasInitialSyncedRef = useRef(false)
  
  // Track if initial data load is complete (to control WebSocket connection)
  const [hasInitialData, setHasInitialData] = useState(false)
  
  const [loading, setLoading] = useState({
    clients: false,
    positions: false,
    orders: false,
    deals: false,
    accounts: false
  })
  
  const [lastFetch, setLastFetch] = useState({
    clients: null,
    positions: null,
    orders: null,
    deals: null,
    accounts: null
  })
  
  const [connectionState, setConnectionState] = useState('disconnected')
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

  // Live diagnostics for stat drift
  const [statsDrift, setStatsDrift] = useState({
    lastSource: null, // 'reconcile' | 'verify'
    lastReconciledAt: null,
    lastVerifiedAt: null,
    lastDeltas: null,
    lastApiStats: null,
    lastLocalStats: null,
    lastCount: null
  })

  // Ensure any epoch timestamp is in milliseconds
  const toMs = (ts) => {
    if (!ts) return 0
    const n = Number(ts)
    if (!isFinite(n) || n <= 0) return 0
    // If it's seconds (< 10^10), convert to ms
    return n < 10000000000 ? n * 1000 : n
  }

  // Generic retry helper with exponential backoff and jitter for transient failures
  const fetchWithRetry = useCallback(async (fn, {
    retries = 2,
    baseDelayMs = 600,
    maxDelayMs = 4000,
    label = 'request'
  } = {}) => {
    let attempt = 0
    let lastError
    while (attempt <= retries) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        attempt++
        if (attempt > retries) break
        const code = err?.code || err?.response?.status
        const isTransient = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || (typeof code === 'number' && code >= 500)
        const jitter = Math.random() * 0.3 + 0.85 // 0.85x - 1.15x
        const delay = Math.min(maxDelayMs, Math.round((baseDelayMs * (2 ** (attempt - 1))) * jitter))
        console.warn(`[DataContext] Retry ${attempt}/${retries} after ${delay}ms for ${label}`, err?.message || err)
        if (!isTransient) break
        await new Promise(res => setTimeout(res, delay))
      }
    }
    throw lastError
  }, [])

  // Helper function to normalize USC currency values (divide by 100)
  const normalizeUSCValues = (client) => {
    if (!client || !client.currency || client.currency.toLowerCase() !== 'usc') {
      return client
    }

    // Robust numeric parser: handles strings with commas, nulls, NaN
    const toNum = (v) => {
      if (v == null || v === '') return 0
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0
      if (typeof v === 'string') {
        const cleaned = v.replace(/,/g, '').trim()
        if (cleaned === '' || cleaned === '-') return 0
        const n = Number(cleaned)
        return Number.isFinite(n) ? n : 0
      }
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }

    // Start with explicit known monetary mappings (safe and stable)
    const normalized = {
      ...client,
      // Basic financial fields
      balance: toNum(client.balance) / 100,
      credit: toNum(client.credit) / 100,
      equity: toNum(client.equity) / 100,
      margin: toNum(client.margin) / 100,
      marginFree: toNum(client.marginFree) / 100,
      profit: toNum(client.profit) / 100,
      floating: toNum(client.floating) / 100,
      pnl: toNum(client.pnl) / 100,
      assets: toNum(client.assets) / 100,
      liabilities: toNum(client.liabilities) / 100,
      blockedCommission: toNum(client.blockedCommission) / 100,
      blockedProfit: toNum(client.blockedProfit) / 100,
      storage: toNum(client.storage) / 100,
      marginInitial: toNum(client.marginInitial) / 100,
      marginMaintenance: toNum(client.marginMaintenance) / 100,
      soEquity: toNum(client.soEquity) / 100,
      soMargin: toNum(client.soMargin) / 100,
      // Daily metrics
      dailyDeposit: toNum(client.dailyDeposit) / 100,
      dailyWithdrawal: toNum(client.dailyWithdrawal) / 100,
      dailyPnL: toNum(client.dailyPnL) / 100,
      // Weekly/Monthly/Lifetime PnL
      thisWeekPnL: toNum(client.thisWeekPnL) / 100,
      thisMonthPnL: toNum(client.thisMonthPnL) / 100,
      lifetimePnL: toNum(client.lifetimePnL) / 100,
      // Bonus fields
      dailyBonusIn: toNum(client.dailyBonusIn) / 100,
      dailyBonusOut: toNum(client.dailyBonusOut) / 100,
      thisWeekBonusIn: toNum(client.thisWeekBonusIn) / 100,
      thisWeekBonusOut: toNum(client.thisWeekBonusOut) / 100,
      thisMonthBonusIn: toNum(client.thisMonthBonusIn) / 100,
      thisMonthBonusOut: toNum(client.thisMonthBonusOut) / 100,
      lifetimeBonusIn: toNum(client.lifetimeBonusIn) / 100,
      lifetimeBonusOut: toNum(client.lifetimeBonusOut) / 100,
      // Weekly/Monthly/Lifetime Deposit/Withdrawal
      thisWeekDeposit: toNum(client.thisWeekDeposit) / 100,
      thisWeekWithdrawal: toNum(client.thisWeekWithdrawal) / 100,
      thisMonthDeposit: toNum(client.thisMonthDeposit) / 100,
      thisMonthWithdrawal: toNum(client.thisMonthWithdrawal) / 100,
      lifetimeDeposit: toNum(client.lifetimeDeposit) / 100,
      lifetimeWithdrawal: toNum(client.lifetimeWithdrawal) / 100,
      // Credit IN/OUT
      thisWeekCreditIn: toNum(client.thisWeekCreditIn) / 100,
      thisWeekCreditOut: toNum(client.thisWeekCreditOut) / 100,
      thisMonthCreditIn: toNum(client.thisMonthCreditIn) / 100,
      thisMonthCreditOut: toNum(client.thisMonthCreditOut) / 100,
      lifetimeCreditIn: toNum(client.lifetimeCreditIn) / 100,
      lifetimeCreditOut: toNum(client.lifetimeCreditOut) / 100,
      // Previous Equity
      thisWeekPreviousEquity: toNum(client.thisWeekPreviousEquity) / 100,
      thisMonthPreviousEquity: toNum(client.thisMonthPreviousEquity) / 100,
      previousEquity: toNum(client.previousEquity) / 100,
      // Note: login is NOT divided (it's an ID, not a currency value)
    }

    // Track keys we have explicitly normalized to avoid double-scaling
    const explicitlyScaledKeys = new Set([
      'balance','credit','equity','margin','marginFree','profit','floating','pnl','assets','liabilities',
      'blockedCommission','blockedProfit','storage','marginInitial','marginMaintenance','soEquity','soMargin',
      'dailyDeposit','dailyWithdrawal','dailyPnL','thisWeekPnL','thisMonthPnL','lifetimePnL','dailyBonusIn','dailyBonusOut',
      'thisWeekBonusIn','thisWeekBonusOut','thisMonthBonusIn','thisMonthBonusOut','lifetimeBonusIn','lifetimeBonusOut',
      'thisWeekDeposit','thisWeekWithdrawal','thisMonthDeposit','thisMonthWithdrawal','lifetimeDeposit','lifetimeWithdrawal',
      'thisWeekCreditIn','thisWeekCreditOut','thisMonthCreditIn','thisMonthCreditOut','lifetimeCreditIn','lifetimeCreditOut',
      'thisWeekPreviousEquity','thisMonthPreviousEquity','previousEquity'
    ])

    // Exclusions: ids, timestamps, non-monetary integers, labels, and percentage keys (handled at display layer)
    const excludedNumericKeys = new Set([
      'login','clientID','leverage','marginLeverage','agent','soActivation','soTime','currencyDigits','rightsMask','language','mqid',
      'registration','lastAccess','lastUpdate','accountLastUpdate','userLastUpdate','marginLevel','applied_percentage','soLevel'
    ])

    // Generic fallback: divide any other numeric field by 100, except excluded or percentage-like keys
    for (const key of Object.keys(client)) {
      if (explicitlyScaledKeys.has(key)) continue
      if (excludedNumericKeys.has(key)) continue
      const val = client[key]
      // Skip percentage fields, they are handled in UI (formatPercent)
      if (/_percentage$/i.test(key)) continue
      // Use robust numeric parsing for all values (not just numbers)
      const num = toNum(val)
      if (num !== 0 || val == null || val === 0) {
        // Only scale if it's a legitimate numeric value (including 0)
        normalized[key] = num / 100
      }
    }

    return normalized
  }

  // Check if data is stale
  const isStale = (key) => {
    if (!lastFetch[key]) return true
    return Date.now() - lastFetch[key] > CACHE_DURATION
  }

  // Calculate stats from full clients array (used on initial load)
  const calculateFullStats = useCallback((clientsArray) => {
    const stats = {
      totalClients: clientsArray.length,
      totalBalance: 0,
      totalCredit: 0,
      totalEquity: 0,
      totalPnl: 0,
      totalProfit: 0,
      dailyDeposit: 0,
      dailyWithdrawal: 0,
      dailyPnL: 0,
      thisWeekPnL: 0,
      thisMonthPnL: 0,
      lifetimePnL: 0,
      totalDeposit: 0
    }
    
    clientsArray.forEach(client => {
      stats.totalBalance += toNum(client.balance)
      stats.totalCredit += toNum(client.credit)
      stats.totalEquity += toNum(client.equity)
      stats.totalPnl += toNum(client.pnl)
      stats.totalProfit += toNum(client.profit)
      // API uses camelCase for deposit/withdrawal fields
      stats.dailyDeposit += toNum(client.dailyDeposit)
      stats.dailyWithdrawal += toNum(client.dailyWithdrawal)
      // Use backend-provided PnL buckets directly (no sign inversion)
      stats.dailyPnL += toNum(client.dailyPnL)
      stats.thisWeekPnL += toNum(client.thisWeekPnL)
      stats.thisMonthPnL += toNum(client.thisMonthPnL)
      stats.lifetimePnL += toNum(client.lifetimePnL)
      stats.totalDeposit += toNum(client.dailyDeposit)  // Sum all daily deposits
    })
    
    return stats
  }, [])

  // Helper: compute per-key deltas between two stats objects
  const diffStats = useCallback((a, b) => {
    const keys = [
      'totalBalance','totalCredit','totalEquity','totalPnl','totalProfit',
      'dailyDeposit','dailyWithdrawal','dailyPnL','thisWeekPnL','thisMonthPnL','lifetimePnL'
    ]
    const diff = {}
    keys.forEach(k => {
      diff[k] = (a?.[k] || 0) - (b?.[k] || 0)
    })
    return diff
  }, [])

  // Update stats incrementally based on old vs new client data (batched)
  const updateStatsIncremental = useCallback((oldClient, newClient) => {
    if (!newClient?.login) return
    
    // Check if we've already processed this exact update
    const clientLogin = newClient.login
    const lastState = lastClientStateRef.current.get(clientLogin)
    
    // Create a signature of the current state for key financial fields
    // Include all numeric fields that feed our totals so we don't skip updates that change them
    const currentSignature = [
      toNum(newClient.balance),
      toNum(newClient.credit),
      toNum(newClient.equity),
      toNum(newClient.pnl),
      toNum(newClient.profit),
      toNum(newClient.dailyDeposit),
      toNum(newClient.dailyWithdrawal),
      toNum(newClient.dailyPnL),
      toNum(newClient.thisWeekPnL),
      toNum(newClient.thisMonthPnL),
      toNum(newClient.lifetimePnL),
      toNum(newClient.lastUpdate)
    ].join('_')
    
    // Skip if this is a duplicate update (same signature as last processed)
    if (lastState === currentSignature) {
      return // Already processed this exact state
    }
    
    // Update the last processed signature
    lastClientStateRef.current.set(clientLogin, currentSignature)
    
    // Calculate delta (use lastState parsed values if available, otherwise use oldClient)
    const delta = {
      totalBalance: toNum(newClient?.balance) - toNum(oldClient?.balance),
      totalCredit: toNum(newClient?.credit) - toNum(oldClient?.credit),
      totalEquity: toNum(newClient?.equity) - toNum(oldClient?.equity),
      totalPnl: toNum(newClient?.pnl) - toNum(oldClient?.pnl),
      totalProfit: toNum(newClient?.profit) - toNum(oldClient?.profit),
      // API uses camelCase for deposit/withdrawal fields
      dailyDeposit: toNum(newClient?.dailyDeposit) - toNum(oldClient?.dailyDeposit),
      dailyWithdrawal: toNum(newClient?.dailyWithdrawal) - toNum(oldClient?.dailyWithdrawal),
      // Use backend-provided PnL bucket deltas directly (no sign inversion)
      dailyPnL: toNum(newClient?.dailyPnL) - toNum(oldClient?.dailyPnL),
      thisWeekPnL: toNum(newClient?.thisWeekPnL) - toNum(oldClient?.thisWeekPnL),
      thisMonthPnL: toNum(newClient?.thisMonthPnL) - toNum(oldClient?.thisMonthPnL),
      lifetimePnL: toNum(newClient?.lifetimePnL) - toNum(oldClient?.lifetimePnL),
      totalDeposit: toNum(newClient?.dailyDeposit) - toNum(oldClient?.dailyDeposit)
    }
    
    // Accumulate deltas in batch
    const batch = statsUpdateBatchRef.current
    batch.deltas.totalBalance += delta.totalBalance
    batch.deltas.totalCredit += delta.totalCredit
    batch.deltas.totalEquity += delta.totalEquity
    batch.deltas.totalPnl += delta.totalPnl
    batch.deltas.totalProfit += delta.totalProfit
    batch.deltas.dailyDeposit += delta.dailyDeposit
    batch.deltas.dailyWithdrawal += delta.dailyWithdrawal
    batch.deltas.dailyPnL += delta.dailyPnL
    batch.deltas.thisWeekPnL += delta.thisWeekPnL
    batch.deltas.thisMonthPnL += delta.thisMonthPnL
    batch.deltas.lifetimePnL += delta.lifetimePnL
    batch.deltas.totalDeposit += delta.totalDeposit
    
    // Schedule batch update (debounced; adaptive delay)
    if (!batch.pending) {
      batch.pending = true
      const delay = Math.max(200, Math.min(2000, statsBatchDelayRef.current || 1000))
      setTimeout(() => {
        setClientStats(prev => ({
          ...prev,
          totalBalance: prev.totalBalance + batch.deltas.totalBalance,
          totalCredit: prev.totalCredit + batch.deltas.totalCredit,
          totalEquity: prev.totalEquity + batch.deltas.totalEquity,
          totalPnl: prev.totalPnl + batch.deltas.totalPnl,
          totalProfit: prev.totalProfit + batch.deltas.totalProfit,
          dailyDeposit: prev.dailyDeposit + batch.deltas.dailyDeposit,
          dailyWithdrawal: prev.dailyWithdrawal + batch.deltas.dailyWithdrawal,
          dailyPnL: prev.dailyPnL + batch.deltas.dailyPnL,
          thisWeekPnL: prev.thisWeekPnL + batch.deltas.thisWeekPnL,
          thisMonthPnL: prev.thisMonthPnL + batch.deltas.thisMonthPnL,
          lifetimePnL: prev.lifetimePnL + batch.deltas.lifetimePnL,
          totalDeposit: prev.totalDeposit + batch.deltas.totalDeposit
        }))
        
        // Reset batch
        batch.deltas = {
          totalBalance: 0, totalCredit: 0, totalEquity: 0, totalPnl: 0, totalProfit: 0,
          dailyDeposit: 0, dailyWithdrawal: 0, dailyPnL: 0, thisWeekPnL: 0, thisMonthPnL: 0, lifetimePnL: 0,
          totalDeposit: 0
        }
        batch.pending = false
      }, delay) // Adaptive stats update interval
    }
  }, [])

  // Fetch clients data
  const fetchClients = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      console.log('[DataContext] Not authenticated, skipping fetchClients')
      return []
    }
    
    // Prevent concurrent fetches using ref-based lock (immediate check)
    if (isFetchingClientsRef.current) {
      console.log('[DataContext] ⚠️ fetchClients already in progress, skipping duplicate call')
      return clients
    }
    
    if (!force && clients.length > 0 && !isStale('clients')) {
      return clients
    }

    // Set lock immediately (before async state update)
    isFetchingClientsRef.current = true
    setLoading(prev => ({ ...prev, clients: true }))
    
    try {
      const response = await fetchWithRetry(() => brokerAPI.getClients(), { retries: 2, baseDelayMs: 700, label: 'getClients' })
      const rawData = response.data?.clients || []

      // Normalize USC consistently using the shared helper (avoids double/partial normalization)
      const normalizedData = rawData.map(normalizeUSCValues)
      
      // Deduplicate clients by login (keep last occurrence)
      const clientsMap = new Map()
      normalizedData.forEach(client => {
        if (client && client.login) {
          clientsMap.set(client.login, client)
        }
      })
      const data = Array.from(clientsMap.values())
      
      if (rawData.length !== data.length) {
        console.warn(`[DataContext] ⚠️ Deduplicated ${rawData.length - data.length} duplicate clients (${rawData.length} → ${data.length})`)
      }
      
      setClients(data)
      setAccounts(data) // Keep accounts in sync
      
      // Initialize last state tracking for all clients to prevent duplicate processing
      lastClientStateRef.current.clear()
      data.forEach(client => {
        if (client?.login) {
          const signature = `${client.balance || 0}_${client.credit || 0}_${client.equity || 0}_${client.dailyDeposit || 0}_${client.dailyWithdrawal || 0}_${client.dailyPnL || 0}_${client.lastUpdate || 0}`
          lastClientStateRef.current.set(client.login, signature)
        }
      })
      
      // Calculate full stats on initial load (with guard against concurrent calls)
      if (!isCalculatingStatsRef.current) {
        isCalculatingStatsRef.current = true
        const stats = calculateFullStats(data)
        setClientStats(stats)
        console.log('[DataContext] 📊 Initial stats calculated:', stats)
        // Reset flag after a short delay to allow state update to complete
        setTimeout(() => { isCalculatingStatsRef.current = false }, 100)
      } else {
        console.log('[DataContext] ⚠️ Skipped redundant stats calculation (already in progress)')
      }
      setLastFetch(prev => ({ ...prev, clients: Date.now(), accounts: Date.now() }))
      
      // Mark that we have initial data - safe to connect WebSocket now
      if (!hasInitialData) {
        setHasInitialData(true)
        console.log('[DataContext] ✅ Initial data loaded, WebSocket will connect now')
      }
      
      return data
    } catch (error) {
      console.error('[DataContext] Failed to fetch clients:', error)
      // Allow WebSocket to connect even if REST failed; live updates can populate state
      if (!hasInitialData) {
        setHasInitialData(true)
        console.warn('[DataContext] ⚠️ Proceeding to WebSocket without initial clients due to errors')
      }
      throw error
    } finally {
      setLoading(prev => ({ ...prev, clients: false }))
      // Release lock
      isFetchingClientsRef.current = false
    }
  }, [clients, isAuthenticated])

  // Fetch positions data
  const fetchPositions = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      console.log('[DataContext] Not authenticated, skipping fetchPositions')
      return []
    }
    
    if (!force && positions.length > 0 && !isStale('positions')) {
      return positions
    }

    setLoading(prev => ({ ...prev, positions: true }))
    
    try {
      const response = await fetchWithRetry(() => brokerAPI.getPositions(), { retries: 2, baseDelayMs: 700, label: 'getPositions' })
      const data = response.data?.positions || []
      setPositions(data)
      setLastFetch(prev => ({ ...prev, positions: Date.now() }))
      return data
    } catch (error) {
      console.error('[DataContext] Failed to fetch positions:', error)
      throw error
    } finally {
      setLoading(prev => ({ ...prev, positions: false }))
    }
  }, [positions, isAuthenticated, fetchWithRetry])

  // Fetch orders data
  const fetchOrders = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      console.log('[DataContext] Not authenticated, skipping fetchOrders')
      return []
    }
    
    if (!force && orders.length > 0 && !isStale('orders')) {
      return orders
    }

    setLoading(prev => ({ ...prev, orders: true }))
    
    try {
      const response = await fetchWithRetry(() => brokerAPI.getOrders(), { retries: 2, baseDelayMs: 700, label: 'getOrders' })
      const data = response.data?.orders || []
      setOrders(data)
      setLastFetch(prev => ({ ...prev, orders: Date.now() }))
      return data
    } catch (error) {
      console.error('[DataContext] Failed to fetch orders:', error)
      throw error
    } finally {
      setLoading(prev => ({ ...prev, orders: false }))
    }
  }, [orders, isAuthenticated, fetchWithRetry])

  // Fetch accounts data (for margin level)
  const fetchAccounts = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      console.log('[DataContext] Not authenticated, skipping fetchAccounts')
      return []
    }
    
    if (!force && accounts.length > 0 && !isStale('accounts')) {
      return accounts
    }

    setLoading(prev => ({ ...prev, accounts: true }))
    
    try {
      const response = await fetchWithRetry(() => brokerAPI.getClients(), { retries: 2, baseDelayMs: 700, label: 'getAccounts(getClients)' })
      const data = response.data?.clients || []
      setAccounts(data)
      setLastFetch(prev => ({ ...prev, accounts: Date.now() }))
      return data
    } catch (error) {
      console.error('[DataContext] Failed to fetch accounts:', error)
      throw error
    } finally {
      setLoading(prev => ({ ...prev, accounts: false }))
    }
  }, [accounts, isAuthenticated, fetchWithRetry])

  // Setup WebSocket subscriptions (only after initial data is loaded)
  useEffect(() => {
    // Don't connect WebSocket until we have initial data from REST API
    if (!isAuthenticated || !hasInitialData) {
      if (isAuthenticated && !hasInitialData) {
        console.log('[DataContext] ⏳ Waiting for initial data before connecting WebSocket...')
      }
      return
    }
    
    // Connect WebSocket only after initial data is loaded
    console.log('[DataContext] 🔌 Connecting WebSocket after initial data load...')
    websocketService.connect()

    // Monitor connection state
    const unsubState = websocketService.onConnectionStateChange((state) => {
      setConnectionState(state)
      
      // Refresh all data once when disconnected
      if ((state === 'disconnected' || state === 'failed') && isAuthenticated) {
        fetchClients(true).catch(() => {})
        fetchPositions(true).catch(() => {})
        fetchOrders(true).catch(() => {})
        fetchAccounts(true).catch(() => {})
      }
    })

    // Debug: Log all unique event types and monitor message flow
    const seenEvents = new Set()
    let totalMessagesReceived = 0
    let lastActivityLog = Date.now()
    
    const unsubDebug = websocketService.subscribe('all', (message) => {
      totalMessagesReceived++
      
      // Log activity every 10 seconds
      if (Date.now() - lastActivityLog > 10000) {
        console.log(`[DataContext] 📡 WebSocket active: ${totalMessagesReceived} messages in last 10s`)
        totalMessagesReceived = 0
        lastActivityLog = Date.now()
      }
      
      const eventType = message.event || message.type
      if (eventType && !seenEvents.has(eventType)) {
        seenEvents.add(eventType)
        console.log('[DataContext] 🔔 New event type:', eventType)
      }
    })

    // Subscribe to clients updates
  const unsubClients = websocketService.subscribe('clients', (data) => {
      try {
        // Mark receive timestamp for latency instrumentation (throttled)
        {
          const now = Date.now()
          if (now - (lastReceiveEmitRef.current || 0) > 200) {
            lastReceiveEmitRef.current = now
            setLastWsReceiveAt(now)
          }
        }
        const rawClients = data.data?.clients || data.clients
        if (rawClients && Array.isArray(rawClients)) {
          // Normalize USC currency values for all clients
          const normalizedClients = rawClients.map(normalizeUSCValues)
          
          // Deduplicate clients by login
          const clientsMap = new Map()
          normalizedClients.forEach(client => {
            if (client && client.login) {
              clientsMap.set(client.login, client)
            }
          })
          const newClients = Array.from(clientsMap.values())
          
          if (normalizedClients.length !== newClients.length) {
            console.warn(`[DataContext] ⚠️ WebSocket: Deduplicated ${normalizedClients.length - newClients.length} duplicate clients`)
          }
          
          // Guard: avoid cascading re-renders if snapshot is identical (same logins + signatures)
          let shouldUpdateSnapshot = true
          lowPriority(() => setClients(prev => {
            if (prev.length === newClients.length) {
              let allSame = true
              for (let i = 0; i < prev.length; i++) {
                const a = prev[i]
                const b = newClients[i]
                // Compare stable identity + a few key fields that indicate change
                if (!a || !b || a.login !== b.login || a.balance !== b.balance || a.equity !== b.equity || a.profit !== b.profit || a.lastUpdate !== b.lastUpdate) {
                  allSame = false
                  break
                }
              }
              if (allSame) {
                shouldUpdateSnapshot = false
                return prev // skip state update
              }
            }
            return newClients
          }))
          lowPriority(() => setAccounts(prev => {
            if (!shouldUpdateSnapshot) return prev
            return newClients
          }))
          if (shouldUpdateSnapshot) {
            lowPriority(() => setLastFetch(prev => ({ ...prev, clients: Date.now(), accounts: Date.now() })))
          }

          // Reset signature tracking to this fresh snapshot
          lastClientStateRef.current.clear()
          newClients.forEach(c => {
            if (c?.login) {
              const sig = [
                toNum(c.balance),
                toNum(c.credit),
                toNum(c.equity),
                toNum(c.pnl),
                toNum(c.profit),
                toNum(c.dailyDeposit),
                toNum(c.dailyWithdrawal),
                toNum(c.dailyPnL),
                toNum(c.thisWeekPnL),
                toNum(c.thisMonthPnL),
                toNum(c.lifetimePnL),
                toNum(c.lastUpdate)
              ].join('_')
              lastClientStateRef.current.set(c.login, sig)
            }
          })

          // Recalculate full stats on fresh snapshot
          if (shouldUpdateSnapshot) {
            try {
              const snapStats = calculateFullStats(newClients)
              // Only apply if differs meaningfully (prevent update depth loops)
              const diff = diffStats(snapStats, clientStats)
              const hasMeaningfulDiff = Object.values(diff).some(v => Math.abs(v) > 0.00001)
              if (hasMeaningfulDiff) {
                lowPriority(() => setClientStats(snapStats))
              }
            } catch (e) {
              console.warn('[DataContext] Failed recalculating stats from full snapshot', e)
            }
          }
          
          // Update timestamp from bulk data
          if (newClients.length > 0) {
            let maxTs = 0
            for (let i = 0; i < Math.min(newClients.length, 100); i++) {
              const rawTs = newClients[i]?.serverTimestamp || newClients[i]?.lastUpdate || 0
              const tsMs = toMs(rawTs)
              if (tsMs > maxTs) maxTs = tsMs
            }
            if (maxTs === 0) maxTs = Date.now() // Fallback to current time
            setLatestServerTimestamp(maxTs)
            setLatestMeasuredLagMs(Math.max(0, Date.now() - maxTs))
          }
        }
      } catch (error) {
        console.error('[DataContext] Error processing clients update:', error)
      }
    })

    // ULTRA-OPTIMIZED batch processing
  let pendingUpdates = new Map()
  let batchTimer = null
  let totalProcessed = 0
  let lastBatchTimestamp = 0
  // Adaptive flush tracking
  const firstPendingAtRef = { current: 0 }
  const lastFlushAtRef = { current: 0 }
    
    // Create index map for O(1) lookups instead of O(n) findIndex
    let clientIndexMap = new Map()
    let accountIndexMap = new Map()
    
    const rebuildIndexMaps = (clientsArray, accountsArray) => {
      clientIndexMap.clear()
      accountIndexMap.clear()
      clientsArray.forEach((c, i) => clientIndexMap.set(c.login, i))
      accountsArray.forEach((a, i) => accountIndexMap.set(a.login, i))
    }
    
    const processBatch = () => {
      if (pendingUpdates.size === 0) return
      
      // Mark receive timestamp at the start of processing a batch (throttled)
      {
        const nowTs = Date.now()
        if (nowTs - (lastReceiveEmitRef.current || 0) > 200) {
          lastReceiveEmitRef.current = nowTs
          setLastWsReceiveAt(nowTs)
        }
      }

  const startTime = performance.now()
      const batchSize = pendingUpdates.size
      const updates = Array.from(pendingUpdates.values())
      pendingUpdates.clear()
      
      totalProcessed += batchSize
      
      // Find the most recent timestamp in this batch (ensure ms)
      let batchMaxTimestamp = 0
      for (let i = 0; i < updates.length; i++) {
        const rawTs = updates[i].updatedAccount?.serverTimestamp || updates[i].updatedAccount?.lastUpdate || 0
        const ts = toMs(rawTs)
        if (ts > batchMaxTimestamp) batchMaxTimestamp = ts
      }
      
      // If no valid server timestamp, use current time as fallback (WebSocket is live)
      if (batchMaxTimestamp === 0 && batchSize > 0) {
        batchMaxTimestamp = Date.now()
      }
      
      if (batchMaxTimestamp > lastBatchTimestamp) {
        lastBatchTimestamp = batchMaxTimestamp
        setLatestServerTimestamp(batchMaxTimestamp)
        setLatestMeasuredLagMs(Math.max(0, Date.now() - batchMaxTimestamp))
      }
      
      // Log batch processing with timing
      if (batchSize > 200 || totalProcessed % 1000 === 0) {
        const latency = batchMaxTimestamp > 0 ? Math.floor((Date.now() - batchMaxTimestamp) / 1000) : 0
        const processingTime = Math.round(performance.now() - startTime)
        console.log(`[DataContext] 📦 ${batchSize} updates in ${processingTime}ms (Total: ${totalProcessed}, Lag: ${latency}s)`)
      }

      // Emit perf stats (rate-limited to 500ms)
      const now = Date.now()
      const ageMs = batchMaxTimestamp > 0 ? Math.max(0, now - batchMaxTimestamp) : 0
      const processMs = Math.round(performance.now() - startTime)
      lastFlushAtRef.current = now
      const shouldEmit = now - (perfLastEmitRef.current || 0) >= 500
      if (shouldEmit) {
        perfLastEmitRef.current = now
        const perf = perfRef.current
        perf.pendingUpdatesSize = pendingUpdates.size
        perf.lastBatchProcessMs = processMs
        perf.lastBatchAgeMs = ageMs
        perf.totalProcessedUpdates = totalProcessed
        perf.lastFlushAt = now
        try { window.__brokerPerf = perf } catch {}
      }

      // Adapt stats update delay based on load
      if (batchSize >= 200 || ageMs >= 2000) {
        statsBatchDelayRef.current = 500
      } else {
        statsBatchDelayRef.current = 1000
      }
      
      // OPTIMIZED: Single state update for clients with index map
      let addedClientsCount = 0
      lowPriority(() => setClients(prev => {
        // Rebuild index if needed
        if (clientIndexMap.size === 0 && prev.length > 0) {
          prev.forEach((c, i) => clientIndexMap.set(c.login, i))
        }
        
        const updated = [...prev]
        let hasNewClients = false
        
        // Cache original values BEFORE any modifications (for accurate delta calculation)
        const originalValues = new Map()
        for (let i = 0; i < updates.length; i++) {
          const { accountLogin } = updates[i]
          const index = clientIndexMap.get(accountLogin)
          if (index !== undefined && !originalValues.has(accountLogin)) {
            originalValues.set(accountLogin, updated[index])
          }
        }
        
        for (let i = 0; i < updates.length; i++) {
          const { updatedAccount, accountLogin } = updates[i]
          const index = clientIndexMap.get(accountLogin)
          
          if (index === undefined) {
            // New client - add to end
            updateStatsIncremental(null, updatedAccount)
            const newIndex = updated.length
            updated.push(updatedAccount)
            clientIndexMap.set(accountLogin, newIndex)
            hasNewClients = true
            addedClientsCount++
          } else {
            // Update existing - SELECTIVE MERGE: only update defined values, preserve existing for undefined
            const oldClient = originalValues.get(accountLogin)
            const existingClient = updated[index]
            
            // Merge: only overwrite fields that are explicitly defined in the update
            const merged = { ...existingClient }
            for (const key in updatedAccount) {
              if (updatedAccount[key] !== undefined) {
                merged[key] = updatedAccount[key]
              }
            }
            
            updateStatsIncremental(oldClient, merged)
            updated[index] = merged
          }
        }
        return updated
      }))

      // Update client count outside setClients to avoid nested state updates triggering extra renders
      if (addedClientsCount > 0) {
        lowPriority(() => setClientStats(s => ({ ...s, totalClients: s.totalClients + addedClientsCount })))
      }
      
      // OPTIMIZED: Single state update for accounts with index map
      lowPriority(() => setAccounts(prev => {
        // Rebuild index if needed
        if (accountIndexMap.size === 0 && prev.length > 0) {
          prev.forEach((a, i) => accountIndexMap.set(a.login, i))
        }
        
        const updated = [...prev]
        
        for (let i = 0; i < updates.length; i++) {
          const { updatedAccount, accountLogin } = updates[i]
          const index = accountIndexMap.get(accountLogin)
          
          if (index === undefined) {
            // New account
            const newIndex = updated.length
            updated.push(updatedAccount)
            accountIndexMap.set(accountLogin, newIndex)
          } else {
            // Update existing - SELECTIVE MERGE: only update defined values
            const existingAccount = updated[index]
            const merged = { ...existingAccount }
            for (const key in updatedAccount) {
              if (updatedAccount[key] !== undefined) {
                merged[key] = updatedAccount[key]
              }
            }
            updated[index] = merged
          }
        }
        
        return updated
      }))
    }

    // Track if we're receiving updates
    let updateCount = 0
    let lastUpdateLog = Date.now()
    
    // Subscribe to ACCOUNT_UPDATED for individual updates (BATCHED)
    const unsubAccountUpdate = websocketService.subscribe('ACCOUNT_UPDATED', (message) => {
      try {
        updateCount++
        
        // Log every 5 seconds to confirm we're receiving updates
        if (Date.now() - lastUpdateLog > 5000) {
          console.log(`[DataContext] ✅ Receiving updates: ${updateCount} in last 5s`)
          updateCount = 0
          lastUpdateLog = Date.now()
        }
        
        const updatedAccount = message.data
        const accountLogin = message.login || updatedAccount?.login
        
        if (!updatedAccount || !accountLogin) {
          console.warn('[DataContext] ⚠️ Invalid ACCOUNT_UPDATED message:', message)
          return
        }
        
        // Normalize USC currency values
        const normalizedAccount = normalizeUSCValues(updatedAccount)
        
        // Keep SERVER timestamp to measure actual system latency
        const serverTimestamp = message.timestamp
        if (serverTimestamp) {
          const timestampMs = serverTimestamp < 10000000000 ? serverTimestamp * 1000 : serverTimestamp
          normalizedAccount.serverTimestamp = timestampMs
        }
        
        // Add to batch (Map prevents duplicates)
        pendingUpdates.set(accountLogin, { updatedAccount: normalizedAccount, accountLogin })

        // Adaptive flush criteria:
        // - Immediate if backlog large
        // - Flush when first-pending age exceeds 40ms
        // - Ensure max time between flushes is 200ms
        const now = Date.now()
        const size = pendingUpdates.size
        const largeBacklog = size >= 200
        const maxSinceFlush = now - (lastFlushAtRef.current || 0) >= 200
        if (!firstPendingAtRef.current) firstPendingAtRef.current = now
        const ageSinceFirst = now - firstPendingAtRef.current

        if (largeBacklog || ageSinceFirst >= 40 || maxSinceFlush) {
          if (batchTimer) clearTimeout(batchTimer)
          firstPendingAtRef.current = 0
          processBatch()
        } else {
          if (batchTimer) clearTimeout(batchTimer)
          // Schedule flush at the 40ms mark from first pending
          const remaining = Math.max(0, 40 - ageSinceFirst)
          batchTimer = setTimeout(() => {
            firstPendingAtRef.current = 0
            processBatch()
          }, remaining)
        }
        
      } catch (error) {
        console.error('[DataContext] Error processing ACCOUNT_UPDATED:', error)
      }
    })

    // Subscribe to USER_ADDED (new client/user created in MT5)
    const unsubUserAdded = websocketService.subscribe('USER_ADDED', (message) => {
      try {
        const newUser = message.data
        const userLogin = message.login || newUser?.login
        
        console.log('[DataContext] 👤 USER_ADDED:', userLogin, newUser)
        
        if (newUser && userLogin) {
          // Normalize USC currency values
          const normalizedUser = normalizeUSCValues(newUser)
          
          setClients(prev => {
            const exists = Array.isArray(prev) && prev.some(c => c && c.login === userLogin)
            if (exists) {
              console.log('[DataContext] ⚠️ User already exists, skipping add:', userLogin)
              return prev
            }
            console.log('[DataContext] ➕ Adding NEW user to clients:', userLogin)
            
            // Initialize signature tracking for new user
            const signature = `${normalizedUser.balance || 0}_${normalizedUser.credit || 0}_${normalizedUser.equity || 0}_${normalizedUser.dailyDeposit || 0}_${normalizedUser.dailyWithdrawal || 0}_${normalizedUser.dailyPnL || 0}_${normalizedUser.lastUpdate || 0}`
            lastClientStateRef.current.set(userLogin, signature)
            
            // Update stats incrementally for new user
            updateStatsIncremental(null, normalizedUser)
            setClientStats(s => ({ ...s, totalClients: s.totalClients + 1 }))
            return [normalizedUser, ...prev]
          })
          
          setAccounts(prev => {
            const exists = Array.isArray(prev) && prev.some(c => c && c.login === userLogin)
            if (exists) return prev
            return [normalizedUser, ...prev]
          })
        }
      } catch (error) {
        console.error('[DataContext] Error processing USER_ADDED:', error)
      }
    })

    // Subscribe to USER_UPDATED (user/client info updated in MT5)
    const unsubUserUpdated = websocketService.subscribe('USER_UPDATED', (message) => {
      try {
        const updatedUser = message.data
        const userLogin = message.login || updatedUser?.login
        
        if (updatedUser && userLogin) {
          // Normalize USC currency values
          const normalizedUser = normalizeUSCValues(updatedUser)
          
          let oldClient = null
          let mergedClient = null
          
          setClients(prev => {
            // First, deduplicate the previous array to ensure clean state
            // Filter out null/undefined entries and deduplicate by login
            const dedupedPrev = Array.from(
              prev.filter(client => client && client.login).reduce((map, client) => {
                if (!map.has(client.login)) {
                  map.set(client.login, client)
                }
                return map
              }, new Map()).values()
            )
            
            const index = dedupedPrev.findIndex(c => c && c.login === userLogin)
            if (index === -1) {
              // User not found, add as new
              oldClient = null
              mergedClient = normalizedUser
              return [normalizedUser, ...dedupedPrev]
            }
            // Update existing user - SELECTIVE MERGE: only update defined values
            oldClient = dedupedPrev[index]
            const updated = [...dedupedPrev]
            const existingUser = updated[index]
            const merged = { ...existingUser }
            for (const key in normalizedUser) {
              if (normalizedUser[key] !== undefined) {
                merged[key] = normalizedUser[key]
              }
            }
            mergedClient = merged
            updated[index] = merged
            return updated
          })
          
          // Update stats incrementally based on the change - use merged client, not raw update
          updateStatsIncremental(oldClient, mergedClient)
          
          setAccounts(prev => {
            const index = prev.findIndex(c => c && c.login === userLogin)
            if (index === -1) return [normalizedUser, ...prev]
            const updated = [...prev]
            // SELECTIVE MERGE: only update defined values
            const existingAccount = updated[index]
            const merged = { ...existingAccount }
            for (const key in normalizedUser) {
              if (normalizedUser[key] !== undefined) {
                merged[key] = normalizedUser[key]
              }
            }
            updated[index] = merged
            return updated
          })
        }
      } catch (error) {
        console.error('[DataContext] Error processing USER_UPDATED:', error)
      }
    })

    // Subscribe to USER_DELETED (user/client removed from MT5)
    const unsubUserDeleted = websocketService.subscribe('USER_DELETED', (message) => {
      try {
        const deletedUser = message.data
        const userLogin = message.login || deletedUser?.login
        
        console.log('[DataContext] 👤 USER_DELETED:', userLogin)
        
        if (userLogin) {
          // Remove from signature tracking
          lastClientStateRef.current.delete(userLogin)
          
          let deletedClient = null
          
          setClients(prev => {
            // Find the client BEFORE removing to capture their values
            deletedClient = prev.find(c => c.login === userLogin)
            
            const filtered = prev.filter(c => c.login !== userLogin)
            if (filtered.length < prev.length) {
              console.log('[DataContext] ➖ Removed user from clients:', userLogin)
              
              // Subtract deleted client's values from stats
              if (deletedClient) {
                // Create a "zero client" to calculate negative delta
                const zeroClient = {
                  login: userLogin,
                  balance: 0, credit: 0, equity: 0, pnl: 0, profit: 0,
                  dailyDeposit: 0, dailyWithdrawal: 0,
                  dailyPnL: 0, thisWeekPnL: 0, thisMonthPnL: 0, lifetimePnL: 0
                }
                // This will subtract all of deletedClient's values
                updateStatsIncremental(deletedClient, zeroClient)
                // Decrement total client count
                setClientStats(s => ({ ...s, totalClients: Math.max(0, s.totalClients - 1) }))
              }
            }
            return filtered
          })
          
          setAccounts(prev => prev.filter(c => c.login !== userLogin))
        }
      } catch (error) {
        console.error('[DataContext] Error processing USER_DELETED:', error)
      }
    })

    // Subscribe to positions updates
    const unsubPositions = websocketService.subscribe('positions', (data) => {
      try {
        const newPositions = data.data?.positions || data.positions
        if (newPositions && Array.isArray(newPositions)) {
          console.log('[DataContext] 📦 Full positions snapshot received:', newPositions.length, 'positions')
          lowPriority(() => setPositions(newPositions))
          lowPriority(() => setLastFetch(prev => ({ ...prev, positions: Date.now() })))
        }
      } catch (error) {
        console.error('[DataContext] Error processing positions update:', error)
      }
    })

    // Subscribe to POSITION_OPENED (MT5 realtime position add)
    const unsubPosOpened = websocketService.subscribe('POSITION_OPENED', (message) => {
      try {
        const position = message.data || message
        if (position) {
          const posId = position.position || position.id
          console.log('[DataContext] ➕ POSITION_OPENED:', posId, 'Login:', position.login, 'Symbol:', position.symbol)
          lowPriority(() => setPositions(prev => {
            // Check if position already exists
            const exists = prev.some(p => (p.position || p.id) === posId)
            if (exists) {
              console.log('[DataContext] ⚠️ Position already exists, skipping add:', posId)
              return prev
            }
            return [position, ...prev]
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_OPENED:', error)
      }
    })

    // Subscribe to POSITION_UPDATED (MT5 realtime position change)
    const unsubPosUpdated = websocketService.subscribe('POSITION_UPDATED', (message) => {
      try {
        const updatedPos = message.data || message
        const posId = updatedPos?.position || updatedPos?.id
        
        if (posId) {
          console.log('[DataContext] ✏️ POSITION_UPDATED:', posId, 'Profit:', updatedPos.profit, 'Volume:', updatedPos.volume)
          lowPriority(() => setPositions(prev => {
            const index = prev.findIndex(p => (p.position || p.id) === posId)
            if (index === -1) {
              // Position doesn't exist, add it
              console.log('[DataContext] ⚠️ Position not found, adding it:', posId)
              return [updatedPos, ...prev]
            }
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedPos }
            return updated
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_UPDATED:', error)
      }
    })

    // Keep legacy POSITION_ADDED for backward compatibility
    const unsubPosAdded = websocketService.subscribe('POSITION_ADDED', (message) => {
      try {
        const position = message.data || message
        if (position) {
          const posId = position.position || position.id
          console.log('[DataContext] ➕ POSITION_ADDED (legacy):', posId)
          lowPriority(() => setPositions(prev => {
            const exists = prev.some(p => (p.position || p.id) === posId)
            if (exists) return prev
            return [position, ...prev]
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_ADDED:', error)
      }
    })

    // Subscribe to POSITION_PNL_UPDATE (real-time profit/loss updates)
    const unsubPosPnlUpdate = websocketService.subscribe('POSITION_PNL_UPDATE', (message) => {
      try {
        const updatedPos = message.data || message
        const posId = updatedPos?.position || updatedPos?.id
        
        if (posId) {
          lowPriority(() => setPositions(prev => {
            const index = prev.findIndex(p => (p.position || p.id) === posId)
            if (index === -1) return prev
            
            const oldProfit = prev[index].profit
            const newProfit = updatedPos.profit
            
            // Skip update if profit hasn't actually changed
            if (oldProfit === newProfit && prev[index].priceCurrent === updatedPos.priceCurrent) {
              return prev // Return same reference to prevent unnecessary re-render
            }
            
            const updated = [...prev]
            // Update position with new P&L data
            updated[index] = { 
              ...updated[index], 
              priceCurrent: updatedPos.priceCurrent,
              profit: newProfit,
              profit_percentage: updatedPos.profit_percentage,
              storage: updatedPos.storage,
              storage_percentage: updatedPos.storage_percentage,
              timeUpdate: updatedPos.timeUpdate
            }
            
            return updated
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_PNL_UPDATE:', error)
      }
    })

    // Subscribe to POSITION_CLOSED (MT5 realtime position delete)
    const unsubPosClosed = websocketService.subscribe('POSITION_CLOSED', (message) => {
      try {
        const posId = message.position || message.data?.position || message.id
        if (posId) {
          console.log('[DataContext] ❌ POSITION_CLOSED:', posId)
          lowPriority(() => setPositions(prev => {
            const newPositions = prev.filter(p => (p.position || p.id) !== posId)
            if (newPositions.length === prev.length) {
              console.log('[DataContext] ⚠️ Position not found for closure:', posId)
              return prev // Return same reference
            }
            console.log('[DataContext] ✅ Position closed. Count:', prev.length, '→', newPositions.length)
            return newPositions
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_CLOSED:', error)
      }
    })

    // Keep legacy POSITION_DELETED for backward compatibility
    const unsubPosDeleted = websocketService.subscribe('POSITION_DELETED', (message) => {
      try {
        const posId = message.position || message.data?.position || message.id
        if (posId) {
          console.log('[DataContext] ❌ POSITION_DELETED (legacy):', posId)
          lowPriority(() => setPositions(prev => {
            const newPositions = prev.filter(p => (p.position || p.id) !== posId)
            if (newPositions.length === prev.length) return prev
            console.log('[DataContext] ✅ Position removed. Count:', prev.length, '→', newPositions.length)
            return newPositions
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_DELETED:', error)
      }
    })

    // Subscribe to orders updates
    const unsubOrders = websocketService.subscribe('orders', (data) => {
      try {
        const newOrders = data.data?.orders || data.orders
        if (newOrders && Array.isArray(newOrders)) {
          lowPriority(() => setOrders(newOrders))
          lowPriority(() => setLastFetch(prev => ({ ...prev, orders: Date.now() })))
        }
      } catch (error) {
        console.error('[DataContext] Error processing orders update:', error)
      }
    })

    // Subscribe to ORDER_ADDED
    const unsubOrderAdded = websocketService.subscribe('ORDER_ADDED', (message) => {
      try {
        const order = message.data || message
        if (order) {
          lowPriority(() => setOrders(prev => {
            // Check if order already exists
            const orderId = order.order || order.ticket || order.id
            if (prev.some(o => (o.order || o.ticket || o.id) === orderId)) {
              return prev
            }
            return [order, ...prev]
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing ORDER_ADDED:', error)
      }
    })

    // Subscribe to ORDER_UPDATED
    const unsubOrderUpdated = websocketService.subscribe('ORDER_UPDATED', (message) => {
      try {
        const updatedOrder = message.data || message
        const orderId = updatedOrder?.order || updatedOrder?.ticket || updatedOrder?.id
        
        if (orderId) {
          lowPriority(() => setOrders(prev => {
            const index = prev.findIndex(o => (o.order || o.ticket || o.id) === orderId)
            if (index === -1) {
              return [updatedOrder, ...prev]
            }
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedOrder }
            return updated
          }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing ORDER_UPDATED:', error)
      }
    })

    // Subscribe to ORDER_DELETED
    const unsubOrderDeleted = websocketService.subscribe('ORDER_DELETED', (message) => {
      try {
        const orderId = message.order || message.ticket || message.data?.order || message.data?.ticket || message.id
        if (orderId) {
          lowPriority(() => setOrders(prev => prev.filter(o => (o.order || o.ticket || o.id) !== orderId)))
        }
      } catch (error) {
        console.error('[DataContext] Error processing ORDER_DELETED:', error)
      }
    })

    return () => {
      // Clean up batch timer
      if (batchTimer) {
        clearTimeout(batchTimer)
        processBatch() // Process any pending updates
      }
      firstPendingAtRef.current = 0
      
      unsubDebug()
      unsubState()
      unsubClients()
      unsubAccountUpdate()
      unsubUserAdded()
      unsubUserUpdated()
      unsubUserDeleted()
      unsubPositions()
      unsubPosOpened()
      unsubPosAdded()
      unsubPosUpdated()
      unsubPosPnlUpdate()
      unsubPosClosed()
      unsubPosDeleted()
      unsubOrders()
      unsubOrderAdded()
      unsubOrderUpdated()
      unsubOrderDeleted()
    }
  }, [isAuthenticated, hasInitialData])

  // Periodic reconciliation: recompute stats from current clients to prevent drift
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (clients && clients.length > 0) {
          const recomputed = calculateFullStats(clients)
          // If any key differs beyond a tiny epsilon, snap to recomputed totals
          const eps = 0.0001
          const deltas = diffStats(recomputed, clientStats)
          const hasDiff = Object.values(deltas).some(v => Math.abs(v) > eps)
          // record drift
          setStatsDrift(prev => ({
            ...prev,
            lastSource: 'reconcile',
            lastReconciledAt: Date.now(),
            lastDeltas: deltas,
            lastLocalStats: clientStats
          }))
          if (hasDiff) {
            setClientStats(recomputed)
          }
        }
      } catch (e) {
        console.warn('[DataContext] Periodic stats reconciliation failed', e)
      }
    }, 60000) // 1 minute
    return () => clearInterval(interval)
  }, [clients, clientStats, calculateFullStats, diffStats])

  // Verify current totals against a fresh API read; optionally apply fix
  const verifyAgainstAPI = useCallback(async (apply = false) => {
    const response = await fetchWithRetry(() => brokerAPI.getClients(), { retries: 1, baseDelayMs: 600, label: 'verify:getClients' })
    const raw = response.data?.clients || []
    const normalized = raw.map(normalizeUSCValues)
    // Dedup
    const map = new Map()
    normalized.forEach(c => { if (c && c.login) map.set(c.login, c) })
    const fresh = Array.from(map.values())
    const apiStats = calculateFullStats(fresh)
    const localStats = calculateFullStats(clients || [])
    const deltas = diffStats(apiStats, localStats)
    setStatsDrift(prev => ({
      ...prev,
      lastSource: 'verify',
      lastVerifiedAt: Date.now(),
      lastDeltas: deltas,
      lastApiStats: apiStats,
      lastLocalStats: localStats,
      lastCount: fresh.length
    }))
    if (apply) {
      setClients(fresh)
      setAccounts(fresh)
      setClientStats(apiStats)
      // Reset signatures to API snapshot
      lastClientStateRef.current.clear()
      fresh.forEach(c => {
        if (c?.login) {
          const sig = [
            toNum(c.balance),
            toNum(c.credit),
            toNum(c.equity),
            toNum(c.pnl),
            toNum(c.profit),
            toNum(c.dailyDeposit),
            toNum(c.dailyWithdrawal),
            toNum(c.dailyPnL),
            toNum(c.thisWeekPnL),
            toNum(c.thisMonthPnL),
            toNum(c.lifetimePnL),
            toNum(c.lastUpdate)
          ].join('_')
          lastClientStateRef.current.set(c.login, sig)
        }
      })
    }
    return { apiStats, localStats, deltas, count: fresh.length }
  }, [clients, calculateFullStats, fetchWithRetry])

  // On successful authentication, perform an initial data sync
  useEffect(() => {
    if (!isAuthenticated) return
    
    // Prevent duplicate initial sync (React StrictMode calls effects twice in dev)
    if (hasInitialSyncedRef.current) {
      console.log('[DataContext] ⚠️ Initial sync already completed, skipping duplicate')
      return
    }
    
    hasInitialSyncedRef.current = true
    
    const initialSync = async () => {
      try {
        await Promise.all([
          fetchClients(true).catch(err => { console.error('[DataContext] Initial clients fetch failed:', err?.message || err) }),
          fetchPositions(true).catch(err => { console.error('[DataContext] Initial positions fetch failed:', err?.message || err) }),
          fetchOrders(true).catch(err => { console.error('[DataContext] Initial orders fetch failed:', err?.message || err) }),
          fetchAccounts(true).catch(err => { console.error('[DataContext] Initial accounts fetch failed:', err?.message || err) })
        ])
      } catch (error) {
        console.error('[DataContext] Initial sync error (aggregated):', error)
      } finally {
        if (!hasInitialData) {
          setHasInitialData(true)
          console.warn('[DataContext] ⚠️ Proceeding to connect WebSocket despite partial/failed initial sync')
        }
      }
    }
    
    initialSync()
  }, [isAuthenticated])

  const value = useMemo(() => ({
    // Data
    clients,
    positions,
    orders,
    deals,
    accounts,

    // Aggregated stats (incrementally updated)
    clientStats,

    // Latest server timestamp from WebSocket batch
    latestServerTimestamp,
    latestMeasuredLagMs,
    lastWsReceiveAt,

    // Loading states
    loading,

    // Connection state
    connectionState,

    // Fetch functions
    fetchClients,
    fetchPositions,
    fetchOrders,
    fetchAccounts,

    // Update functions (for manual updates)
    setClients,
    setPositions,
    setOrders,
    setDeals,
    setAccounts,

    // Diagnostics
    verifyAgainstAPI,
    statsDrift
  }), [
    clients, positions, orders, deals, accounts,
    clientStats,
    latestServerTimestamp, latestMeasuredLagMs, lastWsReceiveAt,
    loading, connectionState,
    fetchClients, fetchPositions, fetchOrders, fetchAccounts,
    setClients, setPositions, setOrders, setDeals, setAccounts,
    verifyAgainstAPI, statsDrift
  ])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
