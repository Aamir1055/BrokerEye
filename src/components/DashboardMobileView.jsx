import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

export default function DashboardMobileView({ 
  faceCardTotals, 
  getFaceCardConfig, 
  faceCardOrder, 
  topIBCommissions, 
  ibCommissionsLoading,
  topProfitableClients,
  recentPositions,
  connectionState,
  clientsCount,
  positionsCount,
  ordersCount
}) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [showViewAll, setShowViewAll] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
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

  // Render face card with updated UI matching Client2Module
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
        className={`bg-white rounded-xl shadow-sm border-2 border-gray-100 p-3 ${isDraggable ? 'cursor-move' : ''} transition-all duration-100 ${dragStartLabel === card.title ? 'opacity-50 scale-95' : ''}`}
        style={{
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-xs font-medium text-gray-600 uppercase mb-1">{card.title}</div>
            <div className="flex items-baseline gap-1.5">
              {/* Triangle indicator based on value */}
              {card.simple ? null : (
                <>
                  {card.isPositive !== undefined && card.isPositive && (
                    <svg width="12" height="12" viewBox="0 0 8 8" className="flex-shrink-0">
                      <polygon points="4,0 8,8 0,8" fill="#16A34A"/>
                    </svg>
                  )}
                  {card.isPositive !== undefined && !card.isPositive && (
                    <svg width="12" height="12" viewBox="0 0 8 8" className="flex-shrink-0">
                      <polygon points="4,8 0,0 8,0" fill="#DC2626"/>
                    </svg>
                  )}
                </>
              )}
              <span className={`text-xl font-bold ${
                card.isPositive !== undefined 
                  ? (card.isPositive ? 'text-[#16A34A]' : 'text-[#DC2626]')
                  : 'text-black'
              }`}>
                {card.formattedValue || card.value || '0'}
              </span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1" stroke="#3B82F6" strokeWidth="2"/>
            </svg>
          </div>
        </div>
      </div>
    )

    return cardElement
  }

  // Main carousel (first 12 cards, NOT draggable)
  const visibleCards = getOrderedCards()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50">
      {/* Mobile Header with Sidebar Button */}
      <div className="sticky top-0 bg-white shadow-md z-30 px-4 py-5">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="#000" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-black">Dashboard</h1>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" fill="#9CA3AF"/>
              <path d="M4 20C4 16.6863 6.68629 14 10 14H14C17.3137 14 20 16.6863 20 20V20" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/25"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute left-0 top-0 h-full w-[300px] bg-white shadow-xl rounded-r-2xl flex flex-col">
            <div className="p-4 flex items-center gap-3 border-b border-[#ECECEC]">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1A63BC"/></svg>
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-semibold text-[#1A63BC]">Broker Eyes</div>
                <div className="text-[11px] text-[#7A7A7A]">Trading Platform</div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto py-2">
              <nav className="flex flex-col">
                {[
                  {label:'Dashboard', path:'/dashboard', active:true, icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#1A63BC"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#1A63BC"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#1A63BC"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#1A63BC"/></svg>
                  )},
                  {label:'Clients', path:'/client-dashboard-c', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#404040"/><circle cx="16" cy="8" r="3" stroke="#404040"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#404040"/></svg>
                  )},
                  {label:'Client 2', path:'/client2', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#404040"/><circle cx="16" cy="8" r="3" stroke="#404040"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#404040"/></svg>
                  )},
                  {label:'Positions', path:'/positions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="3" rx="1" stroke="#404040"/><rect x="3" y="11" width="18" height="3" rx="1" stroke="#404040"/><rect x="3" y="16" width="18" height="3" rx="1" stroke="#404040"/></svg>
                  )},
                  {label:'Pending Orders', path:'/pending-orders', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><circle cx="12" cy="12" r="2" fill="#404040"/></svg>
                  )},
                  {label:'Margin Level', path:'/margin-level', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 18L10 12L14 16L20 8" stroke="#404040" strokeWidth="2"/></svg>
                  )},
                  {label:'Live Dealing', path:'/live-dealing', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 18 0" stroke="#404040"/><path d="M7 12a5 5 0 0 1 10 0" stroke="#404040"/></svg>
                  )},
                  {label:'Client Percentage', path:'/client-percentage', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6" stroke="#404040"/><circle cx="8" cy="8" r="2" stroke="#404040"/><circle cx="16" cy="16" r="2" stroke="#404040"/></svg>
                  )},
                  {label:'IB Commissions', path:'/ib-commissions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><path d="M12 7v10M8 10h8" stroke="#404040"/></svg>
                  )},
                  {label:'Settings', path:'/settings', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" stroke="#404040"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2" stroke="#404040"/></svg>
                  )},
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => {
                      navigate(item.path)
                      setIsSidebarOpen(false)
                    }}
                    className={`flex items-center gap-3 px-4 h-11 text-[13px] ${item.active ? 'text-[#1A63BC] bg-[#EFF4FB] rounded-lg font-semibold' : 'text-[#404040]'}`}
                  >
                    <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 mt-auto border-t border-[#ECECEC]">
              <button 
                onClick={logout}
                className="flex items-center gap-3 px-2 h-10 text-[13px] text-[#404040]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="#404040" strokeWidth="2"/><path d="M4 12h11" stroke="#404040" strokeWidth="2"/></svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Dashboard subtitle */}
        <p className="text-sm text-gray-600 mb-4">Quick overview of your broker metrics</p>

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

      {/* Top Profitable Clients Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Top Profitable Clients</h2>
          <button
            onClick={() => navigate('/clients')}
            className="text-xs text-blue-600 font-medium hover:text-blue-700"
          >
            View All
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {topProfitableClients.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No clients data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-500 text-white">
                    <th className="px-3 py-2 text-left font-semibold">Login</th>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-right font-semibold">Lifetime P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProfitableClients.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{row[0]}</td>
                      <td className="px-3 py-2 text-gray-900">{row[1]}</td>
                      <td className="px-3 py-2 text-right">{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Largest Open Positions Table */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">Largest Open Positions</h2>
          <button
            onClick={() => navigate('/positions')}
            className="text-xs text-blue-600 font-medium hover:text-blue-700"
          >
            View All
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {recentPositions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No positions data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-blue-500 text-white">
                    <th className="px-3 py-2 text-left font-semibold">Login</th>
                    <th className="px-3 py-2 text-left font-semibold">Symbol</th>
                    <th className="px-3 py-2 text-left font-semibold">Type</th>
                    <th className="px-3 py-2 text-right font-semibold">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentPositions.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{row[0]}</td>
                      <td className="px-3 py-2 text-gray-900">{row[1]}</td>
                      <td className="px-3 py-2 text-gray-700">{row[2]}</td>
                      <td className="px-3 py-2 text-right">{row[4]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

      {/* System Status */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">System Status</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-2 ${
                connectionState === 'connected' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <div className={`w-3 h-3 rounded-full ${
                  connectionState === 'connected' ? 'bg-green-500' : 'bg-red-500'
                }`} />
              </div>
              <p className="text-xs font-medium text-gray-900">WebSocket</p>
              <p className="text-xs text-gray-500 capitalize">{connectionState}</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-2">
                <span className="text-lg font-bold text-blue-600">{clientsCount}</span>
              </div>
              <p className="text-xs font-medium text-gray-900">Total Clients</p>
              <p className="text-xs text-gray-500">Active accounts</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <span className="text-lg font-bold text-green-600">{positionsCount}</span>
              </div>
              <p className="text-xs font-medium text-gray-900">Open Positions</p>
              <p className="text-xs text-gray-500">Active trades</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-2">
                <span className="text-lg font-bold text-orange-600">{ordersCount}</span>
              </div>
              <p className="text-xs font-medium text-gray-900">Pending Orders</p>
              <p className="text-xs text-gray-500">Awaiting execution</p>
            </div>
          </div>
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
    </div>
  )
}
