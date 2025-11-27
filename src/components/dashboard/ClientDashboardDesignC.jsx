import React, { useMemo, useState, useRef, useEffect } from 'react'
import { useData } from '../../contexts/DataContext'

const formatNum = (n) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ClientDashboardDesignC() {
  const { clients = [], clientStats } = useData()
  const [activeCardIndex, setActiveCardIndex] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const carouselRef = useRef(null)
  const itemsPerPage = 12

  const totalPages = Math.ceil((clients?.length || 0) / itemsPerPage)

  const rows = useMemo(() => {
    if (!Array.isArray(clients)) return []
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return clients.slice(startIndex, endIndex).map(c => ({
      login: c.login,
      balance: formatNum(c.balance),
      floating: formatNum(c.floating ?? c.profit ?? 0),
      equity: formatNum(c.equity),
      name: c.name || c.fullName || c.clientName || c.email || '-'
    }))
  }, [clients, currentPage, itemsPerPage])

  const cards = useMemo(() => ([
    { label: 'Monthly EQuity', value: formatNum(clientStats?.thisMonthPnL), unit: 'USD' },
    { label: 'TOTAL EQUITY', value: formatNum(clientStats?.totalEquity), unit: 'USD' },
    { label: 'LIFETIME PnL', value: formatNum(clientStats?.lifetimePnL), unit: 'USD' },
    { label: 'DAILY PnL', value: formatNum(clientStats?.dailyPnL), unit: 'USD' },
  ]), [clientStats])

  // Handle scroll to track active card
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft
      const cardWidth = 250 + 10 // card width + gap
      const index = Math.round(scrollLeft / cardWidth)
      setActiveCardIndex(Math.min(index, cards.length - 1))
    }

    carousel.addEventListener('scroll', handleScroll)
    return () => carousel.removeEventListener('scroll', handleScroll)
  }, [cards.length])

  // Navigate to next page
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }

  // Navigate to previous page
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#F5F5F5] font-outfit overflow-x-hidden">
      {/* Header - White rounded rectangle */}
      <div className="sticky top-0 left-0 w-full h-[76px] bg-white shadow-[0px_3.64px_44.92px_rgba(0,0,0,0.05)] z-10">
        {/* Group container - full width */}
        <div className="absolute left-0 right-0 top-5 px-4 h-9 flex items-center justify-between">
          {/* Hamburger button - Frame with auto layout */}
          <button className="w-9 h-9 flex items-center justify-center rounded-[6px] border-0 bg-[rgba(230,238,248,0.44)] shadow-[inset_0px_2px_2px_rgba(155,151,151,0.2)] p-[11px]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect y="4" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="8.75" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="13.5" width="20" height="2.5" rx="1.25" fill="#404040"/>
            </svg>
          </button>

          {/* Clients heading - H2 Mobile / Semibold / 18px, centered */}
          <span className="absolute left-1/2 -translate-x-1/2 top-[6px] font-outfit font-semibold text-[18px] leading-[24px] text-center text-black">Clients</span>

          {/* Profile avatar - positioned at right */}
          <div className="absolute right-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 overflow-hidden shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="8" r="4" fill="white"/>
              <path d="M6 21C6 17.134 8.686 14 12 14C15.314 14 18 17.134 18 21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Action buttons and View All row */}
      <div className="px-0 pt-5 pb-4">
        <div className="flex items-center justify-between px-4">
          {/* Left side - Filter buttons */}
          <div className="flex items-center gap-2">
            <button className="h-9 px-3 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4.5 6.5H9.5M2.5 3.5H11.5M5.5 9.5H8.5" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[#4B4B4B] text-[12px] font-medium">Filter</span>
            </button>
            <button className="w-9 h-9 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 12L12 4M4.5 6.5C5.32843 6.5 6 5.82843 6 5C6 4.17157 5.32843 3.5 4.5 3.5C3.67157 3.5 3 4.17157 3 5C3 5.82843 3.67157 6.5 4.5 6.5ZM11.5 12.5C12.3284 12.5 13 11.8284 13 11C13 10.1716 12.3284 9.5 11.5 9.5C10.6716 9.5 10 10.1716 10 11C10 11.8284 10.6716 12.5 11.5 12.5Z" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button className="w-9 h-9 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2V10M8 10L5 7M8 10L11 7M3 14H13" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Right side - View All */}
          <span className="text-[#1A63BC] text-[12px] font-semibold leading-[15px] cursor-pointer">View All</span>
        </div>
      </div>

      {/* Stat cards - Horizontal scrollable carousel */}
      <div className="px-0 pb-2">
        <div 
          ref={carouselRef}
          className="flex gap-[10px] overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4"
        >
          {cards.map((card, i) => (
            <div 
              key={i} 
              className="min-w-[250px] h-[74px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-3 py-3 flex flex-col justify-between snap-start"
            >
              <div className="flex items-start justify-between">
                <span className="text-[#4B4B4B] text-[12px] font-normal leading-[15px]">{card.label}</span>
                <div className="w-[18px] h-[18px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                    <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-[6px]">
                <span className={`text-[20px] font-semibold leading-[25px] tracking-[-0.01em] ${card.value.includes('-') ? 'text-[#DC2626]' : 'text-[#000000]'}`}>
                  {card.value}
                </span>
                <span className="text-[#4B4B4B] text-[12px] font-normal leading-[15px] uppercase">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Carousel dots indicator */}
      <div className="flex items-center justify-center gap-[6px] pb-3 pt-2">
        {cards.map((_, i) => (
          <div 
            key={i}
            className={`w-[8px] h-[8px] rounded-full transition-all ${i === activeCardIndex ? 'bg-[#2563EB]' : 'bg-[#2563EB] opacity-20'}`}
          />
        ))}
      </div>

      {/* Search and action buttons */}
      <div className="px-0 pb-3">
        <div className="flex items-center gap-2 px-4">
          {/* Search box - takes more space */}
          <div className="flex-1 min-w-0 h-[44px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] px-3 flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
              <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input 
              placeholder="Search" 
              className="flex-1 min-w-0 outline-none border-0 text-[13px] text-[#4B4B4B] placeholder:text-[#999999] bg-transparent" 
            />
          </div>
          
          {/* Column selector button */}
          <button className="w-[44px] h-[44px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
              <rect x="8.5" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
              <rect x="14" y="5" width="3" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
            </svg>
          </button>

          {/* Previous button */}
          <button 
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className={`w-[44px] h-[44px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 ${
              currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Next button */}
          <button 
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className={`w-[44px] h-[44px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 ${
              currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>      {/* Table area */}
      <div className="px-0">
        <div className="w-full overflow-x-auto scrollbar-hide">
          <div className="min-w-[372px]">
          {/* Header row */}
          <div className="grid grid-cols-[60px_70px_100px_70px_1fr] bg-[#1A63BC] text-[#F5F5F5] text-[10px] font-semibold rounded-t-md">
            <div className="h-[35px] flex items-center px-2 border-r border-white/10">Login</div>
            <div className="h-[35px] flex items-center justify-center px-1 border-r border-white/10">Balance</div>
            <div className="h-[35px] flex items-center justify-center px-1 border-r border-white/10">Floating Profit</div>
            <div className="h-[35px] flex items-center justify-center px-1 border-r border-white/10">Equity</div>
            <div className="h-[35px] flex items-center px-2">Name</div>
          </div>
          {/* Rows */}
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-[60px_70px_100px_70px_1fr] text-[10px] text-[#4B4B4B] bg-white border-b border-[#E1E1E1]">
              <div className="h-[35px] flex items-center px-2 text-[#1A63BC] font-medium">{r.login}</div>
              <div className="h-[35px] flex items-center justify-center px-1">{r.balance}</div>
              <div className="h-[35px] flex items-center justify-center px-1">{r.floating}</div>
              <div className="h-[35px] flex items-center justify-center px-1">{r.equity}</div>
              <div className="h-[35px] flex items-center px-2 overflow-hidden">{r.name}</div>
            </div>
          ))}
          {/* Footer row */}
          <div className="grid grid-cols-[60px_70px_100px_70px_1fr] bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-medium rounded-b-md">
            <div className="h-[35px] flex items-center px-2 font-semibold">Total</div>
            <div className="h-[35px] flex items-center justify-center px-1">0.00</div>
            <div className="h-[35px] flex items-center justify-center px-1">0.00</div>
            <div className="h-[35px] flex items-center justify-center px-1">0.00</div>
            <div className="h-[35px] flex items-center px-2">-</div>
          </div>
          </div>
        </div>
      </div>

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
