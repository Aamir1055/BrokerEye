import React, { useMemo, useState, useRef, useEffect } from 'react'
import FilterModal from '../FilterModal'
import IBFilterModal from '../IBFilterModal'
import GroupModal from '../GroupModal'
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [showPercent, setShowPercent] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isIBFilterOpen, setIsIBFilterOpen] = useState(false)
  const [isGroupOpen, setIsGroupOpen] = useState(false)
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false)
  const columnDropdownRef = useRef(null)
  const [filters, setFilters] = useState({ hasFloating: false, hasCredit: false, noDeposit: false })
  const carouselRef = useRef(null)
  const itemsPerPage = 12

  // Filter clients based on applied filters
  const getFilteredClients = () => {
    if (!Array.isArray(clients)) return []
    
    let filtered = [...clients]

    if (filters.hasFloating) {
      // Filter clients who have floating positions (non-zero)
      filtered = filtered.filter(c => c && c.floating && Math.abs(c.floating) > 0)
    }

    if (filters.hasCredit) {
      // Filter clients who have credit (positive or negative, but not zero)
      filtered = filtered.filter(c => {
        if (!c) return false
        const credit = Number(c.credit)
        return Number.isFinite(credit) && credit !== 0
      })
    }

    if (filters.noDeposit) {
      // Filter clients whose Lifetime Deposit is zero (no deposit history)
      filtered = filtered.filter(c => {
        if (!c) return false
        const lifeDep = Number(c.lifetimeDeposit)
        return !(Number.isFinite(lifeDep) ? lifeDep !== 0 : false)
      })
    }

    return filtered
  }

  const filteredClients = useMemo(() => getFilteredClients(), [clients, filters])
  const totalPages = Math.ceil((filteredClients?.length || 0) / itemsPerPage)

  // Export functions
  const exportTableColumns = () => {
    // Export only visible table columns (from filtered data if filters applied)
    const dataToExport = (Object.values(filters).some(f => f)) ? filteredClients : clients
    
    if (!Array.isArray(dataToExport) || dataToExport.length === 0) {
      alert('No data available to export')
      return
    }
    
    const tableData = dataToExport.map(client => ({
      Login: client.login || '',
      Name: client.name || client.fullName || client.clientName || client.email || client.login || '',
      'Equity (USD)': formatNum(client.equity || 0),
      'Balance (USD)': formatNum(client.balance || 0),
      'Floating (USD)': formatNum(client.floating || client.profit || 0)
    }))
    
    // Create CSV content
    const headers = Object.keys(tableData[0] || {})
    const csvContent = [
      headers.join(','),
      ...tableData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n')
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients_table_columns.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    setIsColumnDropdownOpen(false)
  }

  const exportAllColumns = () => {
    // Export all available columns (from filtered data if filters applied)
    const dataToExport = (Object.values(filters).some(f => f)) ? filteredClients : clients
    
    if (!Array.isArray(dataToExport) || dataToExport.length === 0) {
      alert('No data available to export')
      return
    }
    
    const allData = dataToExport.map(client => ({
      Login: client.login || '',
      Name: client.name || client.fullName || client.clientName || client.email || client.login || '',
      'Equity (USD)': formatNum(client.equity || 0),
      'Balance (USD)': formatNum(client.balance || 0),
      'Floating (USD)': formatNum(client.floating || client.profit || 0),
      'Credit (USD)': formatNum(client.credit || 0),
      'Margin (USD)': formatNum(client.margin || 0),
      'Free Margin (USD)': formatNum(client.freeMargin || 0),
      'Margin Level (%)': formatNum(client.marginLevel || 0),
      Group: client.group || '',
      'Last Update': client.lastUpdate || '',
      Server: client.server || '',
      Currency: client.currency || '',
      Leverage: client.leverage || '',
      'Registration Time': client.regTime || '',
      'Last Access': client.lastAccess || ''
    }))
    
    // Create CSV content
    const headers = Object.keys(allData[0] || {})
    const csvContent = [
      headers.join(','),
      ...allData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n')
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients_all_columns.csv'
    a.click()
    window.URL.revokeObjectURL(url)
    setIsColumnDropdownOpen(false)
  }

  const rows = useMemo(() => {
    if (!Array.isArray(filteredClients)) return []
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredClients.slice(startIndex, endIndex).map(c => ({
      login: c.login,
      balance: formatNum(c.balance),
      floating: formatNum(c.floating ?? c.profit ?? 0),
      equity: formatNum(c.equity),
      name: c.name || c.fullName || c.clientName || c.email || '-'
    }))
  }, [filteredClients, currentPage, itemsPerPage])

  const cards = useMemo(() => {
    console.log('📊 Cards calculation - clientStats:', clientStats)
    console.log('📊 Filtered clients data:', filteredClients?.slice(0, 2))
    
    // Calculate stats from filtered clients if filters are applied
    const dataToUse = (Object.values(filters).some(f => f)) ? filteredClients : clients
    
    const calculateStats = () => {
      if (!Array.isArray(dataToUse) || dataToUse.length === 0) {
        return {
          totalClients: 0,
          totalBalance: 0,
          totalCredit: 0,
          totalEquity: 0,
          totalPnl: 0,
          dailyPnL: 0,
          totalProfit: 0,
          dailyDeposit: 0,
          dailyWithdrawal: 0,
          thisWeekPnL: 0,
          thisMonthPnL: 0,
          lifetimePnL: 0,
          weekDeposit: 0,
          weekWithdrawal: 0,
          monthDeposit: 0,
          monthWithdrawal: 0,
          lifetimeDeposit: 0,
          lifetimeWithdrawal: 0,
          totalCommission: 0,
          availableCommission: 0,
          blockedCommission: 0
        }
      }
      
      const sum = (key) => dataToUse.reduce((acc, c) => acc + (Number(c?.[key]) || 0), 0)
      return {
        totalClients: dataToUse.length,
        totalBalance: sum('balance'),
        totalCredit: sum('credit'),
        totalEquity: sum('equity'),
        totalPnl: sum('pnl'),
        dailyPnL: sum('dailyPnL'),
        totalProfit: sum('floating') || sum('profit'),
        dailyDeposit: sum('dailyDeposit'),
        dailyWithdrawal: sum('dailyWithdrawal'),
        thisWeekPnL: sum('thisWeekPnL'),
        thisMonthPnL: sum('thisMonthPnL'),
        lifetimePnL: sum('lifetimePnL'),
        weekDeposit: sum('weekDeposit'),
        weekWithdrawal: sum('weekWithdrawal'),
        monthDeposit: sum('monthDeposit'),
        monthWithdrawal: sum('monthWithdrawal'),
        lifetimeDeposit: sum('lifetimeDeposit'),
        lifetimeWithdrawal: sum('lifetimeWithdrawal'),
        totalCommission: sum('blockedCommission'),
        availableCommission: sum('availableCommission'),
        blockedCommission: sum('blockedCommission')
      }
    }
    
    const stats = Object.values(filters).some(f => f) ? calculateStats() : clientStats
    
    if (showPercent) {
      const sum = (key) => Array.isArray(dataToUse) ? dataToUse.reduce((acc, c) => acc + (Number(c?.[key]) || 0), 0) : 0
      const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      return [
        { label: 'Monthly EQuity', value: fmt(sum('thisMonthPnL_percentage')), unit: '%' },
        { label: 'TOTAL EQUITY', value: fmt(sum('equity_percentage')), unit: '%' },
        { label: 'LIFETIME PnL', value: fmt(sum('lifetimePnL_percentage')), unit: '%' },
        { label: 'DAILY PnL', value: fmt(sum('dailyPnL_percentage')), unit: '%' },
      ]
    }
    return [
      // Core Metrics  
      { label: 'Total Clients', value: String(stats?.totalClients || 0), unit: 'Count' },
      { label: 'Total Balance', value: formatNum(stats?.totalBalance || 0), unit: 'USD' },
      { label: 'Total Credit', value: formatNum(stats?.totalCredit || 0), unit: 'USD' },
      { label: 'TOTAL EQUITY', value: formatNum(stats?.totalEquity || 0), unit: 'USD' },
      { label: 'PNL', value: formatNum(stats?.totalPnl || stats?.dailyPnL || 0), unit: 'USD' },
      { label: 'Floating Profit', value: formatNum(stats?.totalProfit || 0), unit: 'USD' },
      
      // Daily Metrics
      { label: 'Daily Deposit', value: formatNum(stats?.dailyDeposit || 0), unit: 'USD' },
      { label: 'Daily Withdrawal', value: formatNum(stats?.dailyWithdrawal || 0), unit: 'USD' },
      { label: 'DAILY PnL', value: formatNum(stats?.dailyPnL || 0), unit: 'USD' },
      { label: 'This Week PnL', value: formatNum(stats?.thisWeekPnL || 0), unit: 'USD' },
      { label: 'Monthly EQuity', value: formatNum(stats?.thisMonthPnL || 0), unit: 'USD' },
      { label: 'LIFETIME PnL', value: formatNum(stats?.lifetimePnL || 0), unit: 'USD' },
      
      // Net Calculations  
      { label: 'Daily Net D/W', value: formatNum((stats?.dailyDeposit || 0) - (stats?.dailyWithdrawal || 0)), unit: 'USD' },
      { label: 'Book PnL', value: formatNum((stats?.lifetimePnL || 0) + (stats?.totalProfit || 0)), unit: 'USD' },
      
      // Rebate Metrics
      { label: 'Total Rebate', value: formatNum(stats?.totalCommission), unit: 'USD' },
      { label: 'Available Rebate', value: formatNum(stats?.availableCommission), unit: 'USD' },
      { label: 'Blocked Rebate', value: formatNum(stats?.blockedCommission), unit: 'USD' },
      
      // Weekly Metrics
      { label: 'Week Deposit', value: formatNum(stats?.weekDeposit), unit: 'USD' },
      { label: 'Week Withdrawal', value: formatNum(stats?.weekWithdrawal), unit: 'USD' },
      { label: 'NET Week DW', value: formatNum((stats?.weekDeposit || 0) - (stats?.weekWithdrawal || 0)), unit: 'USD' },
      
      // Monthly Metrics
      { label: 'Monthly Deposit', value: formatNum(stats?.monthDeposit), unit: 'USD' },
      { label: 'Monthly Withdrawal', value: formatNum(stats?.monthWithdrawal), unit: 'USD' },
      { label: 'NET Monthly DW', value: formatNum((stats?.monthDeposit || 0) - (stats?.monthWithdrawal || 0)), unit: 'USD' },
      
      // Lifetime Metrics
      { label: 'Lifetime Deposit', value: formatNum(stats?.lifetimeDeposit), unit: 'USD' },
      { label: 'Lifetime Withdrawal', value: formatNum(stats?.lifetimeWithdrawal), unit: 'USD' },
      { label: 'NET Lifetime DW', value: formatNum((stats?.lifetimeDeposit || 0) - (stats?.lifetimeWithdrawal || 0)), unit: 'USD' },
      
      // Bonus Metrics
      { label: 'Daily Bonus IN', value: formatNum(clientStats?.dailyBonusIn), unit: 'USD' },
      { label: 'Daily Bonus OUT', value: formatNum(clientStats?.dailyBonusOut), unit: 'USD' },
      { label: 'NET Daily Bonus', value: formatNum(clientStats?.netDailyBonus), unit: 'USD' },
      { label: 'Week Bonus IN', value: formatNum(clientStats?.weekBonusIn), unit: 'USD' },
      { label: 'Week Bonus OUT', value: formatNum(clientStats?.weekBonusOut), unit: 'USD' },
      { label: 'NET Week Bonus', value: formatNum(clientStats?.netWeekBonus), unit: 'USD' },
      { label: 'Monthly Bonus IN', value: formatNum(clientStats?.monthBonusIn), unit: 'USD' },
      { label: 'Monthly Bonus OUT', value: formatNum(clientStats?.monthBonusOut), unit: 'USD' },
      { label: 'NET Monthly Bonus', value: formatNum(clientStats?.netMonthBonus), unit: 'USD' },
      { label: 'Lifetime Bonus IN', value: formatNum(clientStats?.lifetimeBonusIn), unit: 'USD' },
      { label: 'Lifetime Bonus OUT', value: formatNum(clientStats?.lifetimeBonusOut), unit: 'USD' },
      { label: 'NET Lifetime Bonus', value: formatNum(clientStats?.netLifetimeBonus), unit: 'USD' },
      
      // Credit Metrics
      { label: 'Weekly Credit IN', value: formatNum(clientStats?.weekCreditIn), unit: 'USD' },
      { label: 'Monthly Credit IN', value: formatNum(clientStats?.monthCreditIn), unit: 'USD' },
      { label: 'Lifetime Credit IN', value: formatNum(clientStats?.lifetimeCreditIn), unit: 'USD' },
      { label: 'Weekly Credit OUT', value: formatNum(clientStats?.weekCreditOut), unit: 'USD' },
      { label: 'Monthly Credit OUT', value: formatNum(clientStats?.monthCreditOut), unit: 'USD' },
      { label: 'Lifetime Credit OUT', value: formatNum(clientStats?.lifetimeCreditOut), unit: 'USD' },
      { label: 'NET Credit', value: formatNum(clientStats?.netCredit), unit: 'USD' },
      
      // Previous Equity Metrics
      { label: 'Weekly Previous Equity', value: formatNum(clientStats?.weekPreviousEquity), unit: 'USD' },
      { label: 'Monthly Previous Equity', value: formatNum(clientStats?.monthPreviousEquity), unit: 'USD' },
      { label: 'Previous Equity', value: formatNum(clientStats?.previousEquity), unit: 'USD' },
      
      // Additional Calculated Metrics
      { label: 'Net Lifetime PnL', value: formatNum((stats?.lifetimePnL || 0) - (stats?.totalCommission || 0)), unit: 'USD' },
    ]
  }, [clientStats, clients, filteredClients, filters, showPercent])

  // Handle scroll to track active card
  useEffect(() => {
    const carousel = carouselRef.current
    if (!carousel) return

    const handleScroll = () => {
      const scrollLeft = carousel.scrollLeft
      const cardWidth = 150 + 8 // card width + gap
      const cardsPerScreen = 2
      const index = Math.round(scrollLeft / (cardWidth * cardsPerScreen))
      setActiveCardIndex(Math.min(index, Math.ceil(cards.length / cardsPerScreen) - 1))
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
          <button onClick={() => setIsSidebarOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-[6px] border-0 bg-[rgba(230,238,248,0.44)] shadow-[inset_0px_2px_2px_rgba(155,151,151,0.2)] p-[11px]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect y="4" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="8.75" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="13.5" width="20" height="2.5" rx="1.25" fill="#404040"/>
            </svg>
          </button>

          {/* Clients heading - H2 Mobile / Semibold / 18px, centered */}
          <span className="absolute left-1/2 -translate-x-1/2 top-[6px] font-outfit font-semibold text-[18px] leading-[24px] text-center text-black">Clients</span>

          {/* Profile avatar - positioned at right with spacing */}
          <div className="absolute right-4 w-9 h-9 rounded-full overflow-hidden shadow-[inset_0px_4px_4px_rgba(0,0,0,0.25)]">
            <img 
              src="data:image/jpeg;base64,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" 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Action buttons and View All row */}
      <div className="pt-5 pb-4 px-4">
        <div className="flex items-center justify-between">
          {/* Left side - Filter, %, Download buttons */}
          <div className="flex items-center gap-2">
            <button onClick={() => setIsCustomizeOpen(true)} className="h-9 px-3 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M4.5 6.5H9.5M2.5 3.5H11.5M5.5 9.5H8.5" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[#4B4B4B] text-[12px] font-medium">Filter</span>
            </button>
            <button
              onClick={() => setShowPercent((v) => !v)}
              className={`w-9 h-9 rounded-lg border shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors ${
                showPercent ? 'bg-blue-50 border-blue-200' : 'bg-white border-[#ECECEC] hover:bg-gray-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 12L12 4M4.5 6.5C5.32843 6.5 6 5.82843 6 5C6 4.17157 5.32843 3.5 4.5 3.5C3.67157 3.5 3 4.17157 3 5C3 5.82843 3.67157 6.5 4.5 6.5ZM11.5 12.5C12.3284 12.5 13 11.8284 13 11C13 10.1716 12.3284 9.5 11.5 9.5C10.6716 9.5 10 10.1716 10 11C10 11.8284 10.6716 12.5 11.5 12.5Z" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {/* Download button and dropdown */}
            <div className="relative" ref={columnDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsColumnDropdownOpen(!isColumnDropdownOpen);
                }}
                className="w-9 h-9 rounded-lg bg-white border border-[#ECECEC] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors"
                title="Download"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v10m0 0l-4-4m4 4l4-4" stroke="#404040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="4" y="15" width="12" height="2" rx="1" fill="#404040"/>
                </svg>
              </button>
              {/* Dropdown menu - simple absolute positioning */}
              {isColumnDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-[160px] bg-white border border-[#ECECEC] rounded-[8px] shadow-[0_0_12px_rgba(75,75,75,0.15)] z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportTableColumns();
                      setIsColumnDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[12px] text-[#404040] hover:bg-gray-50 flex items-center gap-2 border-b border-[#F5F5F5]"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="2" y="3" width="12" height="10" stroke="#404040" strokeWidth="1" rx="1" fill="none"/>
                      <line x1="2" y1="6" x2="14" y2="6" stroke="#404040" strokeWidth="1"/>
                      <line x1="6" y1="3" x2="6" y2="13" stroke="#404040" strokeWidth="1"/>
                    </svg>
                    Download Table Columns
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportAllColumns();
                      setIsColumnDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-[12px] text-[#404040] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <rect x="1" y="2" width="14" height="12" stroke="#404040" strokeWidth="1" rx="1" fill="none"/>
                      <line x1="1" y1="5" x2="15" y2="5" stroke="#404040" strokeWidth="1"/>
                      <line x1="5" y1="2" x2="5" y2="14" stroke="#404040" strokeWidth="1"/>
                      <line x1="10" y1="2" x2="10" y2="14" stroke="#404040" strokeWidth="1"/>
                    </svg>
                    Download All Columns
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right side - View All only */}
          <span className="text-[#1A63BC] text-[12px] font-semibold leading-[15px] cursor-pointer">View All</span>
        </div>
      </div>

      {/* Customize View Bottom Sheet */}
      {isCustomizeOpen && (
        <div className="fixed inset-0 z-40">
          {/* Dim background */}
          <div className="absolute inset-0 bg-black/35" onClick={() => setIsCustomizeOpen(false)} />
          {/* Bottom sheet */}
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full mx-auto mt-2" />
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-t border-[#F0F0F0]">
              <button onClick={() => setIsCustomizeOpen(false)} className="w-9 h-9 rounded-lg bg-[#F5F5F5] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
              <div className="text-[16px] font-semibold text-[#111827]">Customize view</div>
              <div className="w-9 h-9" />
            </div>
            {/* Items */}
            <div className="px-4">
              <div className="divide-y divide-[#EFEFEF]">
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsFilterOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 5h12M6 9h6M7 13h4" stroke="#1F2937" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Filter</span>
                </button>
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsIBFilterOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M4 20a8 8 0 0 1 16 0" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">IB Filter</span>
                </button>
                <button className="w-full flex items-center gap-3 py-3" onClick={() => { setIsCustomizeOpen(false); setIsGroupOpen(true); }}>
                  <span className="w-9 h-9 rounded-lg bg-[#F5F7FB] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M17 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#1F2937"/><path d="M3 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="#1F2937"/></svg>
                  </span>
                  <span className="text-[14px] text-[#111827]">Groups</span>
                </button>
              </div>
            </div>
            {/* Footer actions */}
            <div className="px-4 py-4 flex items-center justify-between gap-3">
              <button className="flex-1 h-10 rounded-xl bg-[#EFF4FB] text-[#1A63BC] text-[13px] font-semibold">Reset</button>
              <button className="flex-1 h-10 rounded-xl bg-[#1A63BC] text-white text-[13px] font-semibold" onClick={() => setIsCustomizeOpen(false)}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Hook existing modals */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        onApply={(newFilters) => { setFilters(newFilters); }}
        initialFilters={filters}
      />
      <IBFilterModal
        isOpen={isIBFilterOpen}
        onClose={() => setIsIBFilterOpen(false)}
        onSelectIB={(ib) => { /* Integrate selection with context or state as needed */ }}
      />
      <GroupModal
        isOpen={isGroupOpen}
        onClose={() => setIsGroupOpen(false)}
        availableItems={clients}
        loginField="login"
        displayField="name"
      />

      {/* Sidebar overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30">
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="#404040" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto py-2">
              <nav className="flex flex-col">
                {[
                  {label:'Dashboard', icon: (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="#404040"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="#404040"/></svg>
                  )},
                  {label:'Clients', active:true, icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="8" r="3" stroke="#1A63BC"/><circle cx="16" cy="8" r="3" stroke="#1A63BC"/><path d="M3 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="#1A63BC"/></svg>
                  )},
                  {label:'Pending Orders', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><circle cx="12" cy="12" r="2" fill="#404040"/></svg>
                  )},
                  {label:'Margin Level', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 18L10 12L14 16L20 8" stroke="#404040" strokeWidth="2"/></svg>
                  )},
                  {label:'Live Dealing', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 18 0" stroke="#404040"/><path d="M7 12a5 5 0 0 1 10 0" stroke="#404040"/></svg>
                  )},
                  {label:'Client Percentage', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6" stroke="#404040"/><circle cx="8" cy="8" r="2" stroke="#404040"/><circle cx="16" cy="16" r="2" stroke="#404040"/></svg>
                  )},
                  {label:'IB Commissions', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#404040"/><path d="M12 7v10M8 10h8" stroke="#404040"/></svg>
                  )},
                  {label:'Settings', icon:(
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" stroke="#404040"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2" stroke="#404040"/></svg>
                  )},
                ].map((item, idx) => (
                  <button key={idx} className={`flex items-center gap-3 px-4 h-11 text-[13px] ${item.active ? 'text-[#1A63BC] bg-[#EFF4FB] rounded-lg font-semibold' : 'text-[#404040]'}`}>
                    <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 mt-auto border-t border-[#ECECEC]">
              <button className="flex items-center gap-3 px-2 h-10 text-[13px] text-[#404040]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M10 17l5-5-5-5" stroke="#404040" strokeWidth="2"/><path d="M4 12h11" stroke="#404040" strokeWidth="2"/></svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards - Horizontal scrollable carousel */}
      <div className="pb-2 pl-5">
        <div 
          ref={carouselRef}
          className="flex gap-[8px] overflow-x-auto scrollbar-hide snap-x snap-mandatory pr-4"
        >
          {cards.map((card, i) => (
            <div 
              key={i} 
              className="min-w-[150px] w-[150px] h-[45px] bg-white rounded-[12px] shadow-[0_0_12px_rgba(75,75,75,0.05)] border border-[#F2F2F7] px-2 py-1.5 flex flex-col justify-between snap-start flex-shrink-0"
            >
              <div className="flex items-start justify-between">
                <span className="text-[#4B4B4B] text-[8px] font-normal leading-[10px] pr-1">{card.label}</span>
                <div className="w-[16px] h-[16px] bg-[#2563EB] rounded-[3px] flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="1.5" y="1.5" width="6" height="6" rx="0.5" stroke="white" strokeWidth="1" fill="none"/>
                    <rect x="4.5" y="4.5" width="6" height="6" rx="0.5" fill="white" stroke="white" strokeWidth="1"/>
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-[4px]">
                <span className={`text-[14px] font-semibold leading-[18px] tracking-[-0.01em] ${card.value.includes('-') ? 'text-[#DC2626]' : 'text-[#000000]'}`}>
                  {card.value}
                </span>
                <span className="text-[#4B4B4B] text-[8px] font-normal leading-[10px] uppercase">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search and action buttons */}
      <div className="pb-3 px-4">
          <div className="flex items-center gap-1">
          {/* Search box - compact, edge-to-edge */}
          <div className="flex-1 min-w-0 h-[32px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] px-2 flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="flex-shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
              <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input 
              placeholder="Search" 
              className="flex-1 min-w-0 outline-none border-0 text-[11px] text-[#4B4B4B] placeholder:text-[#999999] bg-transparent" 
            />
          </div>
          
          {/* Column selector button with dropdown */}
          <div className="relative" ref={columnDropdownRef}>
            <button 
              onClick={(e) => {
                e.stopPropagation()
                setIsColumnDropdownOpen(!isColumnDropdownOpen)
              }}
              className="w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="8.5" y="5" width="4" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
                <rect x="14" y="5" width="3" height="10" stroke="#4B4B4B" strokeWidth="1.5" rx="1"/>
              </svg>
            </button>
            {/* Dropdown handled in the download button section above */}
          </div>

          {/* Previous button */}
          <button 
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className={`w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 ${
              currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M12 14L8 10L12 6" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Next button */}
          <button 
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className={`w-[28px] h-[28px] bg-white border border-[#ECECEC] rounded-[10px] shadow-[0_0_12px_rgba(75,75,75,0.05)] flex items-center justify-center transition-colors flex-shrink-0 ${
              currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M8 6L12 10L8 14" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>      {/* Table area */}
      <div className="table-no-borders relative">
        <div className="w-full overflow-x-auto scrollbar-hide">
          <div className="min-w-full relative">
          {/* Header row */}
          <div className="grid grid-cols-[50px_60px_80px_60px_1fr] bg-[#1A63BC] text-white text-[10px] font-semibold sticky top-0 z-20 shadow-[0_2px_4px_rgba(0,0,0,0.1)]" style={{gap: '0px', gridGap: '0px', columnGap: '0px'}}>
            <div className="h-[28px] flex items-center justify-center px-1 sticky left-0 bg-[#1A63BC] z-30" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>Login</div>
            <div className="h-[28px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>Balance</div>
            <div className="h-[28px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>Profit</div>
            <div className="h-[28px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>Equity</div>
            <div className="h-[28px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>Name</div>
          </div>
          {/* Rows */}
          {rows.map((r, idx) => (
            <div key={idx} className="grid grid-cols-[50px_60px_80px_60px_1fr] text-[10px] text-[#4B4B4B] bg-white border-b border-[#E1E1E1] hover:bg-[#F8FAFC] transition-colors" style={{gap: '0px', gridGap: '0px', columnGap: '0px'}}>
              <div className="h-[38px] flex items-center justify-center px-1 text-[#1A63BC] font-semibold sticky left-0 bg-white z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{r.login}</div>
              <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{r.balance}</div>
              <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{r.floating}</div>
              <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{r.equity}</div>
              <div className="h-[38px] flex items-center justify-center px-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{r.name}</div>
            </div>
          ))}
          {/* Footer row */}
          <div className="grid grid-cols-[50px_60px_80px_60px_1fr] bg-[#EFF4FB] text-[#1A63BC] text-[10px] font-semibold border-t-2 border-[#1A63BC]" style={{gap: '0px', gridGap: '0px', columnGap: '0px'}}>
            <div className="h-[38px] flex items-center justify-center px-1 font-bold sticky left-0 bg-[#EFF4FB] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>Total</div>
            <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{formatNum(clientStats?.totalBalance || 0)}</div>
            <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{formatNum(clientStats?.totalProfit || 0)}</div>
            <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>{formatNum(clientStats?.totalEquity || 0)}</div>
            <div className="h-[38px] flex items-center justify-center px-1" style={{border: 'none', outline: 'none', boxShadow: 'none'}}>-</div>
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
        /* Completely remove all borders and separators from table */
        .table-no-borders,
        .table-no-borders *,
        .table-no-borders div {
          border-left: none !important;
          border-right: none !important;
          border-inline: none !important;
          border-inline-start: none !important;
          border-inline-end: none !important;
          border-collapse: collapse !important;
          background-image: none !important;
        }
        .table-no-borders .grid {
          gap: 0 !important;
          grid-gap: 0 !important;
          column-gap: 0 !important;
          grid-column-gap: 0 !important;
        }
        .table-no-borders div[class*="grid"] {
          border-spacing: 0 !important;
        }
        /* Sticky login column enhancements */
        .table-no-borders .sticky {
          position: sticky !important;
          left: 0 !important;
          z-index: 10 !important;
        }
        .table-no-borders .grid > div:first-child {
          position: sticky !important;
          left: 0 !important;
          z-index: 10 !important;
          box-shadow: 2px 0 4px rgba(0,0,0,0.05) !important;
        }
        /* Header row sticky enhancements */
        .table-no-borders .grid:first-child {
          position: sticky !important;
          top: 0 !important;
          z-index: 20 !important;
        }
        .table-no-borders .grid:first-child > div:first-child {
          z-index: 30 !important;
        }
      `}</style>
    </div>
  )
}
