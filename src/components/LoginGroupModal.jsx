import React, { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaSearch, FaSpinner, FaCheck } from 'react-icons/fa';
import api from '../services/api';

const LoginGroupModal = ({ isOpen, onClose, onSave, editGroup = null }) => {
  const [activeTab, setActiveTab] = useState('myLogin');
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  // My Login tab state
  const [logins, setLogins] = useState([]);
  const [selectedLogins, setSelectedLogins] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogins, setTotalLogins] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectAll, setSelectAll] = useState(false);
  const limit = 50;

  // By Range tab state
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  // Initialize form with edit data
  useEffect(() => {
    if (editGroup) {
      setGroupName(editGroup.name);
      if (editGroup.type === 'myLogin') {
        setActiveTab('myLogin');
        setSelectedLogins(editGroup.logins || []);
      } else if (editGroup.type === 'range') {
        setActiveTab('range');
        setRangeFrom(editGroup.rangeMin?.toString() || '');
        setRangeTo(editGroup.rangeMax?.toString() || '');
      }
    }
  }, [editGroup]);

  // Fetch logins for My Login tab
  const fetchLogins = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        fields: 'login,name,email',
        page: currentPage,
        limit: limit
      };
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const queryString = new URLSearchParams(params).toString();
      const response = await api.get(`/api/broker/clients/fields?${queryString}`);

      if (response.data.status === 'success') {
        setLogins(response.data.data.clients || []);
        setTotalPages(response.data.data.totalPages || 1);
        setTotalLogins(response.data.data.total || 0);
      }
    } catch (err) {
      console.error('Error fetching logins:', err);
      setError('Failed to load logins');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery]);

  // Fetch logins when tab changes to My Login or page/search changes
  useEffect(() => {
    if (isOpen && activeTab === 'myLogin') {
      fetchLogins();
    }
  }, [isOpen, activeTab, fetchLogins]);

  // Handle select all on current page
  const handleSelectAll = () => {
    if (selectAll) {
      // Deselect all on current page
      const currentPageLogins = logins.map(l => l.login);
      setSelectedLogins(prev => prev.filter(login => !currentPageLogins.includes(login)));
      setSelectAll(false);
    } else {
      // Select all on current page
      const currentPageLogins = logins.map(l => l.login);
      setSelectedLogins(prev => {
        const newSet = new Set([...prev, ...currentPageLogins]);
        return Array.from(newSet);
      });
      setSelectAll(true);
    }
  };

  // Handle individual login selection
  const handleLoginSelect = (login) => {
    setSelectedLogins(prev => {
      if (prev.includes(login)) {
        return prev.filter(l => l !== login);
      } else {
        return [...prev, login];
      }
    });
  };

  // Update selectAll state based on current page selections
  useEffect(() => {
    if (logins.length > 0) {
      const allSelected = logins.every(l => selectedLogins.includes(l.login));
      setSelectAll(allSelected);
    }
  }, [logins, selectedLogins]);

  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLogins();
  };

  // Handle save
  const handleSave = () => {
    // Validate group name
    if (!groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    let groupData = {
      id: editGroup?.id || Date.now(),
      name: groupName.trim(),
      type: activeTab === 'myLogin' ? 'myLogin' : 'range'
    };

    if (activeTab === 'myLogin') {
      if (selectedLogins.length === 0) {
        setError('Please select at least one login');
        return;
      }
      groupData.logins = selectedLogins;
    } else {
      // Range validation
      const min = parseInt(rangeFrom);
      const max = parseInt(rangeTo);

      if (!rangeFrom.trim() || !rangeTo.trim()) {
        setError('Please enter both From and To values');
        return;
      }

      if (isNaN(min) || isNaN(max)) {
        setError('Please enter valid numeric values');
        return;
      }

      if (min > max) {
        setError('From value cannot be greater than To value');
        return;
      }

      groupData.rangeMin = min;
      groupData.rangeMax = max;
    }

    onSave(groupData);
    handleClose();
  };

  // Handle close
  const handleClose = () => {
    setGroupName('');
    setSelectedLogins([]);
    setSearchQuery('');
    setCurrentPage(1);
    setRangeFrom('');
    setRangeTo('');
    setError('');
    setActiveTab('myLogin');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {editGroup ? 'Edit Login Group' : 'Create Login Group'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Group Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter group name
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError('');
              }}
              placeholder="Enter group name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && groupName.trim() === '' && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab('myLogin')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'myLogin'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              My Login
            </button>
            <button
              onClick={() => setActiveTab('range')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'range'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              By Range
            </button>
          </div>

          {/* My Login Tab */}
          {activeTab === 'myLogin' && (
            <div>
              {/* Search and Select All */}
              <div className="flex items-center gap-4 mb-4">
                <form onSubmit={handleSearch} className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by login, name..."
                    className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FaSearch />
                  </button>
                </form>
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {selectAll ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Selected count info */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">{selectedLogins.length}</span> login(s) selected
                  {totalLogins > 0 && ` out of ${totalLogins} total`}
                </p>
              </div>

              {/* Logins list */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <FaSpinner className="animate-spin text-blue-500 text-3xl" />
                  </div>
                ) : logins.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchQuery ? 'No logins found matching your search' : 'No logins available'}
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-blue-600 text-white sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left w-12">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </th>
                          <th className="px-4 py-3 text-left">Login</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logins.map((client, index) => {
                          const isSelected = selectedLogins.includes(client.login);
                          return (
                            <tr
                              key={client.login}
                              className={`border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors ${
                                isSelected ? 'bg-blue-50' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                              }`}
                              onClick={() => handleLoginSelect(client.login)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleLoginSelect(client.login)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                  {isSelected && (
                                    <FaCheck className="text-blue-600 ml-2 text-sm" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">{client.login}</td>
                              <td className="px-4 py-3 text-gray-700">{client.name || '-'}</td>
                              <td className="px-4 py-3 text-gray-700">{client.email || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {error && selectedLogins.length === 0 && groupName.trim() !== '' && (
                <p className="text-red-500 text-sm mt-4">{error}</p>
              )}
            </div>
          )}

          {/* By Range Tab */}
          {activeTab === 'range' && (
            <div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>Example:</strong> From <span className="font-mono">1</span> to{' '}
                  <span className="font-mono">30</span> will include all logins from 1 to 30
                </p>
                <p className="text-xs text-blue-600">
                  ℹ️ The range will dynamically include any login that falls within this range, even if
                  it's added in the future.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <input
                    type="number"
                    value={rangeFrom}
                    onChange={(e) => {
                      setRangeFrom(e.target.value);
                      setError('');
                    }}
                    placeholder="e.g., 1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <input
                    type="number"
                    value={rangeTo}
                    onChange={(e) => {
                      setRangeTo(e.target.value);
                      setError('');
                    }}
                    placeholder="e.g., 30"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {error && activeTab === 'range' && (
                  <p className="text-red-500 text-sm">{error}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            {editGroup ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginGroupModal;
