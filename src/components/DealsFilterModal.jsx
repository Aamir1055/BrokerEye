import React, { useState, useEffect } from 'react';

const DealsFilterModal = ({ 
  isOpen, 
  onClose, 
  onApply,
  currentFilter = 'money'
}) => {
  const [selectedFilter, setSelectedFilter] = useState(currentFilter);

  useEffect(() => {
    if (isOpen) {
      setSelectedFilter(currentFilter);
    }
  }, [isOpen, currentFilter]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(selectedFilter);
    onClose();
  };

  const handleReset = () => {
    setSelectedFilter('money');
    onApply('money');
    onClose();
  };

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
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: '412px',
          height: 'auto',
          background: '#FFFFFF',
          borderRadius: '20px 20px 0 0',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top indicator line */}
        <div
          style={{
            width: '47px',
            height: '2px',
            background: '#E5E7EB',
            borderRadius: '100px',
            margin: '12px auto 0',
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '20px 20px 16px',
            borderBottom: '1px solid #F2F2F7',
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h2
            style={{
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '18px',
              lineHeight: '23px',
              color: '#000000',
              margin: '0 0 0 12px',
              flex: 1,
            }}
          >
            Deals
          </h2>
        </div>

        {/* Filter Options */}
        <div
          style={{
            padding: '0 20px',
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {/* Deals */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 0',
              borderBottom: '1px solid #F2F2F7',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedFilter === 'deal'}
              onChange={(e) => setSelectedFilter(e.target.checked ? 'deal' : selectedFilter)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#2563EB',
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '20px',
                color: '#1B2D45',
              }}
            >
              Deals
            </span>
          </label>

          {/* Money */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 0',
              borderBottom: '1px solid #F2F2F7',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedFilter === 'money'}
              onChange={(e) => setSelectedFilter(e.target.checked ? 'money' : selectedFilter)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#2563EB',
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '20px',
                color: '#1B2D45',
              }}
            >
              Money
            </span>
          </label>

          {/* Both */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px 0',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedFilter === 'both'}
              onChange={(e) => setSelectedFilter(e.target.checked ? 'both' : selectedFilter)}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#2563EB',
                cursor: 'pointer',
              }}
            />
            <span
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '20px',
                color: '#1B2D45',
              }}
            >
              Both
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '16px 20px 24px',
            borderTop: '1px solid #F2F2F7',
          }}
        >
          <button
            onClick={handleReset}
            style={{
              flex: 1,
              height: '56px',
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '16px',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              lineHeight: '20px',
              color: '#000000',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            onClick={handleApply}
            style={{
              flex: 1,
              height: '56px',
              background: '#2563EB',
              border: 'none',
              borderRadius: '16px',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              fontSize: '16px',
              lineHeight: '20px',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
};

export default DealsFilterModal;
