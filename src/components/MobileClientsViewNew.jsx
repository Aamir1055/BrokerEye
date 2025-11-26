import { useState, useEffect } from 'react'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showCustomizeModal, setShowCustomizeModal] = useState(false)
  const [showIBFilterModal, setShowIBFilterModal] = useState(false)
  const [showGroupsModal, setShowGroupsModal] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showColumnsModal, setShowColumnsModal] = useState(false)
  const [currentTime, setCurrentTime] = useState('5:08')
  const [currentPage, setCurrentPage] = useState(1)
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeNav, setActiveNav] = useState('clients')
  const [filters, setFilters] = useState({})
  const [visibleColumns, setVisibleColumns] = useState(['login', 'percentage', 'floating', 'volume', 'balance', 'credit', 'equity', 'name'])
  const [showMetrics, setShowMetrics] = useState(false)
  const itemsPerPage = 10

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      setCurrentTime(`${hours}:${minutes.toString().padStart(2, '0')}`)
    }
    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Filter clients
  const filteredClients = (clients || []).filter(client => 
    client.login?.toString().includes(searchQuery) ||
    client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      {/* Status Bar */}
      <div style={{
        position: 'absolute',
        width: '372px',
        left: '20px',
        top: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10
      }}>
        <span style={{
          fontFamily: 'Outfit',
          fontWeight: 600,
          fontSize: '17px',
          lineHeight: '22px',
          color: '#4B4B4B'
        }}>{currentTime}</span>
        
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          {/* Cellular Connection */}
          <svg width="19.2" height="12.23" viewBox="0 0 20 13" fill="none">
            <rect x="0" y="5" width="3" height="8" rx="1" fill="#4B4B4B"/>
            <rect x="5" y="3" width="3" height="10" rx="1" fill="#4B4B4B"/>
            <rect x="10" y="1" width="3" height="12" rx="1" fill="#4B4B4B"/>
            <rect x="15" y="0" width="3" height="13" rx="1" fill="#4B4B4B"/>
          </svg>
          {/* WiFi */}
          <svg width="17.14" height="12.33" viewBox="0 0 18 13" fill="none">
            <path d="M9 13C9.828 13 10.5 12.328 10.5 11.5C10.5 10.672 9.828 10 9 10C8.172 10 7.5 10.672 7.5 11.5C7.5 12.328 8.172 13 9 13Z" fill="#4B4B4B"/>
            <path d="M9 7C11.21 7 13 8.79 13 11H13.5C13.5 8.515 11.485 6.5 9 6.5C6.515 6.5 4.5 8.515 4.5 11H5C5 8.79 6.79 7 9 7Z" fill="#4B4B4B"/>
            <path d="M9 3.5C13.142 3.5 16.5 6.858 16.5 11H17C17 6.582 13.418 3 9 3C4.582 3 1 6.582 1 11H1.5C1.5 6.858 4.858 3.5 9 3.5Z" fill="#4B4B4B"/>
          </svg>
          {/* Battery */}
          <div style={{ position: 'relative', width: '27.33px', height: '13px' }}>
            <div style={{
              position: 'absolute',
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
        left: '20px',
        top: '62px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setShowDrawer(true)}
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
        }}>{showMetrics ? 'Client Metrics' : 'Client Percentage'}</h1>
        
        <div style={{
          width: '36px',
          height: '36px',
          background: '#C4C4C4',
          borderRadius: '50%',
          boxShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)'
        }} />
      </div>

      {/* View All (hide in metrics view) */}
      <div style={{
        position: 'absolute',
        width: '372px',
        left: '20px',
        top: '138px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
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
          {/* Download icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{cursor: 'pointer'}}>
            <path d="M9 18L15 12L9 6" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          {/* Percentage icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{cursor: 'pointer'}}>
            <path d="M12 5V19M5 12H19" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          {/* Filter/Customize icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" onClick={() => setShowCustomizeModal(true)} style={{cursor: 'pointer'}}>
            <rect x="4" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
            <rect x="11" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
            <rect x="18" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          {/* Show/Hide Columns icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" onClick={() => setShowColumnsModal(true)} style={{cursor: 'pointer'}}>
            <path d="M4 6H20M4 12H20M4 18H20" stroke="#999999" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Face Cards (hide in metrics view) */}
      <div style={{
        position: 'absolute',
        width: '392px',
        left: '20px',
        top: '172px',
        display: 'flex',
        gap: '10px',
        overflowX: 'auto',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }} className="scrollbar-hide">
        {/* Monthly Equity Card */}
        <div style={{
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
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'Outfit',
              fontSize: '10px',
              fontWeight: 400,
              textTransform: 'uppercase',
              color: '#333333'
            }}>MONTHLY EQUITY</span>
            <div style={{ width: '12px', height: '12px', background: '#2563EB', borderRadius: '2px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontFamily: 'Outfit',
              fontSize: '18px',
              fontWeight: 700,
              color: '#34C759'
            }}>{totals.monthlyEquity.toFixed(2)}</span>
            <span style={{
              fontFamily: 'Outfit',
              fontSize: '10px',
              color: '#333333'
            }}>USD</span>
          </div>
        </div>

        {/* Lifetime Bonus Out Card */}
        <div style={{
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
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: 'Outfit',
              fontSize: '10px',
              fontWeight: 400,
              textTransform: 'uppercase',
              color: '#475467'
            }}>LIFETIME BONUS OUT</span>
            <div style={{ width: '12px', height: '12px', background: '#2563EB', borderRadius: '2px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontFamily: 'Outfit',
              fontSize: '18px',
              fontWeight: 700,
              color: '#999999'
            }}>{totals.lifetimeBonusOut.toFixed(2)}</span>
            <span style={{
              fontFamily: 'Outfit',
              fontSize: '10px',
              color: '#333333'
            }}>USD</span>
          </div>
        </div>
      </div>

      {/* Carousel Dots (hide in metrics view) */}
      <div style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: '264px',
        display: 'flex',
        gap: '6px',
        opacity: showMetrics ? 0 : 1
      }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563EB' }} />
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.2)' }} />
      </div>

      {/* Search & Columns (hide in metrics view) */}
      <div style={{
        position: 'absolute',
        width: '372px',
        left: '20px',
        top: '294px',
        display: 'flex',
        gap: '10px',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }}>
        <div style={{
          flex: 1,
          height: '44px',
          background: '#FFFFFF',
          border: '1px solid #E6EEF8',
          boxShadow: '0px 0px 50px rgba(0, 0, 0, 0.05)',
          borderRadius: '12px',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#4B4B4B" strokeWidth="1.5"/>
            <path d="M13 13L16 16" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input 
            type="text"
            placeholder="Search by Login, Name and Email....."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontFamily: 'Outfit',
              fontSize: '12px',
              color: '#333333',
              background: 'transparent'
            }}
          />
        </div>
        
        <button 
          onClick={() => setShowCustomizeModal(true)}
          style={{
            width: '93px',
            height: '44px',
            background: 'rgba(230, 238, 248, 0.44)',
            border: '1px solid #F2F2F7',
            boxShadow: '0px 0px 50px rgba(0, 0, 0, 0.05)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="2" width="3" height="12" stroke="#999999" strokeWidth="1.5"/>
            <rect x="9" y="2" width="3" height="12" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          <span style={{
            fontFamily: 'Outfit',
            fontSize: '12px',
            color: '#333333'
          }}>Columns</span>
        </button>
      </div>

      {/* Metrics View */}
      {showMetrics && (
        <MetricsView metrics={metricsData} onBack={() => { setShowMetrics(false); setActiveNav('clients') }} />
      )}

      {/* Pagination & Table Container (hide when metrics) */}
      <div style={{
        position: 'absolute',
        width: '406px',
        left: '3px',
        top: '293px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px',
        overflowY: 'scroll',
        overflowX: 'hidden',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }}
      className="scrollbar-hide">
        {/* Table */}
        <div style={{
          width: '406px',
          border: '1px solid #ECECEC',
          borderRadius: '6px',
          display: 'flex',
          isolation: 'isolate',
          background: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', overflowX: 'scroll' }} className="scrollbar-hide">
            {/* Login Column - Fixed */}
            <div style={{ minWidth: '53px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #BFDBFE' }}>
              <div style={{
                padding: '10px',
                background: '#EFF6FF',
                boxShadow: 'inset 0px -1.3px 0px #E1E1E1',
                borderRight: '1px solid #BFDBFE',
                fontFamily: 'Outfit',
                fontSize: '12px',
                fontWeight: 600,
                color: '#4B4B4B',
                minHeight: '35px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>Login</div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  onClick={() => onClientClick && onClientClick(client)}
                  style={{
                    padding: '10px',
                    background: '#EFF6FF',
                    boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                    borderRight: '1px solid #BFDBFE',
                    fontFamily: 'Outfit',
                    fontSize: '12px',
                    color: '#2563EB',
                    cursor: 'pointer',
                    minHeight: '35px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start'
                  }}
                >{client.login}</div>
              ))}
            </div>

            {/* Scrollable Columns Container */}
            <div style={{ display: 'flex', overflowX: 'scroll' }} className="scrollbar-hide">
              {/* Percentage Column */}
              <div style={{ minWidth: '91px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                  fontFamily: 'Poppins',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center'
                }}>Percentage</div>
                {displayedClients.map((client, idx) => {
                  const percentage = parseFloat(client.percentage || Math.random() * 200 - 100);
                  const isPositive = percentage >= 0;
                  return (
                    <div 
                      key={idx}
                      style={{
                        padding: '10px',
                        background: '#FFFFFF',
                        boxShadow: 'inset 0px -1.3px 0px #E1E1E1',
                        fontFamily: 'Poppins',
                        fontSize: '12px',
                        color: isPositive ? '#34C759' : '#FF383C',
                        minHeight: '35px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >{percentage.toFixed(0)}%</div>
                  );
                })}
              </div>

              {/* Floating Profit Column */}
              <div style={{ minWidth: '105px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                  fontFamily: 'Poppins',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>Floating Profit</div>
                {displayedClients.map((client, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '10px',
                      background: '#FFFFFF',
                      boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                      fontFamily: 'Poppins',
                      fontSize: '12px',
                      color: '#4B4B4B',
                      minHeight: '35px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >{parseFloat(client.floating_profit || 0).toFixed(2)}</div>
                ))}
              </div>

              {/* Volume Column */}
              <div style={{ minWidth: '68px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                  fontFamily: 'Poppins',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center'
                }}>Volume</div>
                {displayedClients.map((client, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '10px',
                      background: '#FFFFFF',
                      boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                      fontFamily: 'Poppins',
                      fontSize: '12px',
                      color: '#4B4B4B',
                      minHeight: '35px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >{parseFloat(client.volume || 0).toFixed(2)}</div>
                ))}
              </div>

              {/* Balance Column */}
              <div style={{ minWidth: '72px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                  fontFamily: 'Poppins',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center'
                }}>Balance</div>
                {displayedClients.map((client, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '10px',
                      background: '#FFFFFF',
                      boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                      fontFamily: 'Poppins',
                      fontSize: '12px',
                      color: '#4B4B4B',
                      minHeight: '35px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >{parseFloat(client.balance || 0).toFixed(2)}</div>
                ))}
              </div>

              {/* Credit Column */}
              <div style={{ minWidth: '62px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                  fontFamily: 'Poppins',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center'
                }}>Credit</div>
                {displayedClients.map((client, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '10px',
                      background: '#FFFFFF',
                      boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                      fontFamily: 'Poppins',
                      fontSize: '12px',
                      color: '#4B4B4B',
                      minHeight: '35px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >{parseFloat(client.credit || 0).toFixed(2)}</div>
                ))}
              </div>

              {/* Equity Column */}
              <div style={{ minWidth: '58px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                  fontFamily: 'Poppins',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center'
                }}>Equity</div>
                {displayedClients.map((client, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '10px',
                      background: '#FFFFFF',
                      boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                      fontFamily: 'Poppins',
                      fontSize: '12px',
                      color: '#4B4B4B',
                      minHeight: '35px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >{parseFloat(client.equity || 0).toFixed(2)}</div>
                ))}
              </div>

              {/* Name Column */}
              <div style={{ minWidth: '121px', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '10px',
                  background: '#F8F8F8',
                  boxShadow: 'inset 0px -1.3px 0px #E1E1E1',
                  fontFamily: 'Outfit',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#4B4B4B',
                  minHeight: '35px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>Name</div>
                {displayedClients.map((client, idx) => (
                  <div 
                    key={idx}
                    style={{
                      padding: '10px',
                      background: '#FFFFFF',
                      boxShadow: 'inset 0px -0.93px 0px #E1E1E1',
                      fontFamily: 'Outfit',
                      fontSize: '12px',
                      color: '#4B4B4B',
                      minHeight: '35px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >{client.name || '-'}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '81px',
        background: '#FFFFFF',
        boxShadow: '0px 22.74px 133px -28.43px rgba(0, 0, 0, 0.2)',
        borderRadius: '20px 20px 0 0',
        padding: '15px 37px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20
      }}>
        {/* Home */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#475467" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22V12H15V22" stroke="#475467" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* Clients */}
        <button onClick={() => { setShowMetrics(false); setActiveNav('clients') }} style={{ background: showMetrics ? 'none' : 'rgba(37, 99, 235, 0.1)', border: 'none', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="3.5" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5"/>
            <path d="M3 21C3 17.686 5.686 15 9 15C10.015 15 10.974 15.228 11.832 15.633" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="17" cy="10" r="3" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5"/>
            <path d="M21 20C21 17.794 19.206 16 17 16C16.126 16 15.319 16.306 14.691 16.814" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: 'Outfit', fontSize: '14.56px', fontWeight: 600, color: showMetrics ? '#475467' : '#2563EB' }}>Clients</span>
        </button>
        {/* Metrics */}
        <button onClick={() => { setShowMetrics(true); setActiveNav('dashboard') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 3V21H21" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 17V13M12 17V9M17 17V7" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {/* More */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 5 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="2.5" stroke="#4B4B4B" strokeWidth="1.5"/>
            <path d="M12 1V4M12 20V23M23 12H20M4 12H1M20.49 20.49L18.36 18.36M5.64 5.64L3.51 3.51M20.49 3.51L18.36 5.64M5.64 18.36L3.51 20.49" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        
        {/* Home Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '134px',
          height: '5px',
          background: '#000000',
          borderRadius: '100px'
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
          console.log('Applied filters:', newFilters)
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
          console.log('Visible columns:', columns)
        }}
      />

      <IBFilterModal
        isOpen={showIBFilterModal}
        onClose={() => setShowIBFilterModal(false)}
        onSelectIB={(ib) => {
          console.log('Selected IB:', ib)
        }}
      />

      <LoginGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        groups={[]}
        onCreateGroup={() => {
          console.log('Create new group')
        }}
        onEditGroup={(group) => {
          console.log('Edit group:', group)
        }}
        onDeleteGroup={(group) => {
          console.log('Delete group:', group)
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
