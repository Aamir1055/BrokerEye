import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { brokerAPI } from '../services/api'
import websocketService from '../services/websocket'
import { useAuth } from './AuthContext'

const DataContext = createContext()

export const useData = () => {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

export const DataProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [clients, setClients] = useState([])
  const [positions, setPositions] = useState([])
  const [orders, setOrders] = useState([])
  const [deals, setDeals] = useState([])
  const [accounts, setAccounts] = useState([]) // For margin level
  const [latestServerTimestamp, setLatestServerTimestamp] = useState(null) // Track latest batch timestamp
  
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
  
  // Track last processed state per client to prevent duplicate delta calculations
  const lastClientStateRef = useRef(new Map())
  
  // Flag to prevent multiple simultaneous full stats calculations
  const isCalculatingStatsRef = useRef(false)
  
  // Lock to prevent concurrent fetchClients calls
  const isFetchingClientsRef = useRef(false)
  
  // Track if initial sync has been done
  const hasInitialSyncedRef = useRef(false)
  
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

  // Helper function to normalize USC currency values (divide by 100)
  const normalizeUSCValues = (client) => {
    if (!client || !client.currency || client.currency.toLowerCase() !== 'usc') {
      return client
    }
    return {
      ...client,
      balance: (client.balance || 0) / 100,
      credit: (client.credit || 0) / 100,
      equity: (client.equity || 0) / 100,
      margin: (client.margin || 0) / 100,
      marginFree: (client.marginFree || 0) / 100,
      profit: (client.profit || 0) / 100,
      floating: (client.floating || 0) / 100,
      pnl: (client.pnl || 0) / 100,
      assets: (client.assets || 0) / 100,
      liabilities: (client.liabilities || 0) / 100,
      blockedCommission: (client.blockedCommission || 0) / 100,
      blockedProfit: (client.blockedProfit || 0) / 100,
      storage: (client.storage || 0) / 100,
      marginInitial: (client.marginInitial || 0) / 100,
      marginMaintenance: (client.marginMaintenance || 0) / 100,
      soEquity: (client.soEquity || 0) / 100,
      soMargin: (client.soMargin || 0) / 100,
      dailyDeposit: (client.dailyDeposit || 0) / 100,
      dailyWithdrawal: (client.dailyWithdrawal || 0) / 100,
      dailyPnL: (client.dailyPnL || 0) / 100,
      thisWeekPnL: (client.thisWeekPnL || 0) / 100,
      thisMonthPnL: (client.thisMonthPnL || 0) / 100,
      lifetimePnL: (client.lifetimePnL || 0) / 100
    }
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
      stats.totalBalance += (client.balance || 0)
      stats.totalCredit += (client.credit || 0)
      stats.totalEquity += (client.equity || 0)
      stats.totalPnl += (client.pnl || 0)
      stats.totalProfit += (client.profit || 0)
      // API uses camelCase for deposit/withdrawal fields
      stats.dailyDeposit += (client.dailyDeposit || 0)
      stats.dailyWithdrawal += (client.dailyWithdrawal || 0)
      // Invert the sign by multiplying by -1 (negative becomes positive, positive becomes negative)
      stats.dailyPnL += ((client.dailyPnL || 0) * -1)
      stats.thisWeekPnL += ((client.thisWeekPnL || 0) * -1)
      stats.thisMonthPnL += ((client.thisMonthPnL || 0) * -1)
      stats.lifetimePnL += ((client.lifetimePnL || 0) * -1)
      stats.totalDeposit += (client.dailyDeposit || 0)  // Sum all daily deposits
    })
    
    return stats
  }, [])

  // Update stats incrementally based on old vs new client data (batched)
  const updateStatsIncremental = useCallback((oldClient, newClient) => {
    if (!newClient?.login) return
    
    // Check if we've already processed this exact update
    const clientLogin = newClient.login
    const lastState = lastClientStateRef.current.get(clientLogin)
    
    // Create a signature of the current state for key financial fields
    const currentSignature = `${newClient.balance || 0}_${newClient.credit || 0}_${newClient.equity || 0}_${newClient.dailyDeposit || 0}_${newClient.dailyWithdrawal || 0}_${newClient.dailyPnL || 0}_${newClient.lastUpdate || 0}`
    
    // Skip if this is a duplicate update (same signature as last processed)
    if (lastState === currentSignature) {
      return // Already processed this exact state
    }
    
    // Update the last processed signature
    lastClientStateRef.current.set(clientLogin, currentSignature)
    
    // Calculate delta (use lastState parsed values if available, otherwise use oldClient)
    const delta = {
      totalBalance: (newClient?.balance || 0) - (oldClient?.balance || 0),
      totalCredit: (newClient?.credit || 0) - (oldClient?.credit || 0),
      totalEquity: (newClient?.equity || 0) - (oldClient?.equity || 0),
      totalPnl: (newClient?.pnl || 0) - (oldClient?.pnl || 0),
      totalProfit: (newClient?.profit || 0) - (oldClient?.profit || 0),
      // API uses camelCase for deposit/withdrawal fields
      dailyDeposit: ((newClient?.dailyDeposit || 0) - (oldClient?.dailyDeposit || 0)),
      dailyWithdrawal: ((newClient?.dailyWithdrawal || 0) - (oldClient?.dailyWithdrawal || 0)),
      // Invert the sign for PnL deltas by multiplying by -1
      dailyPnL: ((newClient?.dailyPnL || 0) * -1) - ((oldClient?.dailyPnL || 0) * -1),
      thisWeekPnL: ((newClient?.thisWeekPnL || 0) * -1) - ((oldClient?.thisWeekPnL || 0) * -1),
      thisMonthPnL: ((newClient?.thisMonthPnL || 0) * -1) - ((oldClient?.thisMonthPnL || 0) * -1),
      lifetimePnL: ((newClient?.lifetimePnL || 0) * -1) - ((oldClient?.lifetimePnL || 0) * -1),
      totalDeposit: ((newClient?.dailyDeposit || 0) - (oldClient?.dailyDeposit || 0))
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
    
    // Schedule batch update (debounced to 1 second)
    if (!batch.pending) {
      batch.pending = true
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
      }, 1000) // Update stats every 1 second instead of on every message
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
      const response = await brokerAPI.getClients()
      const rawData = response.data?.clients || []
      
      // Normalize USC currency values (divide by 100)
      const normalizedData = rawData.map(client => {
        if (client && client.currency && client.currency.toLowerCase() === 'usc') {
          return {
            ...client,
            balance: (client.balance || 0) / 100,
            credit: (client.credit || 0) / 100,
            equity: (client.equity || 0) / 100,
            margin: (client.margin || 0) / 100,
            marginFree: (client.marginFree || 0) / 100,
            profit: (client.profit || 0) / 100,
            floating: (client.floating || 0) / 100,
            pnl: (client.pnl || 0) / 100,
            assets: (client.assets || 0) / 100,
            liabilities: (client.liabilities || 0) / 100,
            blockedCommission: (client.blockedCommission || 0) / 100,
            blockedProfit: (client.blockedProfit || 0) / 100,
            storage: (client.storage || 0) / 100,
            marginInitial: (client.marginInitial || 0) / 100,
            marginMaintenance: (client.marginMaintenance || 0) / 100,
            soEquity: (client.soEquity || 0) / 100,
            soMargin: (client.soMargin || 0) / 100,
            dailyDeposit: (client.dailyDeposit || 0) / 100,
            dailyWithdrawal: (client.dailyWithdrawal || 0) / 100,
            dailyPnL: (client.dailyPnL || 0) / 100,
            thisWeekPnL: (client.thisWeekPnL || 0) / 100,
            thisMonthPnL: (client.thisMonthPnL || 0) / 100,
            lifetimePnL: (client.lifetimePnL || 0) / 100
          }
        }
        return client
      })
      
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
      return data
    } catch (error) {
      console.error('[DataContext] Failed to fetch clients:', error)
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
      const response = await brokerAPI.getPositions()
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
  }, [positions, isAuthenticated])

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
      const response = await brokerAPI.getOrders()
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
  }, [orders, isAuthenticated])

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
      const response = await brokerAPI.getClients()
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
  }, [accounts, isAuthenticated])

  // Setup WebSocket subscriptions
  useEffect(() => {
    // Connect WebSocket
    if (isAuthenticated) { websocketService.connect() }

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
          
          setClients(newClients)
          setAccounts(newClients) // Update accounts too (same data)
          setLastFetch(prev => ({ ...prev, clients: Date.now(), accounts: Date.now() }))
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
      
      const startTime = performance.now()
      const batchSize = pendingUpdates.size
      const updates = Array.from(pendingUpdates.values())
      pendingUpdates.clear()
      
      totalProcessed += batchSize
      
      // Find the most recent timestamp in this batch
      let batchMaxTimestamp = 0
      for (let i = 0; i < updates.length; i++) {
        const ts = updates[i].updatedAccount?.serverTimestamp || 0
        if (ts > batchMaxTimestamp) batchMaxTimestamp = ts
      }
      
      if (batchMaxTimestamp > lastBatchTimestamp) {
        lastBatchTimestamp = batchMaxTimestamp
        setLatestServerTimestamp(batchMaxTimestamp)
      }
      
      // Log batch processing with timing
      if (batchSize > 200 || totalProcessed % 1000 === 0) {
        const latency = batchMaxTimestamp > 0 ? Math.floor((Date.now() - batchMaxTimestamp) / 1000) : 0
        const processingTime = Math.round(performance.now() - startTime)
        console.log(`[DataContext] 📦 ${batchSize} updates in ${processingTime}ms (Total: ${totalProcessed}, Lag: ${latency}s)`)
      }
      
      // OPTIMIZED: Single state update for clients with index map
      setClients(prev => {
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
          } else {
            // Update existing - use cached original value for accurate delta
            const oldClient = originalValues.get(accountLogin)
            updateStatsIncremental(oldClient, updatedAccount)
            updated[index] = { ...updated[index], ...updatedAccount }
          }
        }
        
        if (hasNewClients) {
          setClientStats(s => ({ ...s, totalClients: updated.length }))
        }
        
        return updated
      })
      
      // OPTIMIZED: Single state update for accounts with index map
      setAccounts(prev => {
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
            // Update existing - O(1) access
            updated[index] = { ...updated[index], ...updatedAccount }
          }
        }
        
        return updated
      })
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
        
        // AGGRESSIVE: Process immediately when batch is large (>500), otherwise debounce
        if (pendingUpdates.size > 500) {
          if (batchTimer) clearTimeout(batchTimer)
          processBatch()
        } else {
          // Small batches: debounce for 30ms
          if (batchTimer) clearTimeout(batchTimer)
          batchTimer = setTimeout(processBatch, 30)
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
            const exists = prev.some(c => c.login === userLogin)
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
            const exists = prev.some(c => c.login === userLogin)
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
              return [normalizedUser, ...dedupedPrev]
            }
            // Update existing user - store old client for stats update
            oldClient = dedupedPrev[index]
            const updated = [...dedupedPrev]
            updated[index] = { ...updated[index], ...normalizedUser }
            return updated
          })
          
          // Update stats incrementally based on the change
          updateStatsIncremental(oldClient, normalizedUser)
          
          setAccounts(prev => {
            const index = prev.findIndex(c => c && c.login === userLogin)
            if (index === -1) return [normalizedUser, ...prev]
            const updated = [...prev]
            updated[index] = { ...updated[index], ...normalizedUser }
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
          setPositions(newPositions)
          setLastFetch(prev => ({ ...prev, positions: Date.now() }))
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
          setPositions(prev => {
            // Check if position already exists
            const exists = prev.some(p => (p.position || p.id) === posId)
            if (exists) {
              console.log('[DataContext] ⚠️ Position already exists, skipping add:', posId)
              return prev
            }
            return [position, ...prev]
          })
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
          setPositions(prev => {
            const index = prev.findIndex(p => (p.position || p.id) === posId)
            if (index === -1) {
              // Position doesn't exist, add it
              console.log('[DataContext] ⚠️ Position not found, adding it:', posId)
              return [updatedPos, ...prev]
            }
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedPos }
            return updated
          })
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
          setPositions(prev => {
            const exists = prev.some(p => (p.position || p.id) === posId)
            if (exists) return prev
            return [position, ...prev]
          })
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
          setPositions(prev => {
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
          })
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
          setPositions(prev => {
            const newPositions = prev.filter(p => (p.position || p.id) !== posId)
            if (newPositions.length === prev.length) {
              console.log('[DataContext] ⚠️ Position not found for closure:', posId)
              return prev // Return same reference
            }
            console.log('[DataContext] ✅ Position closed. Count:', prev.length, '→', newPositions.length)
            return newPositions
          })
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
          setPositions(prev => {
            const newPositions = prev.filter(p => (p.position || p.id) !== posId)
            if (newPositions.length === prev.length) return prev
            console.log('[DataContext] ✅ Position removed. Count:', prev.length, '→', newPositions.length)
            return newPositions
          })
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
          setOrders(newOrders)
          setLastFetch(prev => ({ ...prev, orders: Date.now() }))
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
          setOrders(prev => {
            // Check if order already exists
            const orderId = order.order || order.ticket || order.id
            if (prev.some(o => (o.order || o.ticket || o.id) === orderId)) {
              return prev
            }
            return [order, ...prev]
          })
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
          setOrders(prev => {
            const index = prev.findIndex(o => (o.order || o.ticket || o.id) === orderId)
            if (index === -1) {
              return [updatedOrder, ...prev]
            }
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedOrder }
            return updated
          })
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
          setOrders(prev => prev.filter(o => (o.order || o.ticket || o.id) !== orderId))
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
  }, [isAuthenticated])

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
          fetchClients(true),
          fetchPositions(true),
          fetchOrders(true),
          fetchAccounts(true)
        ])
      } catch (error) {
        console.error('[DataContext] Initial sync error:', error)
      }
    }
    
    initialSync()
  }, [isAuthenticated])

  const value = {
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
    setAccounts
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
