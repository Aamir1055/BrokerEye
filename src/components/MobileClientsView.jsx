import { useState, useEffect } from 'react'
import CustomizeViewModal from './CustomizeViewModal'
import IBFilterModal from './IBFilterModal'
import LoginGroupsModal from './LoginGroupsModal'

const MobileClientsView = ({ clients, onClientClick }) => {
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [showIBFilterModal, setShowIBFilterModal] = useState(false)
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [currentTime, setCurrentTime] = useState('9:41')

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const ampm = hours >= 12 ? 'PM' : 'AM'
      const displayHours = hours % 12 || 12
      setCurrentTime(`${displayHours}:${minutes.toString().padStart(2, '0')}`)
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Filter clients based on search
  const filteredClients = clients.filter(client => 
    client.login?.toString().includes(searchQuery) ||
    client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Face cards data - calculate totals
  const calculateTotals = () => {
    if (!filteredClients || filteredClients.length === 0) {
      return {
        monthlyEquity: 0,
        lifetimeBonusOut: 0,
        dailyPnl: 0,
        weeklyPnl: 0
      }
    }

    return {
      monthlyEquity: filteredClients.reduce((sum, c) => sum + (parseFloat(c.equity) || 0), 0),
      lifetimeBonusOut: filteredClients.reduce((sum, c) => sum + (parseFloat(c.bonus) || 0), 0),
      dailyPnl: filteredClients.reduce((sum, c) => sum + (parseFloat(c.daily_pnl) || 0), 0),
      weeklyPnl: filteredClients.reduce((sum, c) => sum + (parseFloat(c.weekly_pnl) || 0), 0)
    }
  }

  const totals = calculateTotals()

  const faceCards = [
    { 
      label: 'MONTHLY EQUITY', 
      value: totals.monthlyEquity.toFixed(2), 
      currency: 'USD',
      color: 'text-green-500',
      icon: '⏰'
    },
    { 
      label: 'LIFETIME BONUS OUT', 
      value: totals.lifetimeBonusOut.toFixed(2), 
      currency: 'USD',
      color: 'text-gray-400',
      icon: '📅'
    },
    { 
      label: 'DAILY PNL', 
      value: totals.dailyPnl.toFixed(2), 
      currency: 'USD',
      color: 'text-gray-900',
      icon: '🎂'
    },
    { 
      label: 'WEEKLY PNL', 
      value: totals.weeklyPnl.toFixed(2), 
      currency: 'USD',
      color: 'text-gray-900',
      icon: '💰'
    }
  ]

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const displayedClients = filteredClients.slice(startIndex, endIndex)

  return (
    <div style={{
      width: '100%',
      maxWidth: '412px',
      height: '100vh',
      margin: '0 auto',
      background: '#F4F4F4',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Outfit, sans-serif'
    }}>
      {/* Status Bar */}
      <div style={{
        position: 'absolute',
        width: '372px',
        height: '22px',
        left: '20px',
        top: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          fontFamily: 'Outfit',
          fontWeight: 600,
          fontSize: '17px',
          lineHeight: '22px',
          color: '#4B4B4B'
        }}>{currentTime}</span>
        
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          {/* Cellular */}
          <div style={{ width: '19.2px', height: '12.23px', background: '#4B4B4B' }} />
          {/* WiFi */}
          <div style={{ width: '17.14px', height: '12.33px', background: '#4B4B4B' }} />
          {/* Battery */}
          <div style={{ position: 'relative', width: '27.33px', height: '13px' }}>
            <div style={{
              width: '25px',
              height: '13px',
              border: '1px solid #4B4B4B',
              borderRadius: '4.3px',
              opacity: 0.35
            }} />
            <div style={{
              position: 'absolute',
              width: '21px',
              height: '9px',
              left: '2px',
              top: '2px',
              background: '#4B4B4B',
              borderRadius: '2.5px'
            }} />
            <div style={{
              position: 'absolute',
              width: '1.33px',
              height: '4px',
              right: '-1.5px',
              top: '4.5px',
              background: '#4B4B4B',
              opacity: 0.4,
              borderRadius: '0 2px 2px 0'
            }} />
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{
        position: 'absolute',
        width: '372px',
        height: '36px',
        left: '20px',
        top: '62px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setShowCustomizeModal(true)}
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(230, 238, 248, 0.44)',
            boxShadow: 'inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
            borderRadius: '8px',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect y="3.75" width="20" height="2.5" rx="1.25" fill="#999999"/>
            <rect y="8.75" width="20" height="2.5" rx="1.25" fill="#999999"/>
            <rect y="13.75" width="20" height="2.5" rx="1.25" fill="#999999"/>
          </svg>
        </button>
        
        <h1 style={{
          fontFamily: 'Outfit',
          fontWeight: 600,
          fontSize: '20px',
          lineHeight: '17px',
          color: '#4B4B4B',
          margin: 0
        }}>Clients</h1>
        
        <div style={{
          width: '36px',
          height: '36px',
          background: '#C4C4C4',
          borderRadius: '50%',
          boxShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)'
        }} />
      </div>

      {/* View All + Action Buttons */}
      <div style={{
        position: 'absolute',
        width: '372px',
        height: '24px',
        left: '20px',
        top: '138px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button style={{
          fontFamily: 'Outfit',
          fontWeight: 600,
          fontSize: '12px',
          color: '#2563EB',
          background: 'none',
          border: 'none',
          cursor: 'pointer'
        }}>View All</button>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{
            width: '24px',
            height: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M16 16L12 12L16 8" stroke="#999999" strokeWidth="1.5"/>
            </svg>
          </button>
          <button style={{
            width: '24px',
            height: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="#999999" strokeWidth="1.5"/>
            </svg>
          </button>
          <button 
            onClick={() => setShowCustomizeModal(true)}
            style={{
              width: '24px',
              height: '24px',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
              <rect x="11" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
              <rect x="18" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Face Cards Carousel */}
      <div style={{
        position: 'absolute',
        width: '392px',
        height: '82px',
        left: '20px',
        top: '172px',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {faceCards.map((card, index) => (
          <div 
            key={index}
            style={{
              minWidth: '176px',
              height: '82px',
              background: '#FFFFFF',
              border: '1px solid #F2F2F7',
              boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05)',
              borderRadius: '8px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'Outfit',
                fontWeight: 400,
                fontSize: '10px',
                lineHeight: '13px',
                textTransform: 'uppercase',
                color: index === 0 ? '#333333' : index === 1 ? '#475467' : '#333333'
              }}>{card.label}</span>
              <div style={{ width: '12px', height: '12px', background: '#2563EB', borderRadius: '2px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                fontFamily: 'Outfit',
                fontWeight: 700,
                fontSize: '18px',
                lineHeight: '20px',
                textTransform: 'uppercase',
                color: index === 0 ? '#34C759' : index === 1 ? '#999999' : '#333333'
              }}>
                {card.value}
              </span>
              <span style={{
                fontFamily: 'Outfit',
                fontWeight: 400,
                fontSize: '10px',
                lineHeight: '8px',
                textTransform: 'uppercase',
                color: '#333333'
              }}>{card.currency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Carousel Indicators */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '264px',
        display: 'flex',
        gap: '6px'
      }}>
        {faceCards.map((_, index) => (
          <div 
            key={index}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: index === 0 ? '#2563EB' : 'rgba(37, 99, 235, 0.2)',
              cursor: 'pointer'
            }}
            onClick={() => setCurrentCardIndex(index)}
          />
        ))}
      </div>
            }`}
          ></div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="absolute top-72 left-5 flex gap-2">
        <div className="w-[269px] h-11 bg-white border border-gray-100 shadow-sm rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <svg className="w-4.5 h-4.5" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
            <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input 
            type="text"
            placeholder="Search by Login, Name and Email....."
            className="flex-1 text-xs font-normal text-gray-900 outline-none bg-transparent"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Columns Button */}
        <button 
          onClick={() => setShowCustomizeModal(true)}
          className="w-[93px] h-11 bg-blue-50 border border-gray-100 shadow-sm rounded-lg flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="2" width="3" height="12" stroke="#999999" strokeWidth="1.5"/>
            <rect x="9" y="2" width="3" height="12" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          <span className="text-xs text-gray-900">Columns</span>
        </button>
      </div>

      {/* Table Container */}
      <div className="absolute top-80 left-5 right-5 bottom-24 overflow-auto">
        {/* Pagination Info */}
        <div className="text-center text-xs font-medium text-gray-700 mb-4">
          Showing {startIndex + 1}–{Math.min(endIndex, filteredClients.length)} of {filteredClients.length}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-1.5 mb-4">
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`px-3.5 py-1.5 border border-gray-700 rounded-3xl text-[10px] font-medium ${
              currentPage === 1 ? 'opacity-40' : ''
            }`}
          >
            Previous
          </button>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="px-3.5 py-1.5 border border-gray-700 rounded-3xl text-[10px] font-medium"
          >
            Next
          </button>
        </div>

        {/* Table */}
        <div className="border border-gray-100 rounded-md overflow-x-auto">
          <div className="flex min-w-max">
            {/* Login Column */}
            <div className="flex flex-col w-16">
              <div className="bg-gray-100 px-2.5 py-2.5 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">Login</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  className="bg-white px-2.5 py-2.5 border-b border-gray-200"
                  onClick={() => onClientClick && onClientClick(client)}
                >
                  <span className="text-xs text-blue-600 cursor-pointer">{client.login}</span>
                </div>
              ))}
            </div>

            {/* Balance Column */}
            <div className="flex flex-col w-18">
              <div className="bg-gray-100 px-2.5 py-2.5 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">Balance</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div key={idx} className="bg-white px-2.5 py-2.5 border-b border-gray-200">
                  <span className="text-xs text-gray-500">{parseFloat(client.balance || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Floating Profit Column */}
            <div className="flex flex-col w-26">
              <div className="bg-gray-100 px-2.5 py-2.5 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">Floating Profit</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div key={idx} className="bg-white px-2.5 py-2.5 border-b border-gray-200">
                  <span className="text-xs text-gray-500">{parseFloat(client.floating_profit || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Equity Column */}
            <div className="flex flex-col w-14">
              <div className="bg-gray-100 px-2.5 py-2.5 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">Equity</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div key={idx} className="bg-white px-2.5 py-2.5 border-b border-gray-200">
                  <span className="text-xs text-gray-500">{parseFloat(client.equity || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Name Column */}
            <div className="flex flex-col w-30">
              <div className="bg-gray-100 px-2.5 py-2.5 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-500">Name</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div key={idx} className="bg-white px-2.5 py-2.5 border-b border-gray-200">
                  <span className="text-xs text-gray-500">{client.name || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white shadow-2xl rounded-t-2xl p-7">
        <div className="flex justify-between items-center">
          {/* Home */}
          <button className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#475467" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 22V12H15V22" stroke="#475467" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Clients - Active */}
          <button className="flex items-center gap-2 bg-blue-600 bg-opacity-10 rounded-full px-4 py-1">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="7" r="4" fill="#2563EB"/>
              <path d="M3 21C3 17.134 6.134 14 10 14C11.015 14 11.974 14.228 12.832 14.633" fill="#2563EB"/>
              <circle cx="17" cy="10" r="3" fill="#2563EB"/>
              <path d="M21 20C21 17.794 19.206 16 17 16C16.126 16 15.319 16.306 14.691 16.814" fill="#2563EB"/>
            </svg>
            <span className="text-sm font-semibold text-blue-600">Clients</span>
          </button>

          {/* Pending */}
          <button className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#4B4B4B" strokeWidth="1.5"/>
              <circle cx="12" cy="12" r="1.5" fill="#4B4B4B"/>
              <circle cx="12" cy="7" r="1.5" fill="#4B4B4B"/>
              <circle cx="12" cy="17" r="1.5" fill="#4B4B4B"/>
              <circle cx="7" cy="12" r="1.5" fill="#4B4B4B"/>
              <circle cx="17" cy="12" r="1.5" fill="#4B4B4B"/>
            </svg>
          </button>

          {/* Stats */}
          <button className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M3 3L3 21L21 21" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M7 17L7 13M12 17L12 9M17 17L17 7" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Settings */}
          <button className="flex flex-col items-center gap-1">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#4B4B4B" strokeWidth="1.5"/>
              <path d="M12 1V4M12 20V23M23 12H20M4 12H1M20.49 20.49L18.36 18.36M5.64 5.64L3.51 3.51M20.49 3.51L18.36 5.64M5.64 18.36L3.51 20.49" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Home Indicator */}
      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-19 h-1.5 bg-gray-100 rounded-full"></div>

      {/* Customize View Modal */}
      <CustomizeViewModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onFilterClick={() => {
          setShowCustomizeModal(false)
          // TODO: Open filter modal when created
          console.log('Filter clicked')
        }}
        onIBFilterClick={() => {
          setShowCustomizeModal(false)
          setShowIBFilterModal(true)
        }}
        onGroupsClick={() => {
          setShowCustomizeModal(false)
          setShowGroupsModal(true)
        }}
        onReset={() => {
          setSearchQuery('')
          // TODO: Reset other filters
        }}
        onApply={() => {
          setShowCustomizeModal(false)
        }}
      />

      {/* IB Filter Modal */}
      <IBFilterModal
        isOpen={showIBFilterModal}
        onClose={() => setShowIBFilterModal(false)}
        ibList={[
          { email: 'parthikmemo@gmail.com', name: 'Parthik' },
          // Add more IB data as needed
        ]}
        onApply={(selectedIBs) => {
          console.log('Selected IBs:', selectedIBs)
          // TODO: Apply IB filter
        }}
      />

      {/* Login Groups Modal */}
      <LoginGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        groups={[]}
        onCreateGroup={() => {
          console.log('Create group clicked')
          // TODO: Open group creation modal
        }}
      />

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}

export default MobileClientsView
