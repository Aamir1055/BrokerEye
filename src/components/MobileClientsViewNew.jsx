import { useState, useEffect } from 'react'
import CustomizeViewModal from './CustomizeViewModal'
import IBFilterModal from './IBFilterModal'
import LoginGroupsModal from './LoginGroupsModal'

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
  const [currentTime, setCurrentTime] = useState('5:08')
  const [currentPage, setCurrentPage] = useState(1)
  const [showDrawer, setShowDrawer] = useState(false)
  const [activeNav, setActiveNav] = useState('clients')
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
        alignItems: 'center'
      }}>
        <span style={{
          fontFamily: 'Outfit',
          fontWeight: 600,
          fontSize: '17px',
          color: '#4B4B4B'
        }}>{currentTime}</span>
        
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
          <svg width="20" height="13" viewBox="0 0 20 13" fill="none">
            <rect x="0" y="2" width="4" height="9" rx="1" fill="#4B4B4B"/>
            <rect x="6" y="0" width="4" height="11" rx="1" fill="#4B4B4B"/>
            <rect x="12" y="3" width="4" height="8" rx="1" fill="#4B4B4B"/>
            <rect x="18" y="5" width="2" height="6" rx="1" fill="#4B4B4B"/>
          </svg>
          <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
            <path d="M1 6.5C1 6.5 4 1 9 1C14 1 17 6.5 17 6.5C17 6.5 14 12 9 12C4 12 1 6.5 1 6.5Z" stroke="#4B4B4B" strokeWidth="1.5"/>
            <circle cx="9" cy="6.5" r="2" fill="#4B4B4B"/>
          </svg>
          <div style={{ position: 'relative', width: '27px', height: '13px' }}>
            <rect width="25" height="13" rx="4" fill="none" stroke="#4B4B4B" strokeWidth="1" opacity="0.35"/>
            <rect x="2" y="2" width="21" height="9" rx="2.5" fill="#4B4B4B"/>
            <rect x="26" y="4.5" width="1.5" height="4" rx="0.75" fill="#4B4B4B" opacity="0.4"/>
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
          color: '#4B4B4B',
          margin: 0
        }}>{showMetrics ? 'Client Metrics' : 'Clients'}</h1>
        
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="#999999" strokeWidth="1.5"/>
          </svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" onClick={() => setShowCustomizeModal(true)} style={{cursor: 'pointer'}}>
            <rect x="4" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
            <rect x="11" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
            <rect x="18" y="7" width="5" height="10" stroke="#999999" strokeWidth="1.5"/>
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
        width: '372px',
        left: '20px',
        top: '374px',
        bottom: '81px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflowY: 'auto',
        opacity: showMetrics ? 0 : 1,
        pointerEvents: showMetrics ? 'none' : 'auto'
      }}>
        {/* Showing text */}
        <div style={{
          textAlign: 'center',
          fontFamily: 'Outfit',
          fontSize: '12px',
          fontWeight: 500,
          color: '#333333'
        }}>
          Showing {startIndex + 1}–{Math.min(endIndex, filteredClients.length)} of {filteredClients.length}
        </div>

        {/* Pagination buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
          <button 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '6px 14px',
              border: '1px solid #333333',
              borderRadius: '24px',
              background: 'transparent',
              fontFamily: 'Outfit',
              fontSize: '10px',
              fontWeight: 500,
              color: '#333333',
              opacity: currentPage === 1 ? 0.4 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          <button 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 14px',
              border: '1px solid #333333',
              borderRadius: '24px',
              background: 'transparent',
              fontFamily: 'Outfit',
              fontSize: '10px',
              fontWeight: 500,
              color: '#333333',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>

        {/* Table */}
        <div style={{
          width: '100%',
          border: '1px solid #F2F2F7',
          borderRadius: '6px',
          overflowX: 'auto',
          background: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', minWidth: '800px' }}>
            {/* Login Column */}
            <div style={{ width: '63px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '10px',
                background: '#EDEDED',
                borderBottom: '1.3px solid #E1E1E1',
                fontFamily: 'Outfit',
                fontSize: '12px',
                fontWeight: 600,
                color: '#333333'
              }}>Login</div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  onClick={() => onClientClick && onClientClick(client)}
                  style={{
                    padding: '10px',
                    background: '#FFFFFF',
                    borderBottom: '0.93px solid #E1E1E1',
                    fontFamily: 'Outfit',
                    fontSize: '12px',
                    color: '#2563EB',
                    cursor: 'pointer'
                  }}
                >{client.login}</div>
              ))}
            </div>

            {/* Balance Column */}
            <div style={{ width: '70px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '10px',
                background: '#EDEDED',
                borderBottom: '0.93px solid #E1E1E1',
                fontFamily: 'Poppins',
                fontSize: '12px',
                fontWeight: 600,
                color: '#333333'
              }}>Balance</div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px',
                    background: '#FFFFFF',
                    borderBottom: '0.93px solid #E1E1E1',
                    fontFamily: 'Poppins',
                    fontSize: '12px',
                    color: '#333333'
                  }}
                >{parseFloat(client.balance || 0).toFixed(2)}</div>
              ))}
            </div>

            {/* Floating Profit Column */}
            <div style={{ width: '105px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '10px',
                background: '#EDEDED',
                borderBottom: '0.93px solid #E1E1E1',
                fontFamily: 'Poppins',
                fontSize: '12px',
                fontWeight: 600,
                color: '#333333',
                textAlign: 'center'
              }}>Floating Profit</div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px',
                    background: '#FFFFFF',
                    borderBottom: '0.93px solid #E1E1E1',
                    fontFamily: 'Poppins',
                    fontSize: '12px',
                    color: '#333333'
                  }}
                >{parseFloat(client.floating_profit || 0).toFixed(2)}</div>
              ))}
            </div>

            {/* Equity Column */}
            <div style={{ width: '58px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '10px',
                background: '#EDEDED',
                borderBottom: '0.93px solid #E1E1E1',
                fontFamily: 'Poppins',
                fontSize: '12px',
                fontWeight: 600,
                color: '#333333'
              }}>Equity</div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px',
                    background: '#FFFFFF',
                    borderBottom: '0.93px solid #E1E1E1',
                    fontFamily: 'Poppins',
                    fontSize: '12px',
                    color: '#333333'
                  }}
                >{parseFloat(client.equity || 0).toFixed(2)}</div>
              ))}
            </div>

            {/* Name Column */}
            <div style={{ width: '121px', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                padding: '10px',
                background: '#EDEDED',
                borderBottom: '1.3px solid #E1E1E1',
                fontFamily: 'Outfit',
                fontSize: '12px',
                fontWeight: 600,
                color: '#333333',
                textAlign: 'center'
              }}>Name</div>
              {displayedClients.map((client, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '10px',
                    background: '#FFFFFF',
                    borderBottom: '0.93px solid #E1E1E1',
                    fontFamily: 'Outfit',
                    fontSize: '12px',
                    color: '#333333'
                  }}
                >{client.name || '-'}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '76px',
          height: '6px',
          background: '#F2F2F7',
          borderRadius: '40px'
        }} />
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '81px',
        background: '#FFFFFF',
        boxShadow: '0px 22.74px 133px -28.43px rgba(0, 0, 0, 0.2)',
        borderRadius: '20px',
        padding: '28px 37px',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        {/* Home */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#475467" strokeWidth="1.5"/>
          </svg>
        </button>
        {/* Clients */}
        <button onClick={() => { setShowMetrics(false); setActiveNav('clients') }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7" r="4" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5"/>
            <circle cx="15" cy="7" r="4" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5"/>
            <circle cx="9" cy="17" r="4" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5"/>
            <circle cx="15" cy="17" r="4" stroke={showMetrics ? '#475467' : '#2563EB'} strokeWidth="1.5"/>
          </svg>
          <span style={{ fontFamily: 'Outfit', fontSize: '14.56px', fontWeight: 600, color: showMetrics ? '#475467' : '#2563EB' }}>Clients</span>
        </button>
        {/* Metrics */}
        <button onClick={() => { setShowMetrics(true); setActiveNav('dashboard') }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 3V21L21 21" stroke="#4B4B4B" strokeWidth="1.5"/>
            <path d="M7 17V13M12 17V9M17 17V7" stroke="#4B4B4B" strokeWidth="1.5"/>
          </svg>
        </button>
        {/* More */}
        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="#4B4B4B" strokeWidth="1.5"/>
            <path d="M12 1V4M12 20V23M23 12H20M4 12H1M20.49 20.49L18.36 18.36M5.64 5.64L3.51 3.51M20.49 3.51L18.36 5.64M5.64 18.36L3.51 20.49" stroke="#4B4B4B" strokeWidth="1.5"/>
          </svg>
        </button>
      </div>

      {/* Modals */}
      <CustomizeViewModal
        isOpen={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onFilterClick={() => {
          setShowCustomizeModal(false)
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
        }}
        onApply={() => {
          setShowCustomizeModal(false)
        }}
      />

      <IBFilterModal
        isOpen={showIBFilterModal}
        onClose={() => setShowIBFilterModal(false)}
        ibList={[]}
        onApply={(selectedIBs) => {
          console.log('Selected IBs:', selectedIBs)
        }}
      />

      <LoginGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        groups={[]}
        onCreateGroup={() => {
          console.log('Create group clicked')
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
