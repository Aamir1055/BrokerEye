import { useState, useEffect, useRef } from 'react'
import { brokerAPI } from '../services/api'
import { formatTime } from '../utils/dateFormatter'

const LoginDetailsModal = ({ login, onClose, allPositionsCache }) => {
  const [activeTab, setActiveTab] = useState('positions')
  const [positions, setPositions] = useState([])
  const [deals, setDeals] = useState([])
  const [clientData, setClientData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dealsLoading, setDealsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Broker Rules states
  const [availableRules, setAvailableRules] = useState([])
  const [clientRules, setClientRules] = useState([])
  const [rulesLoading, setRulesLoading] = useState(false)
  const [selectedTimeParam, setSelectedTimeParam] = useState({}) // { ruleCode: timeValue }
  
  // Date filter states for deals only
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [filteredDeals, setFilteredDeals] = useState([])
  const [allDeals, setAllDeals] = useState([])
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false)
  
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
      // Don't fetch deals on mount - only fetch when user applies date filter
      fetchClientData()
      fetchAvailableRules()
      fetchClientRules()
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

  const fetchDeals = async (fromTimestamp, toTimestamp) => {
    try {
      setDealsLoading(true)
      setError('')
      
      // Fetch deals from API with specific date range
      const response = await brokerAPI.getClientDeals(login, fromTimestamp, toTimestamp)
      const clientDeals = response.data?.deals || []
      setDeals(clientDeals)
      setAllDeals(clientDeals)
      setFilteredDeals(clientDeals)
      setHasAppliedFilter(true)
    } catch (error) {
      setError('Failed to load deals')
      setDeals([])
      setAllDeals([])
      setFilteredDeals([])
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

  const fetchAvailableRules = async () => {
    try {
      console.log('[LoginDetailsModal] 🔍 Fetching available rules...')
      setRulesLoading(true)
      const response = await brokerAPI.getAvailableRules()
      console.log('[LoginDetailsModal] ✅ Rules response:', response)
      if (response.status === 'success') {
        setAvailableRules(response.data.rules || [])
        console.log('[LoginDetailsModal] 📋 Available rules set:', response.data.rules?.length || 0)
      }
    } catch (error) {
      console.error('[LoginDetailsModal] ❌ Failed to fetch available rules:', error)
    } finally {
      setRulesLoading(false)
    }
  }

  const fetchClientRules = async () => {
    try {
      const response = await brokerAPI.getClientRules(login)
      if (response.status === 'success') {
        setClientRules(response.data.rules || [])
      }
    } catch (error) {
      console.error('Failed to fetch client rules:', error)
      setClientRules([])
    }
  }

  const handleApplyRule = async (rule) => {
    try {
      setRulesLoading(true)
      const timeParameter = rule.requires_time_parameter ? selectedTimeParam[rule.rule_code] : null
      
      if (rule.requires_time_parameter && !timeParameter) {
        alert('Please select a time parameter')
        return
      }

      const response = await brokerAPI.applyClientRule(login, rule.rule_code, timeParameter)
      if (response.status === 'success') {
        await fetchClientRules()
        // Clear time parameter selection
        setSelectedTimeParam(prev => ({ ...prev, [rule.rule_code]: '' }))
      }
    } catch (error) {
      console.error('Failed to apply rule:', error)
      alert(error.response?.data?.message || 'Failed to apply rule')
    } finally {
      setRulesLoading(false)
    }
  }

  const handleRemoveRule = async (ruleCode) => {
    try {
      setRulesLoading(true)
      const response = await brokerAPI.removeClientRule(login, ruleCode)
      if (response.status === 'success') {
        await fetchClientRules()
      }
    } catch (error) {
      console.error('Failed to remove rule:', error)
      alert(error.response?.data?.message || 'Failed to remove rule')
    } finally {
      setRulesLoading(false)
    }
  }

  // Date filter functions for Deals
  const parseDateInput = (dateString) => {
    if (!dateString) return null
    
    // Support both dd/mm/yyyy and yyyy-mm-dd formats
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/')
      return new Date(year, month - 1, day)
    } else if (dateString.includes('-')) {
      return new Date(dateString)
    }
    return null
  }

  const handleApplyDateFilter = async () => {
    if (!fromDate && !toDate) {
      setOperationError('Please select at least one date (From or To)')
      return
    }

    const fromDateObj = fromDate ? parseDateInput(fromDate) : null
    const toDateObj = toDate ? parseDateInput(toDate) : null

    if ((fromDate && !fromDateObj) || (toDate && !toDateObj)) {
      setOperationError('Invalid date format. Please select a valid date')
      return
    }

    // Set time to start/end of day
    if (fromDateObj) {
      fromDateObj.setHours(0, 0, 0, 0)
    }
    if (toDateObj) {
      toDateObj.setHours(23, 59, 59, 999)
    }

    // Convert to Unix timestamp (seconds)
    const fromTimestamp = fromDateObj ? Math.floor(fromDateObj.getTime() / 1000) : 0
    const toTimestamp = toDateObj ? Math.floor(toDateObj.getTime() / 1000) : Math.floor(Date.now() / 1000)

    // Fetch deals from API with selected date range
    await fetchDeals(fromTimestamp, toTimestamp)
    setOperationError('')
  }

  const handleClearDateFilter = () => {
    setFromDate('')
    setToDate('')
    setFilteredDeals([])
    setDeals([])
    setAllDeals([])
    setHasAppliedFilter(false)
    setOperationError('')
  }

  // Date filter functions for Positions
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
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Login Details - {login}
            </h2>
            {clientData && (
              <div className="flex items-center gap-4 mt-1">
                {clientData.name && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Name:</span> {clientData.name}
                  </p>
                )}
                {clientData.lastAccess && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Last Access:</span> {formatTime(clientData.lastAccess)}
                  </p>
                )}
              </div>
            )}
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
        <div className="flex-shrink-0 flex border-b border-gray-200 px-4 bg-gray-50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'positions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Positions ({positions.length})
          </button>
          <button
            onClick={() => setActiveTab('deals')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'deals'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Deals ({deals.length})
          </button>
          <button
            onClick={() => setActiveTab('funds')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'funds'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Money Transactions
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'rules'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Broker Rules ({clientRules.length})
          </button>
        </div>

        {/* Tab Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {activeTab === 'positions' && (
            <div>
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              {/* Date Filter UI for Deals */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-4 border border-blue-100">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Date Filter</h3>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                    />
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleApplyDateFilter}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-xs font-medium rounded-md hover:from-blue-700 hover:to-blue-800 transition-all inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Apply
                    </button>
                    <button
                      onClick={handleClearDateFilter}
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select date range and click Apply to filter deals
                </p>
              </div>

              {dealsLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : !hasAppliedFilter ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 text-sm font-medium mb-1">Select Date Range</p>
                  <p className="text-gray-400 text-xs">Choose a date range above and click Apply to view deals</p>
                </div>
              ) : filteredDeals.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-gray-500 text-sm">No deals found for the selected date range</p>
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
                      {filteredDeals.map((deal) => (
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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Money Transactions</h3>
                
                {/* Success Message */}
                {operationSuccess && (
                  <div className="mb-3 bg-green-50 border-l-4 border-green-500 rounded-r p-2">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-700 text-xs">{operationSuccess}</span>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {operationError && (
                  <div className="mb-3 bg-red-50 border-l-4 border-red-500 rounded-r p-2">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-700 text-xs">{operationError}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={(e) => { e.preventDefault(); handleMoneyOperation(); }} className="space-y-3">
                  {/* Operation Type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Operation Type
                    </label>
                    <select
                      value={operationType}
                      onChange={(e) => {
                        setOperationType(e.target.value)
                        setOperationSuccess('')
                        setOperationError('')
                      }}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    >
                      <option value="deposit" className="text-gray-900">Deposit Funds</option>
                      <option value="withdrawal" className="text-gray-900">Withdraw Funds</option>
                      <option value="credit_in" className="text-gray-900">Credit In</option>
                      <option value="credit_out" className="text-gray-900">Credit Out</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400"
                      required
                    />
                  </div>

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Comment (Optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add a comment for this transaction"
                      rows="2"
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAmount('')
                        setComment('')
                        setOperationSuccess('')
                        setOperationError('')
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={operationLoading}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-md hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-400 transition-all inline-flex items-center gap-1.5"
                    >
                      {operationLoading ? (
                        <>
                          <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Execute Operation
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards - Sticky at Bottom */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200 shadow-lg">
          {activeTab === 'positions' && positions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600 mb-1">Total Positions</p>
                <p className="text-lg font-semibold text-gray-900">{positions.length}</p>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                <p className="text-xs text-gray-600 mb-1">Total Volume</p>
                <p className="text-lg font-semibold text-gray-900">
                  {positions.reduce((sum, p) => sum + p.volume, 0).toFixed(2)}
                </p>
              </div>
              <div className={`rounded-lg p-3 border ${
                positions.reduce((sum, p) => sum + p.profit, 0) >= 0
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-100'
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-100'
              }`}>
                <p className="text-xs text-gray-600 mb-1">Total P/L</p>
                <p className={`text-lg font-semibold ${getProfitColor(positions.reduce((sum, p) => sum + p.profit, 0))}`}>
                  {formatCurrency(positions.reduce((sum, p) => sum + p.profit, 0))}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'deals' && hasAppliedFilter && filteredDeals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600 mb-1">Total Deals</p>
                <p className="text-lg font-semibold text-gray-900">{filteredDeals.length}</p>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-gray-600 mb-1">Total Volume</p>
                <p className="text-lg font-semibold text-gray-900">
                  {filteredDeals.reduce((sum, d) => sum + d.volume, 0).toFixed(2)}
                </p>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-100">
                <p className="text-xs text-gray-600 mb-1">Total Commission</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatCurrency(filteredDeals.reduce((sum, d) => sum + d.commission, 0))}
                </p>
              </div>
              <div className={`rounded-lg p-3 border ${
                filteredDeals.reduce((sum, d) => sum + d.profit, 0) >= 0
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-100'
                  : 'bg-gradient-to-r from-red-50 to-rose-50 border-red-100'
              }`}>
                <p className="text-xs text-gray-600 mb-1">Total P/L</p>
                <p className={`text-lg font-semibold ${getProfitColor(filteredDeals.reduce((sum, d) => sum + d.profit, 0))}`}>
                  {formatCurrency(filteredDeals.reduce((sum, d) => sum + d.profit, 0))}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'funds' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Balance</p>
                <p className="text-xl font-bold text-blue-600">
                  {clientData ? formatCurrency(clientData.balance) : '-'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Equity</p>
                <p className="text-xl font-bold text-green-600">
                  {clientData ? formatCurrency(clientData.equity) : '-'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Credit</p>
                <p className="text-xl font-bold text-blue-600">
                  {clientData ? formatCurrency(clientData.credit) : '-'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-orange-100 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">Positions</p>
                <p className="text-xl font-bold text-orange-600">{positions.length}</p>
              </div>
            </div>
          )}

          {/* Broker Rules Tab */}
          {activeTab === 'rules' && (
            <div>
              {/* Current Rules Applied */}
              {clientRules.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Current Rules Applied ({clientRules.length})
                  </h3>
                  <div className="space-y-2">
                    {clientRules.map((rule) => (
                      <div key={rule.rule_code} className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-900">{rule.rule_name}</span>
                            <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-green-300 text-green-700">
                              {rule.rule_code}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">{rule.description}</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>Applied: {new Date(rule.applied_at).toLocaleString()}</span>
                            {rule.time_parameter && (
                              <span className="text-purple-600 font-medium">Time: {rule.time_parameter}</span>
                            )}
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{rule.mt5_applied_value}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveRule(rule.rule_code)}
                          disabled={rulesLoading}
                          className="ml-3 px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Rules */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Available Rules ({availableRules.filter(r => r.is_active).length})
                </h3>
                {rulesLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading rules...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {availableRules.filter(r => r.is_active).map((rule) => {
                      const isApplied = clientRules.some(cr => cr.rule_code === rule.rule_code)
                      return (
                        <div key={rule.id} className={`border rounded-lg p-4 ${isApplied ? 'bg-gray-50 border-gray-300' : 'bg-white border-blue-200'}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-gray-900">{rule.rule_name}</span>
                                <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                  {rule.rule_code}
                                </span>
                                {isApplied && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                                    ✓ Applied
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mb-2">{rule.description}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>MT5 Field: <strong>{rule.mt5_field}</strong></span>
                                <span className="font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                                  {rule.mt5_value_template}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Time Parameter Selection */}
                          {rule.requires_time_parameter && !isApplied && (
                            <div className="mt-3 flex items-center gap-2">
                              <label className="text-xs font-medium text-gray-700">Time:</label>
                              <select
                                value={selectedTimeParam[rule.rule_code] || ''}
                                onChange={(e) => setSelectedTimeParam(prev => ({ ...prev, [rule.rule_code]: e.target.value }))}
                                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700"
                                disabled={isApplied}
                              >
                                <option value="">Select time</option>
                                {rule.available_time_parameters?.map((time) => (
                                  <option key={time} value={time}>{time}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Apply Button */}
                          {!isApplied && (
                            <div className="mt-3">
                              <button
                                onClick={() => handleApplyRule(rule)}
                                disabled={rulesLoading}
                                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Apply Rule
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginDetailsModal
