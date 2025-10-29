import { useState, useEffect, useRef } from 'react'
import { brokerAPI } from '../services/api'

const LoginDetailsModal = ({ login, onClose, allPositionsCache }) => {
  const [activeTab, setActiveTab] = useState('positions')
  const [positions, setPositions] = useState([])
  const [deals, setDeals] = useState([])
  const [clientData, setClientData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dealsLoading, setDealsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Money transaction states
  const [operationType, setOperationType] = useState('deposit')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [operationLoading, setOperationLoading] = useState(false)
  const [operationSuccess, setOperationSuccess] = useState('')
  const [operationError, setOperationError] = useState('')
  
  const hasLoadedData = useRef(false)

  useEffect(() => {
    if (!hasLoadedData.current) {
      hasLoadedData.current = true
      fetchPositions()
      fetchDeals()
      fetchClientData()
    }
  }, [])

  // Update positions when allPositionsCache changes (WebSocket updates)
  useEffect(() => {
    if (allPositionsCache && allPositionsCache.length >= 0) {
      const loginPositions = allPositionsCache.filter(pos => pos.login === login)
      setPositions(loginPositions)
    }
  }, [allPositionsCache, login])

  const fetchPositions = async () => {
    try {
      setLoading(true)
      
      if (allPositionsCache && allPositionsCache.length >= 0) {
        const loginPositions = allPositionsCache.filter(pos => pos.login === login)
        setPositions(loginPositions)
      } else {
        setPositions([])
      }
    } catch (error) {
      setError('Failed to load positions')
    } finally {
      setLoading(false)
    }
  }

  const fetchDeals = async () => {
    try {
      setDealsLoading(true)
      
      const nowUtcEpoch = Math.floor(Date.now() / 1000)
      const oneYearInSeconds = 365 * 24 * 60 * 60
      const toTime = nowUtcEpoch + oneYearInSeconds
      
      const response = await brokerAPI.getClientDeals(login, 0, toTime)
      const clientDeals = response.data?.deals || []
      setDeals(clientDeals)
    } catch (error) {
      setDeals([])
    } finally {
      setDealsLoading(false)
    }
  }

  const fetchClientData = async () => {
    try {
      const response = await brokerAPI.getClients()
      const allClients = response.data?.clients || []
      const client = allClients.find(c => c.login === login)
      if (client) {
        setClientData(client)
      }
    } catch (error) {
      console.error('Failed to fetch client data:', error)
    }
  }

  const handleMoneyOperation = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setOperationError('Please enter a valid amount')
      return
    }

    try {
      setOperationLoading(true)
      setOperationError('')
      setOperationSuccess('')

      const response = await brokerAPI.balanceOperation(
        login,
        operationType,
        parseFloat(amount),
        comment
      )

      setOperationSuccess(response.message || 'Operation completed successfully')
      setAmount('')
      setComment('')
      
      // Refresh data
      setTimeout(async () => {
        await fetchClientData()
        await fetchDeals()
      }, 1000)
    } catch (error) {
      setOperationError(error.response?.data?.message || 'Operation failed. Please try again.')
    } finally {
      setOperationLoading(false)
    }
  }

  const formatCurrency = (value) => {
    return `$${parseFloat(value || 0).toFixed(2)}`
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
  }

  const getActionLabel = (action) => {
    return action === 0 ? 'Buy' : 'Sell'
  }

  const getActionColor = (action) => {
    return action === 0 
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
  }

  const getDealActionLabel = (action) => {
    const numericAction = typeof action === 'string' ? parseInt(action) : action
    
    const actions = {
      0: 'Buy',
      1: 'Sell',
      2: 'Balance',
      3: 'Credit',
      4: 'Charge',
      5: 'Correction',
      6: 'Bonus',
      7: 'Commission',
      8: 'Daily Commission',
      9: 'Monthly Commission',
      10: 'Agent Daily',
      11: 'Agent Monthly',
      12: 'Intergroup Agent',
      'buy': 'Buy',
      'sell': 'Sell',
      'balance': 'Balance',
      'credit': 'Credit',
      'deposit': 'Deposit',
      'withdrawal': 'Withdrawal'
    }
    
    const stringAction = typeof action === 'string' ? action.toLowerCase() : null
    
    return actions[numericAction] || actions[stringAction] || actions[action] || `Unknown (${action})`
  }

  const getDealActionColor = (action) => {
    const numericAction = typeof action === 'string' ? parseInt(action) : action
    const stringAction = typeof action === 'string' ? action.toLowerCase() : ''
    
    if (numericAction === 0 || stringAction === 'buy') {
      return 'bg-green-100 text-green-800'
    } else if (numericAction === 1 || stringAction === 'sell') {
      return 'bg-red-100 text-red-800'
    } else if ([2, 3].includes(numericAction) || ['balance', 'credit', 'deposit'].includes(stringAction)) {
      return 'bg-blue-100 text-blue-800'
    } else if (stringAction === 'withdrawal') {
      return 'bg-orange-100 text-orange-800'
    } else {
      return 'bg-gray-100 text-gray-800'
    }
  }

  const getProfitColor = (profit) => {
    if (profit > 0) return 'text-green-600'
    if (profit < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Calculate totals
  const totalVolume = positions.reduce((sum, pos) => sum + parseFloat(pos.volume || 0), 0)
  const totalProfit = positions.reduce((sum, pos) => sum + parseFloat(pos.profit || 0), 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Login Details - {login}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4 bg-gray-50">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'positions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('deals')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'deals'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Deals ({deals.length})
          </button>
          <button
            onClick={() => setActiveTab('funds')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'funds'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Money Transactions
          </button>
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'positions' && (
            <div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : error ? (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-r p-3">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              ) : positions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm">No open positions</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Position</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Symbol</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Volume</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Open Price</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Current Price</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">S/L</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">T/P</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Profit</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Storage</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {positions.map((position) => (
                        <tr key={position.position} className="hover:bg-blue-50 transition-colors">
                          <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(position.timeCreate)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            #{position.position}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {position.symbol}
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getActionColor(position.action)}`}>
                              {getActionLabel(position.action)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.volume}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.priceOpen.toFixed(5)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.priceCurrent.toFixed(5)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.priceSL > 0 ? position.priceSL.toFixed(5) : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {position.priceTP > 0 ? position.priceTP.toFixed(5) : '-'}
                          </td>
                          <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${getProfitColor(position.profit)}`}>
                            {formatCurrency(position.profit)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {formatCurrency(position.storage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deals' && (
            <div>
              {dealsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : deals.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500 text-sm">No deals found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Deal</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Position</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Symbol</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Action</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Volume</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Price</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Profit</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Commission</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Storage</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {deals.map((deal) => (
                        <tr key={deal.deal} className="hover:bg-blue-50 transition-colors">
                          <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {formatDate(deal.time)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            #{deal.deal}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.position ? `#${deal.position}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                            {deal.symbol || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm whitespace-nowrap">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${getDealActionColor(deal.action)}`}>
                              {getDealActionLabel(deal.action)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.volume || '0'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {deal.price ? parseFloat(deal.price).toFixed(5) : '-'}
                          </td>
                          <td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${getProfitColor(deal.profit)}`}>
                            {formatCurrency(deal.profit)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {formatCurrency(deal.commission)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {formatCurrency(deal.storage)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'funds' && (
            <div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Balance Operation</h3>
                
                {operationSuccess && (
                  <div className="mb-3 bg-green-50 border-l-4 border-green-500 rounded-r p-3">
                    <p className="text-green-700 text-sm">{operationSuccess}</p>
                  </div>
                )}
                
                {operationError && (
                  <div className="mb-3 bg-red-50 border-l-4 border-red-500 rounded-r p-3">
                    <p className="text-red-700 text-sm">{operationError}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Operation Type</label>
                    <select
                      value={operationType}
                      onChange={(e) => setOperationType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="deposit">Deposit</option>
                      <option value="withdrawal">Withdrawal</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Comment (Optional)</label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Enter comment"
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleMoneyOperation}
                  disabled={operationLoading}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {operationLoading ? 'Processing...' : 'Submit Operation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards - Sticky at Bottom */}
        <div className="sticky bottom-0 p-4 bg-white border-t border-gray-200 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200 shadow-sm">
              <p className="text-xs text-blue-700 font-medium mb-1">Balance</p>
              <p className="text-2xl font-bold text-blue-900">
                {clientData ? formatCurrency(clientData.balance) : '-'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200 shadow-sm">
              <p className="text-xs text-green-700 font-medium mb-1">Equity</p>
              <p className="text-2xl font-bold text-green-900">
                {clientData ? formatCurrency(clientData.equity) : '-'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-200 shadow-sm">
              <p className="text-xs text-purple-700 font-medium mb-1">Credit</p>
              <p className="text-2xl font-bold text-purple-900">
                {clientData ? formatCurrency(clientData.credit) : '-'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg border border-orange-200 shadow-sm">
              <p className="text-xs text-orange-700 font-medium mb-1">Positions</p>
              <p className="text-2xl font-bold text-orange-900">{positions.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginDetailsModal
