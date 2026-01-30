import React, { useState, useEffect } from 'react'

const DateFilterModal = ({ isOpen, onClose, onApply, currentFilter, onPendingChange, isMobile = true }) => {
  const [tempSelectedFilter, setTempSelectedFilter] = useState(null)

  useEffect(() => {
    if (isOpen) {
      // Set temporary selection to current selection when modal opens
      setTempSelectedFilter(currentFilter)
    }
  }, [isOpen, currentFilter])

  // Notify parent when there are pending changes
  useEffect(() => {
    if (isOpen && onPendingChange) {
      const hasPending = tempSelectedFilter !== currentFilter
      onPendingChange(hasPending, tempSelectedFilter)
    }
  }, [isOpen, tempSelectedFilter, currentFilter, onPendingChange])

  const options = [
    { label: '3 Days', value: 3 },
    { label: '5 Days', value: 5 },
    { label: '7 Days', value: 7 }
  ]

  const handleSelect = (value) => {
    // Just store temporarily, don't apply yet
    setTempSelectedFilter(value)
  }

  const handleApply = () => {
    onApply(tempSelectedFilter)
    onClose()
  }

  const handleReset = () => {
    setTempSelectedFilter(null)
    onApply(null)
    onClose()
  }

  if (!isOpen) return null

  // Desktop dropdown style (like GroupSelector)
  if (!isMobile) {
    return (
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 8px)',
          width: '280px',
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 9999,
          padding: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingBottom: '12px',
          borderBottom: '1px solid #F2F2F7',
          marginBottom: '12px',
        }}>
          <h3
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              color: '#374151',
              margin: 0,
            }}
          >
            Date Filter
          </h3>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: tempSelectedFilter === option.value ? '#EFF6FF' : '#F9FAFB',
                border: tempSelectedFilter === option.value ? '1.5px solid #3B82F6' : '1px solid #E5E7EB',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                fontSize: '13px',
                fontWeight: tempSelectedFilter === option.value ? 600 : 400,
                color: '#374151',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{option.label}</span>
              {tempSelectedFilter === option.value && (
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#3B82F6" />
                  <path d="M6 10L8.5 12.5L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F2F2F7' }}>
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: '#F3F4F6',
              border: '1px solid #D1D5DB',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 500,
              fontSize: '12px',
              color: '#6B7280',
              transition: 'all 0.15s ease',
            }}
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            disabled={tempSelectedFilter === null}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: tempSelectedFilter !== null ? '#3B82F6' : '#E5E7EB',
              border: '1px solid ' + (tempSelectedFilter !== null ? '#3B82F6' : '#D1D5DB'),
              borderRadius: '8px',
              cursor: tempSelectedFilter !== null ? 'pointer' : 'not-allowed',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 500,
              fontSize: '12px',
              color: tempSelectedFilter !== null ? '#FFFFFF' : '#9CA3AF',
              transition: 'all 0.15s ease',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    )
  }

  // Mobile bottom sheet style
  return (
    <>
      {/* Backdrop */}
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

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '412px',
          height: 'auto',
          maxHeight: '50vh',
          background: '#FFFFFF',
          borderRadius: '20px 20px 0 0',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
        }}
      >
        {/* Top indicator line */}
        <div
          style={{
            width: '47px',
            height: '2px',
            background: 'rgba(71, 84, 103, 0.55)',
            borderRadius: '2px',
            margin: '10px auto',
          }}
        />

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '10px 20px',
          marginBottom: '10px',
        }}>
          <button
            onClick={() => {
              // Instead of closing completely, return to CustomizeView menu
              if (typeof window !== 'undefined') {
                const ev = new CustomEvent('openCustomizeView')
                window.dispatchEvent(ev)
              }
              onClose()
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '5px',
            }}
          >
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none" style={{ transform: 'rotate(180deg)' }}>
              <path d="M1 1L7 7L1 13" stroke="#4B4B4B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h2
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '18px',
              lineHeight: '24px',
              color: '#4B4B4B',
              letterSpacing: '-0.0041em',
              margin: 0,
            }}
          >
            Date Filter
          </h2>

          <div style={{ width: '18px' }} />
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: '1px', background: '#F2F2F7', marginBottom: '20px' }} />

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px', flex: 1 }}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: tempSelectedFilter === option.value ? '#E6EEF8' : '#F8F9FA',
                border: tempSelectedFilter === option.value ? '2px solid #1A63BC' : '1px solid #E5E7EB',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'Outfit, sans-serif',
                fontSize: '16px',
                fontWeight: tempSelectedFilter === option.value ? 600 : 400,
                color: '#1B2D45',
              }}
            >
              <span>{option.label}</span>
              {tempSelectedFilter === option.value && (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#1A63BC" />
                  <path d="M6 10L8.5 12.5L14 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Bottom divider */}
        <div
          style={{
            width: '100%',
            height: '1px',
            background: '#F2F2F7',
            margin: '0',
            marginTop: 'auto',
          }}
        />

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: '20px',
            padding: '5px 18px 32px',
            background: '#FFFFFF',
          }}
        >
          {/* Reset button */}
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px 16px',
              background: '#E5E7EB',
              border: '1px solid #D1D5DB',
              borderRadius: '20px',
              boxShadow: '0px 0px 50px rgba(0, 0, 0, 0.05)',
              cursor: 'pointer',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '20px',
              letterSpacing: '0.06em',
              textTransform: 'capitalize',
              color: '#6B7280',
            }}
          >
            Reset
          </button>

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={tempSelectedFilter === null}
            style={{
              flex: 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '10px 27px',
              background: tempSelectedFilter !== null ? '#2563EB' : '#E5E7EB',
              border: '1px solid ' + (tempSelectedFilter !== null ? '#2563EB' : '#D1D5DB'),
              borderRadius: '20px',
              boxShadow: '0px 0px 50px rgba(0, 0, 0, 0.05)',
              cursor: tempSelectedFilter !== null ? 'pointer' : 'not-allowed',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 400,
              fontSize: '12px',
              lineHeight: '20px',
              letterSpacing: '0.06em',
              textTransform: 'capitalize',
              color: tempSelectedFilter !== null ? '#FFFFFF' : '#6B7280',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  )
}

export default DateFilterModal
