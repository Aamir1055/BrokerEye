import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DashboardMobileView({ faceCardTotals, getFaceCardConfig, faceCardOrder, topIBCommissions, ibCommissionsLoading }) {
  const navigate = useNavigate()
  const [showViewAll, setShowViewAll] = useState(false)
  const [orderedCards, setOrderedCards] = useState([])
  const [dragStartLabel, setDragStartLabel] = useState(null)
  const CARD_ORDER_KEY = 'dashboard-mobile-card-order'

  // Initialize card order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CARD_ORDER_KEY)
      if (saved) {
        setOrderedCards(JSON.parse(saved))
      } else {
        // Default order - show first 12 cards
        const defaultOrder = faceCardOrder.slice(0, 12).map(id => {
          const card = getFaceCardConfig(id, faceCardTotals)
          return card ? card.title : null
        }).filter(Boolean)
        setOrderedCards(defaultOrder)
        localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(defaultOrder))
      }
    } catch (err) {
      console.error('Failed to load card order:', err)
      const defaultOrder = faceCardOrder.slice(0, 12).map(id => {
        const card = getFaceCardConfig(id, faceCardTotals)
        return card ? card.title : null
      }).filter(Boolean)
      setOrderedCards(defaultOrder)
    }
  }, [faceCardOrder, faceCardTotals, getFaceCardConfig])

  // Get cards in order
  const getOrderedCards = () => {
    return orderedCards.map(title => {
      // Find card by title
      const cardId = faceCardOrder.find(id => {
        const card = getFaceCardConfig(id, faceCardTotals)
        return card && card.title === title
      })
      if (!cardId) return null
      return getFaceCardConfig(cardId, faceCardTotals)
    }).filter(Boolean)
  }

  // Render face card
  const renderFaceCard = (card, isDraggable = false) => {
    const cardElement = (
      <div
        key={card.id}
        data-card-label={card.title}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => {
          setDragStartLabel(card.title)
          e.dataTransfer.effectAllowed = 'move'
        } : undefined}
        onDragEnd={isDraggable ? () => setDragStartLabel(null) : undefined}
        onDragOver={isDraggable ? (e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
        } : undefined}
        onDrop={isDraggable ? (e) => {
          e.preventDefault()
          const fromLabel = dragStartLabel
          const toLabel = card.title
          
          if (fromLabel && toLabel && fromLabel !== toLabel) {
            const newOrder = [...orderedCards]
            const fromIndex = newOrder.indexOf(fromLabel)
            const toIndex = newOrder.indexOf(toLabel)
            
            if (fromIndex !== -1 && toIndex !== -1) {
              // Swap
              [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]]
              setOrderedCards(newOrder)
              localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(newOrder))
            }
          }
          setDragStartLabel(null)
        } : undefined}
        className={`bg-white rounded-lg shadow-sm border-2 ${card.borderColor || 'border-gray-200'} p-3 ${isDraggable ? 'cursor-move' : ''} transition-all duration-100 ${dragStartLabel === card.title ? 'opacity-50 scale-95' : ''}`}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        {/* Simple cards */}
        {card.simple && (
          <>
            <p className={`text-[10px] font-semibold ${card.textColor} uppercase tracking-wide mb-1.5`}>{card.title}</p>
            <p className={`text-base font-bold ${card.valueColor || 'text-gray-900'}`}>{card.value}</p>
          </>
        )}

        {/* Cards with icon (PNL, Floating Profit) */}
        {card.withIcon && (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <p className={`text-[10px] font-semibold ${card.isPositive ? 'text-green-600' : 'text-red-600'} uppercase tracking-wide`}>{card.title}</p>
              <div className={`w-7 h-7 ${card.isPositive ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'} rounded-lg flex items-center justify-center`}>
                <svg className={`w-3.5 h-3.5 ${card.isPositive ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  {card.isPositive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  )}
                </svg>
              </div>
            </div>
            <p className={`text-base font-bold ${card.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {card.isPositive ? '▲ ' : '▼ '}
              {card.isPositive ? '' : '-'}
              {card.formattedValue}
            </p>
          </>
        )}

        {/* Cards with arrow (PnL cards) */}
        {card.withArrow && (
          <>
            <p className={`text-[10px] font-semibold ${card.textColor} uppercase tracking-wide mb-1.5`}>{card.title}</p>
            <p className={`text-base font-bold ${card.valueColor}`}>
              {card.isPositive ? '▲ ' : '▼ '}
              {card.isPositive ? '' : '-'}
              {card.formattedValue}
            </p>
          </>
        )}
      </div>
    )

    return cardElement
  }

  // Main carousel (first 12 cards, NOT draggable)
  const visibleCards = getOrderedCards()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600 mt-1">Quick overview of your broker metrics</p>
      </div>

      {/* Face Cards Carousel */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Key Metrics</h2>
          <button
            onClick={() => setShowViewAll(true)}
            className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1"
          >
            View All
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        <div
          className="grid grid-cols-2 gap-3 overflow-hidden"
          style={{ touchAction: 'pan-y' }}
        >
          {visibleCards.map(card => renderFaceCard(card, false))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/clients')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 shadow-sm text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-xs font-semibold">Clients</p>
            </div>
            <p className="text-[10px] opacity-90">Manage accounts</p>
          </button>

          <button
            onClick={() => navigate('/positions')}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg p-4 shadow-sm text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-xs font-semibold">Positions</p>
            </div>
            <p className="text-[10px] opacity-90">Open positions</p>
          </button>

          <button
            onClick={() => navigate('/pending-orders')}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg p-4 shadow-sm text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="text-xs font-semibold">Orders</p>
            </div>
            <p className="text-[10px] opacity-90">Pending orders</p>
          </button>

          <button
            onClick={() => navigate('/live-dealing')}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg p-4 shadow-sm text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-xs font-semibold">Live Dealing</p>
            </div>
            <p className="text-[10px] opacity-90">Real-time trades</p>
          </button>
        </div>
      </div>

      {/* Top IB Commissions Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Top IB Commissions</h2>
          <button
            onClick={() => navigate('/ib-commissions')}
            className="text-xs text-blue-600 font-medium hover:text-blue-700"
          >
            View All
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {ibCommissionsLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500 mt-2">Loading...</p>
            </div>
          ) : topIBCommissions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No IB commission data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-500 text-white">
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-right font-semibold">%</th>
                    <th className="px-3 py-2 text-right font-semibold">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topIBCommissions.slice(0, 5).map((ib, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{ib.name || '-'}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{parseFloat(ib.percentage || 0).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-green-600 font-semibold">${formatNum(ib.available_commission || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* View All Modal */}
      {showViewAll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">All Metrics</h3>
              <button
                onClick={() => setShowViewAll(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3">
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  Drag cards to reorder
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {getOrderedCards().map(card => renderFaceCard(card, true))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
