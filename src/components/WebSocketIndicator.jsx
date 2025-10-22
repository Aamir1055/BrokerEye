import { useState, useEffect } from 'react'
import websocketService from '../services/websocket'

const WebSocketIndicator = () => {
  const [connectionState, setConnectionState] = useState('disconnected')
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = websocketService.onConnectionStateChange((state) => {
      setConnectionState(state)
    })

    // Update debug info every second when debug panel is open
    let interval
    if (showDebug) {
      interval = setInterval(() => {
        setDebugInfo(websocketService.getDebugInfo())
      }, 1000)
    }

    return () => {
      unsubscribe()
      if (interval) clearInterval(interval)
    }
  }, [showDebug])

  const getIndicatorColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Live'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Offline'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="relative">
      {/* Status Indicator */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        title="Click to toggle WebSocket debug info"
      >
        <div className="relative flex items-center">
          <div className={`w-2 h-2 rounded-full ${getIndicatorColor()}`}>
            {connectionState === 'connecting' && (
              <div className={`absolute inset-0 w-2 h-2 rounded-full ${getIndicatorColor()} animate-ping`}></div>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-gray-700">{getStatusText()}</span>
      </button>

      {/* Debug Panel */}
      {showDebug && debugInfo && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50 w-80">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">WebSocket Debug Info</h3>
            <button
              onClick={() => setShowDebug(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">State:</span>
              <span className={`font-semibold ${
                debugInfo.state === 'connected' ? 'text-green-600' : 
                debugInfo.state === 'connecting' ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {debugInfo.state}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Messages Received:</span>
              <span className="font-semibold text-gray-900">{debugInfo.messageCount}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Reconnect Attempts:</span>
              <span className="font-semibold text-gray-900">{debugInfo.reconnectAttempts}</span>
            </div>

            {debugInfo.subscriberCount && debugInfo.subscriberCount.length > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-gray-600 mb-1">Subscribers:</div>
                {debugInfo.subscriberCount.map((sub, idx) => (
                  <div key={idx} className="flex justify-between pl-2">
                    <span className="text-gray-500">{sub.type}:</span>
                    <span className="font-semibold text-gray-900">{sub.count}</span>
                  </div>
                ))}
              </div>
            )}

            {debugInfo.lastMessage && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-gray-600 mb-1">Last Message:</div>
                <div className="bg-gray-50 rounded p-2 overflow-auto max-h-32">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(debugInfo.lastMessage, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 italic">
              Check browser DevTools → Network → WS for more details
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default WebSocketIndicator
