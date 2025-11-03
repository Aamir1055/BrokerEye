import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'

const Sidebar = ({ isOpen, onClose, marginLevelCount = 0 }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()
  const [storedMarginCount, setStoredMarginCount] = useState(0)

  // Read margin count from localStorage on mount and listen for changes
  useEffect(() => {
    const updateCount = () => {
      const count = parseInt(localStorage.getItem('marginLevelCount') || '0', 10)
      setStoredMarginCount(count)
    }
    
    // Initial load
    updateCount()
    
    // Listen for changes
    window.addEventListener('marginLevelCountChanged', updateCount)
    window.addEventListener('storage', updateCount)
    
    return () => {
      window.removeEventListener('marginLevelCountChanged', updateCount)
      window.removeEventListener('storage', updateCount)
    }
  }, [])

  // Use either passed prop or stored count (stored count takes priority for cross-page visibility)
  const displayCount = storedMarginCount || marginLevelCount
  
  const navigationItems = [
    { name: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { name: 'Clients', path: '/clients', icon: 'clients' },
    { name: 'Positions', path: '/positions', icon: 'positions' },
    { name: 'Pending Orders', path: '/pending-orders', icon: 'orders' },
    { name: 'Margin Level', path: '/margin-level', icon: 'margin' },
    { name: 'Live Dealing', path: '/live-dealing', icon: 'live-dealing' },
    { name: 'Client Percentage', path: '/client-percentage', icon: 'percentage' },
    { name: 'Settings', path: '/settings', icon: 'settings' }
  ]
  
  const handleNavigate = (path) => {
    navigate(path)
    if (typeof onClose === 'function') {
      onClose() // Close sidebar on mobile after navigation
    }
  }
  
  const isActivePath = (path) => {
    return location.pathname === path || (path === '/dashboard' && location.pathname === '/')
  }

  const handleLogout = async () => {
    await logout()
    if (typeof onClose === 'function') {
      onClose()
    }
  }
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => typeof onClose === 'function' && onClose()}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 lg:z-auto
          w-64 lg:w-60 bg-white border-r border-gray-200 shadow-lg lg:shadow-none
          transform lg:transform-none transition-transform duration-300 ease-in-out
          flex flex-col h-screen
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 lg:bg-white lg:from-transparent lg:to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white bg-opacity-20 lg:bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white lg:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white lg:text-gray-900">Broker Eyes</span>
          </div>
          <button
            onClick={() => typeof onClose === 'function' && onClose()}
            className="lg:hidden text-white hover:bg-white hover:bg-opacity-10 p-2 rounded transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 p-3 pt-4 overflow-y-auto">
          <nav className="space-y-1">
            {navigationItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`w-full text-left flex items-center px-3 py-2 rounded-md text-sm transition-all ${
                  isActivePath(item.path)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon === 'dashboard' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0" />
                  </svg>
                )}
                {item.icon === 'clients' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )}
                {item.icon === 'positions' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18M3 9h18M3 15h18M3 21h18" />
                  </svg>
                )}
                {item.icon === 'orders' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-9 4h9M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                  </svg>
                )}
                {item.icon === 'margin' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18M3 21h18M5 7h14M5 17h14M8 10h8M8 14h8" />
                  </svg>
                )}
                {item.icon === 'live-dealing' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {item.icon === 'percentage' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                {item.icon === 'settings' && (
                  <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <span className="flex-1">{item.name}</span>
                {item.icon === 'margin' && displayCount > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {displayCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Logout Button at Bottom */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-md transition-all"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar