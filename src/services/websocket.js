// WebSocket service for real-time broker data updates

class WebSocketService {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 10
    this.reconnectDelay = 3000 // 3 seconds
    this.listeners = new Map()
    this.connectionState = 'disconnected' // disconnected, connecting, connected
    this.stateListeners = []
    this.lastMessage = null
    this.messageCount = 0
  }

  // Get WebSocket URL with token
  getWebSocketUrl() {
    const token = localStorage.getItem('access_token')
    if (!token) {
      return null
    }
    // Use same host as current page for WebSocket (works with proxy)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    return `${protocol}//${host}/api/broker/ws?token=${token}`
  }

  // Connect to WebSocket
  connect() {
    const url = this.getWebSocketUrl()
    if (!url) {
      console.error('Cannot connect: No valid WebSocket URL')
      return
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected or connecting')
      return
    }

    this.setConnectionState('connecting')

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.setConnectionState('connected')
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.lastMessage = data
          this.messageCount++

          // Notify all listeners subscribed to this message type
          const listeners = this.listeners.get(data.type) || []
          listeners.forEach(callback => {
            try {
              callback(data)
            } catch (error) {
              console.error('Error in WebSocket listener:', error)
            }
          })

          // Also notify 'all' listeners
          const allListeners = this.listeners.get('all') || []
          allListeners.forEach(callback => {
            try {
              callback(data)
            } catch (error) {
              console.error('Error in WebSocket all listener:', error)
            }
          })
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error, event.data)
        }
      }

      this.ws.onerror = (error) => {
        // Silent error handling
      }

      this.ws.onclose = (event) => {
        this.setConnectionState('disconnected')
        this.attemptReconnect()
      }
    } catch (error) {
      this.setConnectionState('disconnected')
      this.attemptReconnect()
    }
  }

  // Attempt to reconnect
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts

    setTimeout(() => {
      this.connect()
    }, delay)
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.setConnectionState('disconnected')
  }

  // Subscribe to WebSocket messages
  subscribe(messageType, callback) {
    if (!this.listeners.has(messageType)) {
      this.listeners.set(messageType, [])
    }
    this.listeners.get(messageType).push(callback)

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(messageType)
      if (listeners) {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    }
  }

  // Subscribe to connection state changes
  onConnectionStateChange(callback) {
    this.stateListeners.push(callback)
    // Immediately notify of current state
    callback(this.connectionState)

    // Return unsubscribe function
    return () => {
      const index = this.stateListeners.indexOf(callback)
      if (index > -1) {
        this.stateListeners.splice(index, 1)
      }
    }
  }

  // Set connection state and notify listeners
  setConnectionState(state) {
    this.connectionState = state
    this.stateListeners.forEach(callback => {
      try {
        callback(state)
      } catch (error) {
        console.error('Error in state listener:', error)
      }
    })
  }

  // Get current connection state
  getConnectionState() {
    return this.connectionState
  }

  // Get debug info
  getDebugInfo() {
    return {
      state: this.connectionState,
      reconnectAttempts: this.reconnectAttempts,
      messageCount: this.messageCount,
      lastMessage: this.lastMessage,
      subscriberCount: Array.from(this.listeners.entries()).map(([type, listeners]) => ({
        type,
        count: listeners.length
      }))
    }
  }

  // Send message (if needed)
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService()

export default websocketService
