import React from 'react';

const LoginGroupsModal = ({ 
  isOpen, 
  onClose, 
  groups = [],
  onCreateGroup 
}) => {
  if (!isOpen) return null;

  const hasGroups = groups && groups.length > 0;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.35)',
          zIndex: 9998,
        }}
        onClick={onClose}
      />

      {/* Modal content */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90%',
          maxWidth: '380px',
          minHeight: '250px',
          background: '#FFFFFF',
          borderRadius: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px 20px',
        }}
      >
        {/* Header with close button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h2
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '20px',
              lineHeight: '28px',
              color: '#1B2D45',
              margin: 0,
            }}
          >
            Login Groups
          </h2>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="#2563EB"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '100%',
            height: '1px',
            background: '#F2F2F7',
            marginBottom: '24px',
          }}
        />

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0',
          }}
        >
          {hasGroups ? (
            // Show groups list
            <div style={{ width: '100%' }}>
              {groups.map((group, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: index < groups.length - 1 ? '1px solid #F2F2F7' : 'none',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '16px',
                      color: '#1B2D45',
                      fontWeight: 500,
                    }}
                  >
                    {group.name}
                  </div>
                  <div
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: '14px',
                      color: '#999999',
                      marginTop: '4px',
                    }}
                  >
                    {group.loginCount || 0} logins
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Show empty state
            <div
              style={{
                textAlign: 'center',
                padding: '20px',
              }}
            >
              <p
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '16px',
                  color: '#999999',
                  margin: '0 0 32px 0',
                }}
              >
                No groups created yet
              </p>

              {/* Create Now button */}
              <button
                onClick={() => {
                  onCreateGroup();
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: '#FFFFFF',
                  border: '1px solid #E6EEF8',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '16px',
                  color: '#1B2D45',
                  fontWeight: 500,
                  margin: '0 auto',
                  boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 4V14M4 9H14"
                    stroke="#1B2D45"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Create Now
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default LoginGroupsModal;
