import { useState, useEffect } from 'react'
import { useGroups } from '../contexts/GroupContext'
import api from '../services/api'

const GroupModal = ({ 
  isOpen, 
  onClose, 
  availableItems = [], 
  loginField = 'login',
  displayField = 'login',
  secondaryField = null,
  editGroup = null // Pass group object to edit
}) => {
  const { groups, createGroup, createRangeGroup, updateGroup } = useGroups()
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedLogins, setSelectedLogins] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [formError, setFormError] = useState('')
  const [activeTab, setActiveTab] = useState('manual') // 'manual' or 'range'
  const [isEditMode, setIsEditMode] = useState(false)
  const [originalGroupName, setOriginalGroupName] = useState('')
  
  // API state for My Login tab
  const [apiLogins, setApiLogins] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalLogins, setTotalLogins] = useState(0)
  const [loading, setLoading] = useState(false)
  const limit = 50

  // Initialize form when editing
  useEffect(() => {
    if (isOpen && editGroup) {
      setIsEditMode(true)
      setOriginalGroupName(editGroup.name)
      setNewGroupName(editGroup.name)
      
      if (editGroup.range) {
        setActiveTab('range')
        setRangeStart(String(editGroup.range.from))
        setRangeEnd(String(editGroup.range.to))
      } else {
        setActiveTab('manual')
        setSelectedLogins(editGroup.loginIds.map(String))
      }
    } else if (isOpen) {
      setIsEditMode(false)
      setOriginalGroupName('')
    }
  }, [isOpen, editGroup])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewGroupName('')
      setSelectedLogins([])
      setSearchQuery('')
      setRangeStart('')
      setRangeEnd('')
      setRangeError('')
      setFormError('')
      setActiveTab('manual')
      setIsEditMode(false)
      setOriginalGroupName('')
      setApiLogins([])
      setCurrentPage(1)
      setTotalPages(1)
      setTotalLogins(0)
    }
  }, [isOpen])
  
  // Fetch logins from API for My Login tab
  useEffect(() => {
    const fetchLogins = async () => {
      if (!isOpen || activeTab !== 'manual') return
      
      setLoading(true)
      try {
        const params = {
          fields: 'login,name,email',
          page: currentPage,
          limit: limit
        }
        if (searchQuery.trim()) {
          params.search = searchQuery.trim()
        }

        const queryString = new URLSearchParams(params).toString()
        const response = await api.get(`/api/broker/clients/fields?${queryString}`)

        if (response.data.status === 'success') {
          setApiLogins(response.data.data.clients || [])
          setTotalPages(response.data.data.totalPages || 1)
          setTotalLogins(response.data.data.total || 0)
        }
      } catch (err) {
        console.error('[GroupModal] Error fetching logins:', err)
        setFormError('Failed to load logins from server')
      } finally {
        setLoading(false)
      }
    }

    fetchLogins()
  }, [isOpen, activeTab, currentPage, searchQuery])

  // Update selected logins based on range whenever rangeStart or rangeEnd changes
  useEffect(() => {
    if (activeTab !== 'range') return
    
    setRangeError('')

    if (!rangeStart.trim() && !rangeEnd.trim()) {
      return
    }

    const start = parseInt(rangeStart)
    const end = parseInt(rangeEnd)

    if (rangeStart.trim() && isNaN(start)) {
      setRangeError('From value must be a number')
      return
    }

    if (rangeEnd.trim() && isNaN(end)) {
      setRangeError('To value must be a number')
      return
    }

    if (!isNaN(start) && !isNaN(end) && start > end) {
      setRangeError('From must be less than or equal to To')
      return
    }
  }, [rangeStart, rangeEnd, activeTab])

  if (!isOpen) return null

  const getFilteredItems = () => {
    // Use API data for My Login tab
    if (activeTab === 'manual') {
      return apiLogins
    }
    // For range tab, no items needed
    return []
  }

  const toggleLoginSelection = (login) => {
    const loginStr = String(login)
    setSelectedLogins(prev => 
      prev.includes(loginStr) 
        ? prev.filter(l => l !== loginStr) 
        : [...prev, loginStr]
    )
  }

  const handleCreateOrUpdateGroup = () => {
    setFormError('')
    
    if (!newGroupName.trim()) {
      setFormError('Please enter a group name')
      return
    }

    let success = false

    if (isEditMode) {
      // Update existing group
      if (activeTab === 'range') {
        if (!rangeStart.trim() || !rangeEnd.trim()) {
          setFormError('Please enter both From and To values')
          return
        }

        if (rangeError) {
          setFormError('Please fix the range errors')
          return
        }

        const range = {
          from: parseInt(rangeStart),
          to: parseInt(rangeEnd)
        }
        success = updateGroup(originalGroupName, newGroupName, null, range)
      } else {
        if (selectedLogins.length === 0) {
          setFormError('Please select at least one login')
          return
        }

        success = updateGroup(originalGroupName, newGroupName, selectedLogins, null)
      }

      if (success) {
        onClose()
      } else {
        setFormError('Failed to update group. Group name may already exist.')
      }
    } else {
      // Create new group
      if (activeTab === 'range') {
        if (!rangeStart.trim() || !rangeEnd.trim()) {
          setFormError('Please enter both From and To values')
          return
        }

        if (rangeError) {
          setFormError('Please fix the range errors')
          return
        }

        success = createRangeGroup(newGroupName, rangeStart, rangeEnd)
        
        if (success) {
          onClose()
        } else {
          setFormError('Failed to create group. Group name may already exist.')
        }
      } else {
        if (selectedLogins.length === 0) {
          setFormError('Please select at least one login')
          return
        }

        success = createGroup(newGroupName, selectedLogins)
        
        if (success) {
          onClose()
        } else {
          setFormError('Failed to create group. Group name may already exist.')
        }
      }
    }
  }

  const filteredItems = getFilteredItems()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-4 py-2.5 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">
            {isEditMode ? 'Edit Login Group' : 'Create Login Group'}
          </h3>
        </div>
        
        <div className="px-4 py-3 overflow-y-auto flex-1">
          {/* Group Name */}
          <div className="mb-3">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name"
              className="w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>

          {/* Error Message */}
          {formError && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{formError}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="mb-3">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('manual')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'manual'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                My Login
              </button>
              <button
                onClick={() => setActiveTab('range')}
                className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'range'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                By Range
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'manual' ? (
            // Manual Selection Tab
            <div>
              {/* Search */}
              <div className="mb-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setCurrentPage(1) // Reset to page 1 when searching
                  }}
                  placeholder="Search by login, name, email..."
                  className="w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 mb-2"
                />
                
                {/* Login List */}
                <div className="bg-white rounded-md border border-gray-200">
                  <div className="px-2.5 py-1.5 bg-blue-50 border-b border-blue-200 sticky top-0">
                    <p className="text-xs font-semibold text-blue-700">
                      {loading ? 'Loading...' : `Showing ${filteredItems.length} items on this page`}
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {loading ? (
                      <div className="px-2.5 py-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <p className="text-xs text-gray-500 mt-2">Loading logins...</p>
                      </div>
                    ) : filteredItems.length > 0 ? (
                      filteredItems.map((item) => {
                        const login = String(item.login || item[loginField])
                        const display = item.name || item[displayField]
                        const email = item.email
                        
                        return (
                          <label key={login} className="flex items-center px-2.5 py-1.5 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                            <input
                              type="checkbox"
                              checked={selectedLogins.includes(login)}
                              onChange={() => toggleLoginSelection(login)}
                              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="ml-2 text-xs text-gray-700 flex-1">
                              <span className="font-medium">{login}</span>
                              {display && display !== login && ` - ${display}`}
                              {email && <span className="text-gray-500"> ({email})</span>}
                            </span>
                          </label>
                        )
                      })
                    ) : (
                      <div className="px-2.5 py-8 text-xs text-gray-500 text-center">
                        {searchQuery ? 'No logins found matching your search' : 'No logins available'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Range Tab
            <div className="mb-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Add Login Range
                </label>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      From
                    </label>
                    <input
                      type="number"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      placeholder="e.g., 1"
                      className="w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      To
                    </label>
                    <input
                      type="number"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      placeholder="e.g., 30"
                      className="w-full px-2.5 py-1.5 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                    />
                  </div>
                </div>
                {rangeError && (
                  <p className="text-xs text-red-600 mb-2">{rangeError}</p>
                )}
                <div className="bg-white rounded p-2 border border-blue-200">
                  <p className="text-xs text-gray-600 mb-1">
                    <strong>Example:</strong> From <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">1</code> To <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">30</code> will include all logins from 1 to 30
                  </p>
                  <p className="text-xs text-gray-500">
                    ℹ️ The range will dynamically include any login that falls within this range, even if it's added in the future.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Selected Logins Display - Only for Manual Tab */}
          {activeTab === 'manual' && selectedLogins.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-1.5">
                Selected Login IDs ({selectedLogins.length}):
              </p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-gray-50 rounded border border-gray-200">
                {selectedLogins.sort((a, b) => Number(a) - Number(b)).map((login, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                    {login}
                    <button
                      onClick={() => toggleLoginSelection(login)}
                      className="text-blue-900 hover:text-blue-700 font-bold text-sm leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="px-4 py-2.5 bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateOrUpdateGroup}
            className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {isEditMode ? 'Update Group' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupModal
