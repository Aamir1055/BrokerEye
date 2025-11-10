import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const IBContext = createContext();

export const useIB = () => {
  const context = useContext(IBContext);
  if (!context) {
    throw new Error('useIB must be used within an IBProvider');
  }
  return context;
};

export const IBProvider = ({ children }) => {
  const [selectedIB, setSelectedIB] = useState(null);
  const [ibList, setIBList] = useState([]);
  const [ibMT5Accounts, setIBMT5Accounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch IB list when user logs in
  useEffect(() => {
    const handleLogin = () => {
      console.log('[IB] Login event detected, fetching IB emails...')
      fetchIBList();
    };

    // Listen for login event
    window.addEventListener('auth:login', handleLogin);

    return () => {
      window.removeEventListener('auth:login', handleLogin);
    };
  }, []);

  // Fetch MT5 accounts when IB is selected
  useEffect(() => {
    if (selectedIB?.email) {
      fetchIBMT5Accounts(selectedIB.email);
    } else {
      setIBMT5Accounts([]);
    }
  }, [selectedIB]);

  const fetchIBList = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/api/amari/ib/emails');
      
      if (response.data.status === 'success') {
        // Sort by percentage in ascending order
        const sortedEmails = (response.data.data.emails || []).sort((a, b) => {
          const percentA = parseFloat(a.percentage || 0)
          const percentB = parseFloat(b.percentage || 0)
          return percentA - percentB
        });
        setIBList(sortedEmails);
      } else {
        setError(response.data.message || 'Failed to fetch IB list');
      }
    } catch (err) {
      console.error('Error fetching IB list:', err);
      setError(err.message || 'Failed to fetch IB list');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIBMT5Accounts = async (email) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get(`/api/amari/ib/mt5-accounts?ib_email=${encodeURIComponent(email)}`);
      
      if (response.data.status === 'success') {
        const accounts = response.data.data.mt5_accounts || [];
        // Extract just the mt5_id (login numbers) from the accounts
        const mt5Ids = accounts.map(acc => acc.mt5_id);
        setIBMT5Accounts(mt5Ids);
      } else {
        setError(response.data.message || 'Failed to fetch MT5 accounts');
        setIBMT5Accounts([]);
      }
    } catch (err) {
      console.error('Error fetching IB MT5 accounts:', err);
      setError(err.message || 'Failed to fetch MT5 accounts');
      setIBMT5Accounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const selectIB = (ib) => {
    setSelectedIB(ib);
    // Store in localStorage for persistence
    if (ib) {
      localStorage.setItem('selectedIB', JSON.stringify(ib));
    } else {
      localStorage.removeItem('selectedIB');
    }
  };

  const clearIBSelection = () => {
    setSelectedIB(null);
    setIBMT5Accounts([]);
    localStorage.removeItem('selectedIB');
  };

  // Filter items by active IB (works for any array with login field)
  const filterByActiveIB = (items, loginField = 'login') => {
    if (!selectedIB || !ibMT5Accounts || ibMT5Accounts.length === 0) {
      return items;
    }
    
    // Convert MT5 IDs to Set for faster lookup (they're already just numbers)
    const accountSet = new Set(ibMT5Accounts.map(id => Number(id)));
    
    return items.filter(item => {
      const itemLogin = Number(item[loginField]);
      return accountSet.has(itemLogin);
    });
  };

  // Restore selected IB from localStorage on mount
  useEffect(() => {
    const savedIB = localStorage.getItem('selectedIB');
    if (savedIB) {
      try {
        const parsedIB = JSON.parse(savedIB);
        setSelectedIB(parsedIB);
      } catch (err) {
        console.error('Error parsing saved IB:', err);
        localStorage.removeItem('selectedIB');
      }
    }
  }, []);

  const value = {
    selectedIB,
    ibList,
    ibMT5Accounts,
    isLoading,
    error,
    selectIB,
    clearIBSelection,
    filterByActiveIB,
    refreshIBList: fetchIBList,
  };

  return <IBContext.Provider value={value}>{children}</IBContext.Provider>;
};
