import { useState, useEffect, useMemo } from 'react'
import api from '../services/api'

const IBFilterModal = ({ isOpen, onClose, onSelectIB }) => {
  const [ibEmails, setIbEmails] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      fetchIBEmails()
    }
  }, [isOpen])

  const fetchIBEmails = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getIBEmails()
      if (response.status === 'success' && response.data?.emails) {
        // Sort by percentage in ascending order
        const sortedEmails = response.data.emails.sort((a, b) => {
          const percentA = parseFloat(a.percentage || 0)
          const percentB = parseFloat(b.percentage || 0)
          return percentA - percentB
        })
        setIbEmails(sortedEmails)
      }
    } catch (err) {
      console.error('Error fetching IB emails:', err)
      setError('Failed to fetch IB emails. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Filter emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return ibEmails
    
    const query = searchQuery.toLowerCase()
    return ibEmails.filter(ib => 
      ib.email.toLowerCase().includes(query) ||
      ib.name?.toLowerCase().includes(query)
    )
  }, [ibEmails, searchQuery])

  const handleSelectIB = async (ib) => {
    try {
      setLoading(true)
      // Fetch MT5 accounts for the selected IB
      const response = await api.getIBMT5Accounts(ib.email)
      
      if (response.status === 'success' && response.data?.mt5_accounts) {
        // Pass both IB info and MT5 accounts to parent
        onSelectIB({
          email: ib.email,
          name: ib.name,
          percentage: ib.percentage,
          mt5Accounts: response.data.mt5_accounts
        })
        onClose()
      }
    } catch (err) {
      console.error('Error fetching MT5 accounts:', err)
      setError('Failed to fetch MT5 accounts. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Select IB Filter</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && !ibEmails.length ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchIBEmails}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Retry
              </button>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {searchQuery ? 'No IB emails match your search' : 'No IB emails found'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmails.map((ib) => (
                <button
                  key={ib.id}
                  onClick={() => handleSelectIB(ib)}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ib.email}
                        <span className="ml-2 text-xs font-semibold text-blue-600">
                          ({ib.percentage}%)
                        </span>
                      </p>
                      {ib.name && (
                        <p className="text-xs text-gray-500 truncate mt-1">{ib.name}</p>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-gray-500">Total Commission</p>
                      <p className="text-sm font-semibold text-gray-900">
                        ${parseFloat(ib.total_commission || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {filteredEmails.length} IB{filteredEmails.length !== 1 ? 's' : ''} found
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default IBFilterModal
