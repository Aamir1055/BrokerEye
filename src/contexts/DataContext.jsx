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
        
        if (updatedAccount && accountLogin) {
          setClients(prev => {
            const index = prev.findIndex(c => c.login === accountLogin)
            if (index === -1) return [...prev, updatedAccount]
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedAccount }
            return updated
          })
          
          setAccounts(prev => {
            const index = prev.findIndex(c => c.login === accountLogin)
            if (index === -1) return [...prev, updatedAccount]
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedAccount }
            return updated
          })
        }
      } catch (error) {
        console.error('[DataContext] Error processing ACCOUNT_UPDATED:', error)
      }
    })

    // Subscribe to positions updates
    const unsubPositions = websocketService.subscribe('positions', (data) => {
      try {
        const newPositions = data.data?.positions || data.positions
        if (newPositions && Array.isArray(newPositions)) {
          setPositions(newPositions)
          setLastFetch(prev => ({ ...prev, positions: Date.now() }))
        }
      } catch (error) {
        console.error('[DataContext] Error processing positions update:', error)
      }
    })

    // Subscribe to POSITION_ADDED
    const unsubPosAdded = websocketService.subscribe('POSITION_ADDED', (message) => {
      try {
        const position = message.data || message
        if (position) {
          setPositions(prev => [position, ...prev])
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_ADDED:', error)
      }
    })

    // Subscribe to POSITION_UPDATED
    const unsubPosUpdated = websocketService.subscribe('POSITION_UPDATED', (message) => {
      try {
        const updatedPos = message.data || message
        const posId = updatedPos?.position || updatedPos?.id
        
        if (posId) {
          setPositions(prev => {
            const index = prev.findIndex(p => (p.position || p.id) === posId)
            if (index === -1) return prev
            const updated = [...prev]
            updated[index] = { ...updated[index], ...updatedPos }
            return updated
          })
        }
      } catch (error) {
        console.error('[DataContext] Error processing POSITION_UPDATED:', error)
      }
    })

    // Subscribe to POSITION_DELETED
    const unsubPosDeleted = websocketService.subscribe('POSITION_DELETED', (message) => {
      try {
        const posId = message.position || message.data?.position || message.id
        if (posId) {
          setPositions(prev => prev.filter(p => (p.position || p.id) !== posId))
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
      unsubState()
      unsubClients()
      unsubAccountUpdate()
      unsubPositions()
      unsubPosAdded()
      unsubPosUpdated()
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
