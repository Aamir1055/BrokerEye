import { useState, useEffect } from 'react'
import websocketService from '../services/websocket'
import { useData } from '../contexts/DataContext'

const WebSocketIndicator = () => {
  const [connectionState, setConnectionState] = useState('disconnected')
  const [showDebug, setShowDebug] = useState(false)
  const [debugInfo, setDebugInfo] = useState(null)
  const [showPerf, setShowPerf] = useState(false)
  const { latestMeasuredLagMs, perf } = useData() || {}

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
        return 'bg-orange-500'
      case 'error':
        return 'bg-red-500'
      case 'failed':
        return 'bg-red-700'
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
        return 'Polling'
      case 'error':
        return 'Error'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="relative">
      {/* Status Indicator */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-500 transition-all shadow-sm text-sm font-semibold text-gray-700 h-9"
        title="Click to toggle WebSocket debug info"
      >
        <div className="relative flex items-center">
          <div className={`w-2 h-2 rounded-full ${getIndicatorColor()}`}>
            {connectionState === 'connecting' && (
              <div className={`absolute inset-0 w-2 h-2 rounded-full ${getIndicatorColor()} animate-ping`}></div>
            )}
          </div>
        </div>
        <span>{getStatusText()}</span>
        {latestMeasuredLagMs != null && (
          <span className="ml-1 text-xs font-medium text-gray-500" title="Approximate lag between server timestamp and receipt">
            {Math.round(latestMeasuredLagMs/1000)}s lag
          </span>
        )}
      </button>

      {/* Debug Panel */}
      {showDebug && debugInfo && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg p-3 w-80" style={{ zIndex: 99999999 }}>
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

          <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-500 italic">DevTools → Network → WS</p>
            <button
              onClick={() => setShowPerf(p => !p)}
              className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
            >{showPerf ? 'Hide Perf' : 'Show Perf'}</button>
          </div>

          {showPerf && perf && (
            <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Queue Size:</span>
                <span className="font-semibold text-gray-900">{perf.pendingUpdatesSize}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Last Batch Age:</span>
                <span className="font-semibold text-gray-900">{perf.lastBatchAgeMs}ms</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Process Time:</span>
                <span className="font-semibold text-gray-900">{perf.lastBatchProcessMs}ms</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total Updates:</span>
                <span className="font-semibold text-gray-900">{perf.totalProcessedUpdates}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Last Flush:</span>
                <span className="font-semibold text-gray-900">{perf.lastFlushAt ? new Date(perf.lastFlushAt).toLocaleTimeString() : '—'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default WebSocketIndicator
