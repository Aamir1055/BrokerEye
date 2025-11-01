import { createContext, useContext, useState, useEffect, useCallback } from 'react'
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

  // Check if data is stale
  const isStale = (key) => {
    if (!lastFetch[key]) return true
    return Date.now() - lastFetch[key] > CACHE_DURATION
  }

  // Fetch clients data
  const fetchClients = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      console.log('[DataContext] Not authenticated, skipping fetchClients')
      return []
    }
    
    if (!force && clients.length > 0 && !isStale('clients')) {
      return clients
    }

    setLoading(prev => ({ ...prev, clients: true }))
    
    try {
      const response = await brokerAPI.getClients()
      const data = response.data?.clients || []
      setClients(data)
      setLastFetch(prev => ({ ...prev, clients: Date.now() }))
      return data
    } catch (error) {
      console.error('[DataContext] Failed to fetch clients:', error)
      throw error
    } finally {
      setLoading(prev => ({ ...prev, clients: false }))
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

    // Debug: Log all unique event types (only once per type)
    const seenEvents = new Set()
    const unsubDebug = websocketService.subscribe('all', (message) => {
      const eventType = message.event || message.type
      if (eventType && !seenEvents.has(eventType) && eventType !== 'ACCOUNT_UPDATED') {
        seenEvents.add(eventType)
        console.log('[DataContext] 🔔 New WebSocket event type detected:', eventType, message)
      }
      // Also check for USER_ADDED specifically
      if (eventType === 'USER_ADDED') {
        console.log('[DataContext] ‼️ USER_ADDED EVENT CAPTURED:', message)
      }
    })

    // Subscribe to clients updates
    const unsubClients = websocketService.subscribe('clients', (data) => {
      try {
        const newClients = data.data?.clients || data.clients
        if (newClients && Array.isArray(newClients)) {
          setClients(newClients)
          setAccounts(newClients) // Update accounts too (same data)
          setLastFetch(prev => ({ ...prev, clients: Date.now(), accounts: Date.now() }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing clients update:', error)
      }
    })

    // Subscribe to ACCOUNT_UPDATED for individual updates
    const unsubAccountUpdate = websocketService.subscribe('ACCOUNT_UPDATED', (message) => {
      try {
        const updatedAccount = message.data
        const accountLogin = message.login || updatedAccount?.login
        
        // Only log occasionally to avoid console spam
        if (Math.random() < 0.05) {
          console.log('[DataContext] 📊 ACCOUNT_UPDATED sample:', accountLogin, updatedAccount)
        }
        
        if (updatedAccount && accountLogin) {
          setClients(prev => {
            const index = prev.findIndex(c => c.login === accountLogin)
            if (index === -1) {
              console.log('[DataContext] 🆕 NEW CLIENT DETECTED via ACCOUNT_UPDATED:', accountLogin, 'Total clients before:', prev.length)
              return [...prev, updatedAccount]
            }
            // Don't log every update - too noisy
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedAccount }
            return updated
          })
          
          setAccounts(prev => {
            const index = prev.findIndex(c => c.login === accountLogin)
            if (index === -1) {
              console.log('[DataContext] 🆕 NEW ACCOUNT added to accounts array:', accountLogin)
              return [...prev, updatedAccount]
            }
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedAccount }
            return updated
          })
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
          setClients(prev => {
            const exists = prev.some(c => c.login === userLogin)
            if (exists) {
              console.log('[DataContext] ⚠️ User already exists, skipping add:', userLogin)
              return prev
            }
            console.log('[DataContext] ➕ Adding NEW user to clients:', userLogin)
            return [newUser, ...prev]
          })
          
          setAccounts(prev => {
            const exists = prev.some(c => c.login === userLogin)
            if (exists) return prev
            return [newUser, ...prev]
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
        
        console.log('[DataContext] 👤 USER_UPDATED:', userLogin, updatedUser)
        
        if (updatedUser && userLogin) {
          setClients(prev => {
            const index = prev.findIndex(c => c.login === userLogin)
            if (index === -1) {
              console.log('[DataContext] ➕ User not found, adding as new:', userLogin)
              return [updatedUser, ...prev]
            }
            console.log('[DataContext] ✏️ Updating existing user:', userLogin)
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedUser }
            return updated
          })
          
          setAccounts(prev => {
            const index = prev.findIndex(c => c.login === userLogin)
            if (index === -1) return [updatedUser, ...prev]
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedUser }
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
          setClients(prev => {
            const filtered = prev.filter(c => c.login !== userLogin)
            if (filtered.length < prev.length) {
              console.log('[DataContext] ➖ Removed user from clients:', userLogin)
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
