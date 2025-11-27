import { useState, useEffect } from 'react'
import { useGroups } from '../contexts/GroupContext'
import { useIB } from '../contexts/IBContext'
import CustomizeViewModal from './CustomizeViewModal'
import IBFilterModal from './IBFilterModal'
import LoginGroupsModal from './LoginGroupsModal'
import FilterModal from './FilterModal'
import ShowHideColumnsModal from './ShowHideColumnsModal'

// Simple slide-in side drawer matching Figma nav
const SideDrawer = ({ open, onClose, onNavigate, active }) => {
  return (
    <>
      {open && (
        <div onClick={onClose} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 40
        }} />
      )}
      <div style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', width: open ? '260px' : '0px',
        overflow: 'hidden', background: '#FFFFFF', boxShadow: open ? '2px 0 18px rgba(0,0,0,0.12)' : 'none',
        transition: 'width 0.26s cubic-bezier(.4,.0,.2,1)', zIndex: 50, borderRight: open ? '1px solid #E5E7EB' : 'none'
      }}>
        {open && (
          <div style={{padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '18px', fontFamily: 'Outfit'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <div style={{width: 36, height: 36, borderRadius: 8, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600}}>B</div>
              <div style={{display: 'flex', flexDirection: 'column'}}>
                <span style={{fontSize: 14, fontWeight: 600, color: '#2563EB'}}>Broker Eyes</span>
                <span style={{fontSize: 10, fontWeight: 500, color: '#4B4B4B'}}>Trading Platform</span>
              </div>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              {[
                {key: 'dashboard', label: 'Dashboard'},
                {key: 'clients', label: 'Clients'},
                {key: 'pending', label: 'Pending Orders'},
                {key: 'merge', label: 'Merge Level'},
                {key: 'ibs', label: 'IBs'},
                {key: 'otherPct', label: 'Other Percentage'},
                {key: 'comments', label: '% Comments'},
                {key: 'settings', label: 'Settings'}
              ].map(item => {
                const isActive = active === item.key
                return (
                  <button key={item.key} onClick={() => onNavigate(item.key)} style={{
                    textAlign: 'left', border: 'none', background: isActive ? 'rgba(37,99,235,0.09)' : 'transparent',
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
                    fontWeight: 500, color: isActive ? '#2563EB' : '#4B4B4B', display: 'flex', alignItems: 'center'
                  }}>
                    {item.label}
                  </button>
                )
              })}
            </div>
            <div style={{marginTop: 'auto'}}>
              <button onClick={onClose} style={{
                width: '100%', background: '#F4F4F4', border: '1px solid #E5E7EB', borderRadius: 10,
                padding: '10px 12px', fontFamily: 'Outfit', fontSize: 12, fontWeight: 600, color: '#4B4B4B', cursor: 'pointer'
              }}>Logout</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Metrics view (cards list)
const MetricsView = ({ metrics, onBack }) => {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: '#F4F4F4', overflowY: 'auto', fontFamily: 'Outfit'
    }}>
      {/* Status bar placeholder height to avoid overlap */}
      <div style={{height: 60}} />
      {/* Header */}
      <div style={{padding: '0 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <button onClick={onBack} style={{
          width: 36, height: 36, background: 'rgba(230,238,248,0.44)', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 style={{margin: 0, fontSize: 20, fontWeight: 600, color: '#4B4B4B'}}>Client Metrics</h2>
        <div style={{width: 36, height: 36, background: '#C4C4C4', borderRadius: '50%'}} />
      </div>
      <div style={{marginTop: 24, padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12}}>
        {metrics.map(m => (
          <div key={m.key} style={{
            background: '#FFFFFF', border: '1px solid #F2F2F7', boxShadow: '0 0 12px rgba(75,75,75,0.05)',
            borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <span style={{fontSize: 12, fontWeight: 600, color: '#4B4B4B'}}>{m.label}</span>
              <span style={{fontSize: 18, fontWeight: 700, color: m.color}}>{m.value}</span>
            </div>
            <div style={{width: 36, height: 36, background: 'rgba(37,99,235,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="9" stroke="#2563EB" strokeWidth="1.5" />
                <path d="M10 5V10L13 13" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        ))}
        <div style={{height: 90}} />
      </div>
    </div>
  )
}

const MobileClientsViewNew = ({ clients = [], onClientClick }) => {
  const { groups, createGroup, updateGroup, deleteGroup, setShowGroupModal, showGroupModal, setEditingGroup, editingGroup } = useGroups()
  const { selectedIB, setSelectedIB, ibMT5Accounts } = useIB()
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [showIBFilterModal, setShowIBFilterModal] = useState(false)
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeNav, setActiveNav] = useState('clients')
  const [filters, setFilters] = useState({})
  const [visibleColumns, setVisibleColumns] = useState(['login', 'percentage', 'floating', 'volume', 'balance', 'credit', 'equity', 'name'])
  const [showMetrics, setShowMetrics] = useState(false)
  const itemsPerPage = 10

  // Filter clients
  let filteredClients = (clients || []).filter(client => {
    // Search filter
    if (searchQuery && !(
      client.login?.toString().includes(searchQuery) ||
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )) {
      return false
    }
    
    // Advanced filters
    if (filters.hasFloating && (!client.floating_profit || parseFloat(client.floating_profit) === 0)) {
      return false
    }
    if (filters.hasCredit && (!client.credit || parseFloat(client.credit) === 0)) {
      return false
    }
    if (filters.noDeposit && client.deposit && parseFloat(client.deposit) > 0) {
      return false
    }
    
    return true
  })
  
  // Apply IB filter if selected
  if (selectedIB && ibMT5Accounts && ibMT5Accounts.length > 0) {
    filteredClients = filteredClients.filter(client => 
      ibMT5Accounts.includes(client.login?.toString())
    )
  }

  // Calculate totals
  const totals = {
    monthlyEquity: filteredClients.reduce((sum, c) => sum + (parseFloat(c.equity) || 0), 0),
    lifetimeBonusOut: filteredClients.reduce((sum, c) => sum + (parseFloat(c.bonus) || 0), 0)
  }

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const displayedClients = filteredClients.slice(startIndex, endIndex)

  // Aggregate metrics for metrics view
  const metricsData = (() => {
    const sum = (key) => filteredClients.reduce((acc, c) => acc + (parseFloat(c[key]) || 0), 0)
    return [
      { key: 'totalClients', label: 'Total Clients', value: filteredClients.length, color: '#2563EB' },
      { key: 'totalBalance', label: 'Total Balance', value: sum('balance').toFixed(2), color: '#2563EB' },
      { key: 'totalCredit', label: 'Total Credit', value: sum('credit').toFixed(2), color: '#2563EB' },
      { key: 'totalEquity', label: 'Total Equity', value: sum('equity').toFixed(2), color: '#34C759' },
      { key: 'floatingProfit', label: 'Floating Profit', value: sum('floating_profit').toFixed(2), color: '#34C759' },
      { key: 'pnl', label: 'PNL', value: sum('pnl').toFixed(2), color: '#34C759' },
      { key: 'lifetimeBonusOut', label: 'Lifetime Bonus OUT', value: sum('lifetimeBonusOut').toFixed(2), color: '#999999' },
      { key: 'lifetimeBonusIn', label: 'Lifetime Bonus IN', value: sum('lifetimeBonusIn').toFixed(2), color: '#2563EB' }
    ]
  })()

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
      <SideDrawer 
        open={showDrawer} 
        active={activeNav} 
        onClose={() => setShowDrawer(false)}
        onNavigate={(key) => {
          setActiveNav(key)
          if (key === 'dashboard') {
            setShowMetrics(true)
          } else if (key === 'clients') {
            setShowMetrics(false)
          }
        }}
      />

      {/* Rounded rectangle - Header Container */}
      <div style={{
        position: 'absolute',
        width: '412px',
        height: '118px',
        left: '0px',
        top: '0px',
        background: '#FFFFFF',
        boxShadow: '0px 3.64486px 44.9229px rgba(0, 0, 0, 0.05)',
        borderRadius: '20px'
      }}>
        {/* Header Content */}
        <div style={{
          position: 'absolute',
          width: '372px',
          height: '36px',
          left: '20px',
          top: '62px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Hamburger Button */}
          <button 
            onClick={() => setShowDrawer(true)}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '11px 8px',
              gap: '10px',
              width: '36px',
              height: '36px',
              background: 'rgba(230, 238, 248, 0.44)',
              boxShadow: 'inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect y="3.75" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="8.75" width="20" height="2.5" rx="1.25" fill="#404040"/>
              <rect y="13.75" width="20" height="2.5" rx="1.25" fill="#404040"/>
            </svg>
          </button>
          
          {/* Text - Clients/Client Percentage */}
          <h1 style={{
            position: 'absolute',
            width: '123px',
            height: '24px',
            left: 'calc(50% - 123px/2 + 0.5px)',
            top: '6px',
            fontFamily: 'Outfit',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: '18px',
            lineHeight: '24px',
            textAlign: 'center',
            color: '#000000',
            margin: 0
          }}>{showMetrics ? 'Client Metrics' : 'Clients'}</h1>
          
          {/* Profile Image */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '0px',
            gap: '10px',
            width: '36px',
            height: '36px',
            boxShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)',
            borderRadius: '50%',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: '#C4C4C4',
              borderRadius: '50%'
            }} />
          </div>
        </div>
      </div>

      {/* Frame 1707486462 - Action buttons & View All */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0px',
        gap: '175px',
        position: 'absolute',
        width: '372px',
        height: '26px',
        left: '20px',
        top: '138px',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }}>
        {/* Frame 1707486461 - Action Buttons */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0px',
          gap: '10px',
          width: '140px',
          height: '26px'
        }}>
          {/* Filter Button */}
          <button
            onClick={() => setShowCustomizeModal(true)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '5px 10px',
              gap: '10px',
              width: '68px',
              height: '26px',
              background: '#FFFFFF',
              boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.25)',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '4px',
              width: '48px',
              height: '16px'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2.66669 4.66669H13.3334M4.66669 8H11.3334M6.66669 11.3334H9.33335" stroke="#333333" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{
                width: '28px',
                height: '16px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 400,
                fontSize: '12px',
                lineHeight: '16px',
                color: '#333333'
              }}>Filter</span>
            </div>
          </button>
          
          {/* Percentage Button */}
          <button
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '5px',
              gap: '10px',
              width: '26px',
              height: '26px',
              background: '#FFFFFF',
              boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.25)',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '4px',
              width: '16px',
              height: '16px'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="4.66667" cy="4.66667" r="1.33333" stroke="#333333" strokeWidth="1.2"/>
                <circle cx="11.3333" cy="11.3333" r="1.33333" stroke="#333333" strokeWidth="1.2"/>
                <path d="M3.33331 12.6667L12.6666 3.33335" stroke="#333333" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
          </button>
          
          {/* Download Button */}
          <button
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '5px',
              gap: '10px',
              width: '26px',
              height: '26px',
              background: '#FFFFFF',
              boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.25)',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2.66669V10M8 10L10.6667 7.33335M8 10L5.33333 7.33335" stroke="#333333" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 12.6667H12" stroke="#333333" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        
        {/* View All */}
        <span style={{
          width: '57px',
          height: '22px',
          fontFamily: 'Outfit',
          fontStyle: 'normal',
          fontWeight: 500,
          fontSize: '16px',
          lineHeight: '22px',
          color: '#2563EB',
          cursor: 'pointer'
        }}>View All</span>
      </div>

      {/* Frame 1707486466 - Face Cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0px',
        gap: '10px',
        position: 'absolute',
        width: '392px',
        height: '62px',
        left: '20px',
        top: '174px',
        overflowX: 'scroll',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }} className="scrollbar-hide">
        {/* Frame 1707486465 - Monthly Equity Card */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px',
          gap: '10px',
          width: '156px',
          height: '62px',
          background: '#FFFFFF',
          borderRadius: '10px',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            gap: '10px',
            width: '136px',
            height: '44px'
          }}>
            {/* Frame 1686556430 - Label row */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '22px',
              width: '136px',
              height: '12px'
            }}>
              <span style={{
                width: '102px',
                height: '12px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '11px',
                lineHeight: '14px',
                color: '#404040'
              }}>MONTHLY EQUITY</span>
              <div style={{
                width: '12px',
                height: '12px',
                background: '#2563EB',
                borderRadius: '2px'
              }} />
            </div>
            
            {/* Frame 1686556429 - Value row */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '4px',
              width: '136px',
              height: '22px'
            }}>
              <span style={{
                width: '81px',
                height: '22px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '22px',
                color: '#000000'
              }}>{totals.monthlyEquity.toFixed(2)}</span>
              <span style={{
                width: '22px',
                height: '8px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '11px',
                lineHeight: '14px',
                color: '#404040'
              }}>USD</span>
            </div>
          </div>
        </div>

        {/* Frame 1707486464 - Lifetime Bonus OUT Card */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px',
          gap: '10px',
          width: '156px',
          height: '62px',
          background: '#FFFFFF',
          borderRadius: '10px',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            gap: '10px',
            width: '136px',
            height: '44px'
          }}>
            {/* Frame 1686556430 - Label row */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '22px',
              width: '136px',
              height: '12px'
            }}>
              <span style={{
                width: '102px',
                height: '12px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '11px',
                lineHeight: '14px',
                color: '#404040'
              }}>LIFETIME BONUS OUT</span>
              <div style={{
                width: '12px',
                height: '12px',
                background: '#2563EB',
                borderRadius: '2px'
              }} />
            </div>
            
            {/* Frame 1686556429 - Value row */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '4px',
              width: '136px',
              height: '22px'
            }}>
              <span style={{
                width: '83px',
                height: '22px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '22px',
                color: '#FF383C'
              }}>{totals.lifetimeBonusOut.toFixed(2)}</span>
              <span style={{
                width: '22px',
                height: '8px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '11px',
                lineHeight: '14px',
                color: '#404040'
              }}>USD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Group 1707486370 - Carousel Dots */}
      <div style={{
        position: 'absolute',
        width: '50px',
        height: '8px',
        left: 'calc(50% - 50px/2)',
        top: '246px',
        display: 'flex',
        gap: '14px',
        opacity: showMetrics ? 0 : 1
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          background: '#2563EB',
          border: '0.2px solid #F2F2F7',
          borderRadius: '50%',
          boxSizing: 'border-box'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          background: '#FFFFFF',
          border: '0.2px solid #F2F2F7',
          borderRadius: '50%',
          boxSizing: 'border-box'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          background: '#FFFFFF',
          border: '0.2px solid #F2F2F7',
          borderRadius: '50%',
          boxSizing: 'border-box'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          background: '#FFFFFF',
          border: '0.2px solid #F2F2F7',
          borderRadius: '50%',
          boxSizing: 'border-box'
        }} />
      </div>

      {/* Frame 1707486468 - Search & Navigation */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0px',
        gap: '4px',
        position: 'absolute',
        width: '372px',
        height: '36px',
        left: '20px',
        top: '274px',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }}>
        {/* Frame 1707486456 */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0px',
          gap: '10px',
          width: '292px',
          height: '36px'
        }}>
          {/* Frame 1707486442 - Search Input */}
          <div style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '6px 10px',
            gap: '10px',
            width: '246px',
            height: '36px',
            background: '#FFFFFF',
            border: '1px solid #EDEDED',
            boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05)',
            borderRadius: '8px'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '10px',
              width: '226px',
              height: '25px'
            }}>
              <input 
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '40px',
                  height: '24px',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '23px',
                  letterSpacing: '0.03em',
                  color: '#333333',
                  background: 'transparent',
                  flex: 1
                }}
              />
              <svg width="25" height="25" viewBox="0 0 25 25" fill="none">
                <circle cx="11" cy="11" r="7.5" stroke="#333333" strokeWidth="1"/>
                <path d="M16.5 16.5L20.5 20.5" stroke="#333333" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          
          {/* Frame 1707486443 - Columns Button */}
          <button 
            onClick={() => setShowColumnsModal(true)}
            style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '6px 10px',
              gap: '10px',
              width: '36px',
              height: '36px',
              background: '#EFF6FF',
              border: '1px solid #F2F2F7',
              boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05), inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '0px',
              gap: '10px',
              width: '16px',
              height: '16px'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 2H6V14H3V2Z" stroke="#333333" strokeWidth="1.2"/>
                <path d="M9 2H12V14H9V2Z" stroke="#333333" strokeWidth="1.2"/>
              </svg>
            </div>
          </button>
        </div>
        
        {/* Frame 1707486444 - Left Arrow */}
        <button 
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '6px 10px',
            gap: '10px',
            width: '36px',
            height: '36px',
            background: '#FFFFFF',
            border: '1px solid #F2F2F7',
            boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05), inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
            borderRadius: '8px',
            cursor: currentPage === 1 ? 'default' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1
          }}
        >
          <svg width="12" height="24" viewBox="0 0 12 24" fill="none" transform="matrix(-1, 0, 0, 1, 0, 0)">
            <path d="M3 6L9 12L3 18" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        {/* Frame 1707486445 - Right Arrow */}
        <button 
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '6px 10px',
            gap: '10px',
            width: '36px',
            height: '36px',
            background: '#FFFFFF',
            border: '1px solid #F2F2F7',
            boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05), inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
            borderRadius: '8px',
            cursor: currentPage === totalPages ? 'default' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1
          }}
        >
          <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
            <path d="M3 6L9 12L3 18" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Metrics View */}
      {showMetrics && (
        <MetricsView metrics={metricsData} onBack={() => { setShowMetrics(false); setActiveNav('clients') }} />
      )}

      {/* Frame 1707486467 - Table Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '0px',
        gap: '10px',
        isolation: 'isolate',
        position: 'absolute',
        width: '413px',
        height: '595px',
        left: '-1px',
        top: '330px',
        overflowY: 'scroll',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }}
      className="scrollbar-hide">
        {/* Table */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: '0px',
          width: '413px',
          height: '595px',
          overflowX: 'scroll',
          border: '1px solid #E0E0E0',
          borderRadius: '6px',
          background: '#FFFFFF'
        }} className="scrollbar-hide">
          {/* Login Column - Fixed */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            width: '63px',
            height: '595px',
            background: '#BFDBFE',
            flexShrink: 0
          }}>
            <div style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px',
              gap: '13.07px',
              width: '63px',
              height: '35px',
              background: '#EFF6FF',
              borderRight: '1px solid #BFDBFE',
              boxShadow: 'inset 0px -1.30687px 0px #E1E1E1'
            }}>
              <span style={{
                width: '31px',
                height: '15px',
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 600,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#404040'
              }}>Login</span>
            </div>
            {displayedClients.map((client, idx) => (
              <div 
                key={idx}
                onClick={() => onClientClick && onClientClick(client)}
                style={{
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '10px',
                  gap: '15.68px',
                  width: '63px',
                  height: '35px',
                  background: '#EFF6FF',
                  borderRight: '1px solid #BFDBFE',
                  boxShadow: 'inset 0px -0.931668px 0px #E1E1E1',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  padding: '0px',
                  gap: '13.07px',
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#2563EB'
                }}>{client.login}</div>
              </div>
            ))}
          </div>

          {/* Scrollable columns container */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            padding: '0px',
            overflowX: 'scroll'
          }} className="scrollbar-hide">
            {/* Balance Column */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0px',
              width: '70px',
              height: '595px',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                gap: '13.07px',
                width: '70px',
                height: '35px',
                background: '#F2F2F7',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  width: '50px',
                  height: '18px',
                  fontFamily: 'Poppins',
                  fontStyle: 'normal',
                  fontWeight: 600,
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: '#404040'
                }}>Balance</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '10px',
                    gap: '15.68px',
                    width: '70px',
                    height: '35px',
                    background: '#FFFFFF',
                    boxShadow: 'inset 0px -1.30687px 0px #E1E1E1'
                  }}
                >
                  <span style={{
                    fontFamily: 'Poppins',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '18px',
                    color: '#404040'
                  }}>{parseFloat(client.balance || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Floating Profit Column */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0px',
              width: '105px',
              height: '595px',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px',
                gap: '13.07px',
                width: '105px',
                height: '35px',
                background: '#F2F2F7',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  width: '85px',
                  height: '18px',
                  fontFamily: 'Poppins',
                  fontStyle: 'normal',
                  fontWeight: 600,
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: '#404040'
                }}>Floating Profit</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '10px',
                    gap: '15.68px',
                    width: '105px',
                    height: '35px',
                    background: '#FFFFFF',
                    boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
                  }}
                >
                  <span style={{
                    fontFamily: 'Poppins',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '18px',
                    color: '#404040'
                  }}>{parseFloat(client.floating_profit || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Equity Column */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0px',
              width: '58px',
              height: '595px',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                gap: '13.07px',
                width: '58px',
                height: '35px',
                background: '#F2F2F7',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  width: '38px',
                  height: '18px',
                  fontFamily: 'Poppins',
                  fontStyle: 'normal',
                  fontWeight: 600,
                  fontSize: '12px',
                  lineHeight: '18px',
                  color: '#404040'
                }}>Equity</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '10px',
                    gap: '15.68px',
                    width: '58px',
                    height: '35px',
                    background: '#FFFFFF',
                    boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
                  }}
                >
                  <span style={{
                    fontFamily: 'Poppins',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '18px',
                    color: '#404040'
                  }}>{parseFloat(client.equity || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Name Column */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '0px',
              width: '121px',
              height: '595px',
              flexShrink: 0
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                gap: '13.07px',
                width: '121px',
                height: '35px',
                background: '#F2F2F7',
                boxShadow: 'inset 0px -1.30687px 0px #E1E1E1'
              }}>
                <span style={{
                  width: '33px',
                  height: '15px',
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 600,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#404040'
                }}>Name</span>
              </div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: '10px',
                    gap: '15.68px',
                    width: '121px',
                    height: '35px',
                    background: '#FFFFFF',
                    boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
                  }}
                >
                  <span style={{
                    fontFamily: 'Outfit',
                    fontStyle: 'normal',
                    fontWeight: 400,
                    fontSize: '12px',
                    lineHeight: '15px',
                    color: '#404040'
                  }}>{client.name || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Frame 427319626 - Home Indicator */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '4px',
        gap: '10px',
        position: 'absolute',
        width: '372px',
        height: '14px',
        left: '0px',
        bottom: '0px',
        zIndex: 1
      }}>
        <div style={{
          width: '76px',
          height: '6px',
          background: '#E0E0E0',
          borderRadius: '40px'
        }} />
      </div>

      {/* Modals */}
      <CustomizeViewModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onFilterClick={() => {
          setShowCustomizeModal(false)
          setShowFilterModal(true)
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
          setFilters({})
        }}
        onApply={() => {
          setShowCustomizeModal(false)
        }}
      />

      <FilterModal
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        initialFilters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters)
          setShowFilterModal(false)
        }}
      />

      <ShowHideColumnsModal
        isOpen={showColumnsModal}
        onClose={() => setShowColumnsModal(false)}
        columns={[
          { id: 'login', label: 'Login' },
          { id: 'percentage', label: 'Percentage' },
          { id: 'floating', label: 'Floating Profit' },
          { id: 'volume', label: 'Volume' },
          { id: 'balance', label: 'Balance' },
          { id: 'credit', label: 'Credit' },
          { id: 'equity', label: 'Equity' },
          { id: 'name', label: 'Name' },
          { id: 'firstName', label: 'First Name' },
          { id: 'middleName', label: 'Middle Name' },
          { id: 'email', label: 'E Mail' },
          { id: 'phoneNo', label: 'Phone No' },
          { id: 'city', label: 'City' },
          { id: 'state', label: 'State' },
        ]}
        visibleColumns={visibleColumns}
        onApply={(columns) => {
          setVisibleColumns(columns)
          setShowColumnsModal(false)
        }}
      />

      <IBFilterModal
        isOpen={showIBFilterModal}
        onClose={() => setShowIBFilterModal(false)}
        onSelectIB={(ib) => {
          setSelectedIB(ib)
          setShowIBFilterModal(false)
        }}
      />

      <LoginGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        groups={groups || []}
        onCreateGroup={() => {
          setShowGroupsModal(false)
          setShowGroupModal?.(true)
          setEditingGroup?.(null)
        }}
        onEditGroup={(group) => {
          setShowGroupsModal(false)
          setShowGroupModal?.(true)
          setEditingGroup?.(group)
        }}
        onDeleteGroup={async (group) => {
          if (window.confirm(`Are you sure you want to delete group \"${group.name}\"?`)) {
            try {
              await deleteGroup?.(group.id)
            } catch (error) {
              console.error('Error deleting group:', error)
              alert('Failed to delete group')
            }
          }
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

export default MobileClientsViewNew
