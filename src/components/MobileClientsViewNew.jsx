import { useState } from 'react'

const MobileClientsViewNew = ({ clients = [], onClientClick }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Sample card data - replace with real data later
  const faceCards = [
    { id: 1, label: 'MONTHLY EQUITY', amount: '4,99,514', trend: 'up', percent: '12.0%', color: 'green' },
    { id: 2, label: 'MONTHLY EQUITY', amount: '4,99,514', trend: 'down', percent: '12.0%', color: 'red' },
    { id: 3, label: 'MONTHLY EQUITY', amount: '4,99,514', trend: 'down', percent: '12.0%', color: 'red' },
    { id: 4, label: 'DAILY NET D/W', amount: '4,99,514', trend: 'up', percent: '12.0%', color: 'green' }
  ]

  const [visibleColumns, setVisibleColumns] = useState({
    login: true,
    balance: true,
    floatingProfit: true,
    equity: true,
    name: true
  })

  const toggleColumn = (column) => {
    setVisibleColumns(prev => ({ ...prev, [column]: !prev[column] }))
  }

  const FaceCard = ({ card }) => {
    const isGreen = card.color === 'green'
    const isRed = card.color === 'red'
    const gradientId = `gradient-${card.id}`
    
    // Determine color based on card data
    const textColor = isRed ? '#FF383C' : isGreen ? '#34C759' : '#000000'
    
    return (
      <div style={{
        boxSizing: 'border-box',
        width: '156px',
        height: '62px',
        background: '#FFFFFF',
        borderRadius: '10px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flex: 'none'
      }}>
        {/* Top Section */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          width: '136px'
        }}>
          {/* Label + Icon Row */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            height: '12px'
          }}>
            <span style={{
              fontFamily: 'Outfit',
              fontStyle: 'normal',
              fontWeight: 500,
              fontSize: '11px',
              lineHeight: '14px',
              color: '#404040'
            }}>{card.label}</span>
            
            {/* Blue icon square */}
            <div style={{
              width: '12px',
              height: '12px',
              background: '#2563EB'
            }}></div>
          </div>
          
          {/* Amount Row */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '4px',
            height: '22px'
          }}>
            <span style={{
              fontFamily: 'Outfit',
              fontStyle: 'normal',
              fontWeight: 500,
              fontSize: '16px',
              lineHeight: '22px',
              color: textColor
            }}>{card.amount}</span>
            <span style={{
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
    )
  }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: '412px',
      minWidth: '375px',
      height: '100vh',
      margin: '0 auto',
      background: '#F2F2F7',
      fontFamily: 'Outfit, sans-serif',
      overflow: 'hidden',
      borderRadius: '20px'
    }}>
      {/* Rectangle 41868 - Header */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '76px',
        left: '0px',
        top: '0px',
        background: '#FFFFFF',
        boxShadow: '0px 3.64486px 44.9229px rgba(0, 0, 0, 0.05)',
        borderRadius: '20px'
      }}>
        {/* Frame 1707486430 - Main Header Row */}
        <div style={{
          position: 'absolute',
          width: 'calc(100% - 40px)',
          height: '36px',
          left: '20px',
          top: '20px',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0px',
          gap: '0px'
        }}>
          {/* Hamburger Menu */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '11px 8px',
              width: '36px',
              height: '36px',
              background: 'rgba(230, 238, 248, 0.44)',
              boxShadow: 'inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              flex: 'none'
            }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M0 4.975C0 4.7164 0.09877 4.4684 0.27459 4.2856C0.4504 4.1027 0.68886 4 0.9375 4H19.0625C19.3111 4 19.5496 4.1027 19.7254 4.2856C19.9012 4.4684 20 4.7164 20 4.975C20 5.2336 19.9012 5.4816 19.7254 5.6644C19.5496 5.8473 19.3111 5.95 19.0625 5.95H0.9375C0.68886 5.95 0.4504 5.8473 0.27459 5.6644C0.09877 5.4816 0 5.2336 0 4.975ZM0 10.5C0 10.2414 0.09877 9.9934 0.27459 9.8106C0.4504 9.6277 0.68886 9.525 0.9375 9.525H19.0625C19.3111 9.525 19.5496 9.6277 19.7254 9.8106C19.9012 9.9934 20 10.2414 20 10.5C20 10.7586 19.9012 11.0066 19.7254 11.1894C19.5496 11.3723 19.3111 11.475 19.0625 11.475H0.9375C0.68886 11.475 0.4504 11.3723 0.27459 11.1894C0.09877 11.0066 0 10.7586 0 10.5ZM0.9375 15.05C0.68886 15.05 0.4504 15.1527 0.27459 15.3356C0.09877 15.5184 0 15.7664 0 16.025C0 16.2836 0.09877 16.5316 0.27459 16.7144C0.4504 16.8973 0.68886 17 0.9375 17H19.0625C19.3111 17 19.5496 16.8973 19.7254 16.7144C19.9012 16.5316 20 16.2836 20 16.025C20 15.7664 19.9012 15.5184 19.7254 15.3356C19.5496 15.1527 19.3111 15.05 19.0625 15.05H0.9375Z" fill="#404040"/>
            </svg>
          </button>

          {/* Clients Title */}
          <span style={{
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
            color: '#000000'
          }}>
            Clients
          </span>

          {/* Profile Picture */}
          <div style={{
            position: 'absolute',
            width: '36px',
            height: '36px',
            right: '0px',
            top: '0px',
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)'
          }}>
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces" 
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <>
          {/* Dark Overlay */}
          <div 
            onClick={() => setIsSidebarOpen(false)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.35)',
              borderRadius: '20px',
              zIndex: 999
            }}
          />
          
          {/* Sidebar Panel */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '302px',
            height: '917px',
            background: '#FFFFFF',
            borderRadius: '20px',
            zIndex: 1000,
            boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
          }}>
            {/* Broker Eyes Logo Section */}
            <div style={{
              position: 'absolute',
              left: '24px',
              top: '31px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {/* Logo Background */}
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(180deg, rgba(26,99,188,0.6) 0%, #1A63BC 100%)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* Logo Icon */}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.8792 10.4677C17.9962 6.6101 14.2684 4 10 4C5.7316 4 2.0028 6.6119 0.1208 10.4681C0.0414 10.633 0 10.8153 0 11.0002C0 11.185 0.0414 11.3673 0.1208 11.5323C2.0038 15.3899 5.7316 18 10 18C14.2684 18 17.9972 15.3881 19.8792 11.5319C19.9586 11.3669 20 11.1847 20 10.9998C20 10.815 19.9586 10.6327 19.8792 10.4677ZM10 16.25C9.0111 16.25 8.0444 15.9421 7.2221 15.3652C6.3999 14.7883 5.759 13.9684 5.3806 13.0091C5.0022 12.0498 4.9031 10.9942 5.0961 9.9758C5.289 8.9574 5.7652 8.0219 6.4645 7.2877C7.1637 6.5535 8.0546 6.0534 9.0245 5.8509C9.9945 5.6483 10.9998 5.7523 11.9134 6.1496C12.8271 6.547 13.6079 7.2199 14.1574 8.0833C14.7068 8.9466 15 9.9616 15 11C15.0003 11.6895 14.8712 12.3724 14.6201 13.0095C14.3689 13.6466 14.0006 14.2255 13.5363 14.7131C13.0719 15.2006 12.5206 15.5873 11.9138 15.8511C11.307 16.1148 10.6567 16.2503 10 16.25ZM10 7.5C9.7025 7.5044 9.4069 7.5508 9.1212 7.6382C9.3567 7.9742 9.4697 8.3877 9.4397 8.8037C9.4097 9.2197 9.2388 9.6107 8.9578 9.9057C8.6769 10.2007 8.3045 10.3802 7.9083 10.4117C7.5121 10.4432 7.1183 10.3245 6.7983 10.0772C6.616 10.7822 6.6489 11.5294 6.8923 12.2137C7.1357 12.898 7.5773 13.4849 8.1551 13.8919C8.7328 14.2988 9.4175 14.5053 10.1128 14.4822C10.8082 14.4591 11.4791 14.2077 12.0312 13.7633C12.5833 13.3189 12.9888 12.7038 13.1906 12.0048C13.3923 11.3057 13.3803 10.5578 13.156 9.8664C12.9318 9.1749 12.5066 8.5747 11.9405 8.1502C11.3744 7.7257 10.6957 7.4983 10 7.5Z" fill="white"/>
                </svg>
              </div>
              
              {/* Text Container */}
              <div>
                <div style={{
                  fontFamily: 'Outfit',
                  fontWeight: 600,
                  fontSize: '16px',
                  lineHeight: '20px',
                  color: '#404040'
                }}>
                  Broker Eyes
                </div>
                <div style={{
                  fontFamily: 'Outfit',
                  fontWeight: 500,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#64748B'
                }}>
                  Trading Platform
                </div>
              </div>
            </div>

            {/* Separator Line */}
            <div style={{
              position: 'absolute',
              width: '302px',
              height: '1px',
              left: 0,
              top: '92px',
              border: '1px solid #ECECEC'
            }} />

            {/* Navigation Container */}
            <div style={{
              position: 'absolute',
              left: '24px',
              top: '112px',
              width: '202px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* Dashboard */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" fill="#333333"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" fill="#333333"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" fill="#333333"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" fill="#333333"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#333333'
                }}>Dashboard</span>
              </div>

              {/* Clients - Active State */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                background: '#EFF6FF',
                border: '1px solid #E0E0E0',
                boxShadow: 'inset 0px 2px 2px rgba(155,151,151,0.2)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="10" cy="8" r="2" stroke="#2563EB" strokeWidth="1.5"/>
                  <path d="M7 13C7 12.448 7.448 12 8 12H12C12.552 12 13 12.448 13 13V15" stroke="#2563EB" strokeWidth="1.5"/>
                  <path d="M8 11L8 10M12 11L12 10" stroke="#2563EB" strokeWidth="1.5"/>
                  <circle cx="16" cy="8" r="2" stroke="#2563EB" strokeWidth="1.5"/>
                  <path d="M13 13C13 12.448 13.448 12 14 12H18C18.552 12 19 12.448 19 13V15" stroke="#2563EB" strokeWidth="1.5"/>
                  <path d="M14 11L14 10M18 11L18 10" stroke="#2563EB" strokeWidth="1.5"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 700,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#2563EB'
                }}>Clients</span>
              </div>

              {/* Pending Orders */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="1.5" fill="#333333"/>
                  <circle cx="18" cy="12" r="1.5" fill="#333333"/>
                  <circle cx="6" cy="12" r="1.5" fill="#333333"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#333333'
                }}>Pending Orders</span>
              </div>

              {/* Margin Level */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 17L9 11L13 15L21 7" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#333333'
                }}>Margin Level</span>
              </div>

              {/* Live Dealing */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                background: '#FFFFFF',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="#404040" strokeWidth="1.5"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#404040'
                }}>Live Dealing</span>
              </div>

              {/* Client Percentage */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8" stroke="#404040" strokeWidth="1.5"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 500,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#404040'
                }}>Client Percentage</span>
              </div>

              {/* IB Commissions */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="8" y="6" width="8" height="12" rx="1" stroke="#333333" strokeWidth="1.5"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#333333'
                }}>IB Commissions</span>
              </div>

              {/* Settings */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                borderRadius: '8px',
                cursor: 'pointer',
                marginTop: '309px'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="#333333" strokeWidth="1.5"/>
                  <path d="M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z" stroke="#333333" strokeWidth="1.5"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 400,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#333333'
                }}>Settings</span>
              </div>

              {/* Logout */}
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px 20px',
                gap: '10px',
                width: '202px',
                height: '44px',
                background: '#FFFFFF',
                borderRadius: '8px',
                cursor: 'pointer'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17L21 12L16 7" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12H9" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{
                  fontFamily: 'Outfit',
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: '20px',
                  letterSpacing: '0.06em',
                  textTransform: 'capitalize',
                  color: '#4B4B4B'
                }}>Logout</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Filter, Percentage, Download Buttons Row - Compact Design */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0px',
        position: 'absolute',
        width: 'calc(100% - 40px)',
        height: '26px',
        left: '20px',
        top: '96px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Filter Button - Compact with text */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '5px 8px',
              gap: '4px',
              width: '68px',
              height: '26px',
              background: '#FFFFFF',
              border: '1px solid #ECECEC',
              boxShadow: '0px 0px 8px rgba(75, 75, 75, 0.04)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1.75 4.08333H12.25M3.5 7H10.5M5.25 9.91667H8.75" stroke="#4B4B4B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontFamily: 'Outfit',
              fontStyle: 'normal',
              fontWeight: 400,
              fontSize: '11px',
              lineHeight: '14px',
              color: '#4B4B4B'
            }}>
              Filter
            </span>
          </button>

          {/* Percentage Button - Icon only */}
          <button style={{
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '5px',
            width: '26px',
            height: '26px',
            background: '#FFFFFF',
            border: '1px solid #ECECEC',
            boxShadow: '0px 0px 8px rgba(75, 75, 75, 0.04)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5.30323 6.27602C5.64825 6.27602 5.98437 6.17283 6.27549 5.97833C6.56661 5.78383 6.79758 5.50604 6.94226 5.17844C7.08694 4.85084 7.13936 4.48553 7.09364 4.12962C7.04792 3.77372 6.90608 3.43944 6.68623 3.16959C6.46638 2.89974 6.17863 2.70346 5.85629 2.60021C5.53396 2.49695 5.18817 2.49092 4.86271 2.58271C4.53725 2.6745 4.24327 2.86036 4.01041 3.12196C3.77755 3.38357 3.61323 3.71036 3.53323 4.06602C3.45323 4.42168 3.45974 4.79327 3.55219 5.14559C3.64463 5.49792 3.82023 5.81872 4.06092 6.07279C4.30162 6.32686 4.59968 6.50486 4.92466 6.58768C5.24964 6.6705 5.58894 6.65548 5.90685 6.54402M10.6968 11.724C11.0418 11.724 11.3779 11.6208 11.669 11.4263C11.9601 11.2318 12.1911 10.954 12.3358 10.6264C12.4805 10.2988 12.5329 9.93347 12.4872 9.57757C12.4415 9.22166 12.2996 8.88739 12.0798 8.61754C11.8599 8.34769 11.5722 8.1514 11.2498 8.04815C10.9275 7.94489 10.5817 7.93887 10.2562 8.03065C9.93076 8.12244 9.63678 8.30831 9.40392 8.56991C9.17106 8.83151 9.00675 9.1583 8.92675 9.51397C8.84675 9.86963 8.85325 10.2412 8.9457 10.5935C9.03814 10.9459 9.21374 11.2667 9.45443 11.5207C9.69513 11.7748 9.99319 11.9528 10.3182 12.0356C10.6431 12.1185 10.9824 12.1034 11.3003 11.992M12.2735 2.51184C12.1661 2.39517 12.0241 2.33343 11.8749 2.33343C11.7257 2.33343 11.5837 2.39517 11.4763 2.51184L3.28018 10.7079C3.22691 10.7602 3.18416 10.823 3.15469 10.8926C3.12522 10.9622 3.10959 11.0373 3.10869 11.1133C3.10779 11.1894 3.12164 11.2648 3.14939 11.3351C3.17714 11.4053 3.21824 11.4691 3.27024 11.5227C3.32224 11.5763 3.38421 11.619 3.45314 11.6484C3.52207 11.6778 3.59654 11.6933 3.67202 11.6941C3.74749 11.6949 3.82229 11.6811 3.89184 11.6534C3.96138 11.6257 4.02428 11.5848 4.07768 11.5326L12.2735 3.33601C12.3902 3.22863 12.4519 3.08663 12.4519 2.93726C12.4519 2.78789 12.3902 2.64589 12.2735 2.51184Z" fill="#4B4B4B"/>
            </svg>
          </button>

        {/* Download Button - Icon only */}
        <button style={{
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '5px',
          width: '26px',
          height: '26px',
          background: '#FFFFFF',
          border: '1px solid #ECECEC',
          boxShadow: '0px 0px 8px rgba(75, 75, 75, 0.04)',
          borderRadius: '6px',
          cursor: 'pointer'
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M12.25 8.75V11.0833C12.25 11.3928 12.1271 11.6895 11.9083 11.9083C11.6895 12.1271 11.3928 12.25 11.0833 12.25H2.91667C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833V8.75M4.08333 5.83333L7 8.75M7 8.75L9.91667 5.83333M7 8.75V1.75" stroke="#4B4B4B" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        </div>

        {/* View All Link */}
        <div style={{
          fontFamily: 'Outfit',
          fontStyle: 'normal',
          fontWeight: 400,
          fontSize: '11px',
          lineHeight: '14px',
          color: '#2563EB',
          cursor: 'pointer'
        }}>
          View All
        </div>
      </div>

      {/* Face Cards Section - Horizontal Scrollable */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0px',
        gap: '10px',
        position: 'absolute',
        width: 'calc(100% - 40px)',
        left: '20px',
        top: '132px',
        overflowX: 'auto',
        overflowY: 'hidden'
      }} className="scrollbar-hide">
        <FaceCard card={faceCards[0]} />
        <FaceCard card={faceCards[1]} />
        <FaceCard card={faceCards[2]} />
        <FaceCard card={faceCards[3]} />
      </div>

      {/* Pagination Dots */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0px',
        gap: '6px',
        position: 'absolute',
        width: '50px',
        height: '8px',
        left: 'calc(50% - 25px)',
        top: '204px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          background: '#2563EB',
          borderRadius: '50%'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          background: '#FFFFFF',
          border: '1px solid #E5E5EA',
          borderRadius: '50%'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          background: '#FFFFFF',
          border: '1px solid #E5E5EA',
          borderRadius: '50%'
        }} />
        <div style={{
          width: '8px',
          height: '8px',
          background: '#FFFFFF',
          border: '1px solid #E5E5EA',
          borderRadius: '50%'
        }} />
      </div>

      {/* Search Input */}
      <div style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '6px 10px',
        gap: '10px',
        position: 'absolute',
        width: 'calc(100% - 133px)',
        height: '42px',
        left: '20px',
        top: '232px',
        background: '#FFFFFF',
        border: '1px solid #ECECEC',
        boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05)',
        borderRadius: '8px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0px',
          gap: '10px',
          width: '100%',
          height: '24px'
        }}>
          {/* Search Icon */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M13.5233 14.4628L16.7355 17.6742L15.6742 18.7355L12.4628 15.5233C11.2678 16.4812 9.7815 17.0022 8.25 17C4.524 17 1.5 13.976 1.5 10.25C1.5 6.524 4.524 3.5 8.25 3.5C11.976 3.5 15 6.524 15 10.25C15.0022 11.7815 14.4812 13.2678 13.5233 14.4628ZM12.0187 13.9062C12.9704 12.9273 13.5019 11.6153 13.5 10.25C13.5 7.3498 11.1503 5 8.25 5C5.3498 5 3 7.3498 3 10.25C3 13.1503 5.3498 15.5 8.25 15.5C9.6153 15.5019 10.9273 14.9704 11.9062 14.0187L12.0187 13.9062Z" fill="#4B4B4B"/>
          </svg>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by Login, Name and Email....."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '208px',
              height: '24px',
              fontFamily: 'Outfit',
              fontStyle: 'normal',
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '23px',
              letterSpacing: '0.03em',
              color: '#4B4B4B',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              flex: 'none',
              order: 1,
              flexGrow: 0
            }}
          />
        </div>
      </div>

      {/* Columns Button */}
      <div onClick={() => setIsColumnsModalOpen(true)} style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '6px 10px',
        gap: '10px',
        position: 'absolute',
        width: '93px',
        height: '42px',
        right: '20px',
        top: '232px',
        background: '#F4F8FC',
        border: '1px solid #ECECEC',
        boxShadow: '0px 0px 12px rgba(75, 75, 75, 0.05), inset 0px 2px 2px rgba(155, 151, 151, 0.2)',
        borderRadius: '8px',
        cursor: 'pointer'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          padding: '0px',
          gap: '10px',
          width: '74px',
          height: '24px'
        }}>
          {/* Columns Icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4H3.5C3.23478 4 2.98043 4.10536 2.79289 4.29289C2.60536 4.48043 2.5 4.73478 2.5 5V15C2.5 15.2652 2.60536 15.5196 2.79289 15.7071C2.98043 15.8946 3.23478 16 3.5 16H6C6.26522 16 6.51957 15.8946 6.70711 15.7071C6.89464 15.5196 7 15.2652 7 15V5C7 4.73478 6.89464 4.48043 6.70711 4.29289C6.51957 4.10536 6.26522 4 6 4ZM6 15H3.5V5H6V15ZM11.5 4H9C8.73478 4 8.48043 4.10536 8.29289 4.29289C8.10536 4.48043 8 4.73478 8 5V15C8 15.2652 8.10536 15.5196 8.29289 15.7071C8.48043 15.8946 8.73478 16 9 16H11.5C11.7652 16 12.0196 15.8946 12.2071 15.7071C12.3946 15.5196 12.5 15.2652 12.5 15V5C12.5 4.73478 12.3946 4.48043 12.2071 4.29289C12.0196 4.10536 11.7652 4 11.5 4ZM11.5 15H9V5H11.5V15Z" fill="#4B4B4B"/>
          </svg>

          {/* Columns Text */}
          <span style={{
            width: '48px',
            height: '24px',
            fontFamily: 'Outfit',
            fontStyle: 'normal',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: '23px',
            letterSpacing: '0.03em',
            color: '#4B4B4B'
          }}>
            Columns
          </span>
        </div>
      </div>

      {/* Frame 1707486434 - Data Table Container */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '0px',
        gap: '10px',
        position: 'absolute',
        width: 'calc(100% - 40px)',
        height: 'calc(100vh - 314px)',
        left: '20px',
        top: '294px'
      }}>
        {/* Pagination Controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0px',
          width: '100%',
          height: '25px',
          flex: 'none',
          order: 0,
          alignSelf: 'stretch',
          flexGrow: 0
        }}>
          {/* Showing text */}
          <span style={{
            fontFamily: 'Outfit',
            fontStyle: 'normal',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: '15px',
            color: '#666666'
          }}>
            Showing 1–10 of 533
          </span>

          {/* Pagination buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '10px'
          }}>
            {/* Previous button */}
            <button style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '6px 14px',
              gap: '16px',
              width: '66px',
              height: '25px',
              opacity: 0.4,
              border: '1px solid #344459',
              borderRadius: '24px',
              background: 'transparent',
              cursor: 'not-allowed'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '10px',
                lineHeight: '13px',
                textAlign: 'center',
                color: '#344459'
              }}>Previous</span>
            </button>

            {/* Next button */}
            <button style={{
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              padding: '6px 14px',
              gap: '16px',
              width: '50px',
              height: '25px',
              border: '1px solid #344459',
              borderRadius: '24px',
              background: 'transparent',
              cursor: 'pointer'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: '10px',
                lineHeight: '13px',
                textAlign: 'center',
                color: '#344459'
              }}>Next</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          padding: '0px',
          width: '100%',
          height: 'calc(100vh - 359px)',
          overflowX: 'scroll',
          borderRadius: '6px',
          flex: 'none',
          order: 1,
          alignSelf: 'stretch',
          flexGrow: 0
        }} className="scrollbar-hide">
          {/* Sample table data - replace with real data */}
          {/* Login Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            width: '63px',
            height: '420px',
            flex: 'none',
            order: 0,
            flexGrow: 0
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px',
              width: '63px',
              height: '35px',
              background: '#1A63BC',
              boxShadow: 'inset 0px -1.30687px 0px #E1E1E1',
              borderRadius: '4px 4px 0px 0px'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 600,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#F5F5F5'
              }}>Login</span>
            </div>
            {/* Rows */}
            {['301246', '300154', '301310', '302802', '301475', '300399', '301771', '300073', '300073', '300888', '300888'].map((login, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                width: '63px',
                height: '35px',
                background: '#FFFFFF',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#1A63BC'
                }}>{login}</span>
              </div>
            ))}
          </div>

          {/* Balance Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            width: '80px',
            height: '420px',
            flex: 'none',
            order: 1,
            flexGrow: 0
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px',
              width: '80px',
              height: '35px',
              background: '#1A63BC',
              boxShadow: 'inset 0px -1.30687px 0px #E1E1E1'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 600,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#F5F5F5'
              }}>Balance</span>
            </div>
            {/* Rows */}
            {['5.03', '0.00', '0.00', '0.00', '-0.72', '103.73', '20.05', '54.54', '0.00', '0.00', '0.00'].map((balance, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                width: '80px',
                height: '35px',
                background: '#FFFFFF',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#4B4B4B'
                }}>{balance}</span>
              </div>
            ))}
          </div>

          {/* Floating Profit Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            width: '110px',
            height: '420px',
            flex: 'none',
            order: 2,
            flexGrow: 0
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px',
              width: '110px',
              height: '35px',
              background: '#1A63BC',
              boxShadow: 'inset 0px -1.30687px 0px #E1E1E1'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 600,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#F5F5F5',
                whiteSpace: 'nowrap'
              }}>Floating Profit</span>
            </div>
            {/* Rows */}
            {['0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '-5.89', '0.00', '0.00', '0.00', '0.00'].map((profit, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                width: '110px',
                height: '35px',
                background: '#FFFFFF',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#4B4B4B'
                }}>{profit}</span>
              </div>
            ))}
          </div>

          {/* Equity Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            width: '80px',
            height: '420px',
            flex: 'none',
            order: 3,
            flexGrow: 0
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px',
              width: '80px',
              height: '35px',
              background: '#1A63BC',
              boxShadow: 'inset 0px -1.30687px 0px #E1E1E1'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 600,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#F5F5F5'
              }}>Equity</span>
            </div>
            {/* Rows */}
            {['54.54', '103.73', '0.00', '0.00', '-0.72', '20.05', '0.00', '0.00', '5.03', '0.00', '0.00'].map((equity, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                width: '80px',
                height: '35px',
                background: '#FFFFFF',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#4B4B4B'
                }}>{equity}</span>
              </div>
            ))}
          </div>

          {/* Name Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '0px',
            width: '120px',
            height: '420px',
            flex: 'none',
            order: 4,
            flexGrow: 0
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px',
              width: '120px',
              height: '35px',
              background: '#1A63BC',
              boxShadow: 'inset 0px -1.30687px 0px #E1E1E1',
              borderRadius: '0px 4px 0px 0px'
            }}>
              <span style={{
                fontFamily: 'Outfit',
                fontStyle: 'normal',
                fontWeight: 600,
                fontSize: '12px',
                lineHeight: '15px',
                color: '#F5F5F5'
              }}>Name</span>
            </div>
            {/* Rows */}
            {['Priyanka Bha...', 'Faruk', 'Khitindra Ka...', 'Teo Hwee Ch...', 'Yusaf Randil', 'Rahul S. Cha...', 'Moliya Hansa...', 'Ishwar Karid...', 'Ishwar Karid...', 'Tanmay', 'Madan'].map((name, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                padding: '10px',
                width: '120px',
                height: '35px',
                background: '#FFFFFF',
                boxShadow: 'inset 0px -0.931668px 0px #E1E1E1'
              }}>
                <span style={{
                  fontFamily: 'Outfit',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  fontSize: '12px',
                  lineHeight: '15px',
                  color: '#4B4B4B',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileClientsViewNew
