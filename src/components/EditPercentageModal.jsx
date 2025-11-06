import { useState, useEffect } from 'react'
import { brokerAPI } from '../services/api'

const EditPercentageModal = ({ ib, onClose, onSuccess }) => {
  const [percentage, setPercentage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (ib) {
      setPercentage(parseFloat(ib.percentage).toFixed(2))
    }
  }, [ib])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const percentageValue = parseFloat(percentage)
    
    // Validation
    if (isNaN(percentageValue)) {
      setError('Please enter a valid percentage')
      return
    }
    
    if (percentageValue < 0 || percentageValue > 100) {
      setError('Percentage must be between 0 and 100')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      const response = await brokerAPI.updateIBPercentage(ib.id, percentageValue)
      
      if (response.status === 'success') {
        setSuccess('Percentage updated successfully!')
        setTimeout(() => {
          onSuccess()
        }, 1000)
      } else {
        setError(response.message || 'Failed to update percentage')
      }
    } catch (error) {
      console.error('Error updating percentage:', error)
      setError(error.response?.data?.message || 'Failed to update percentage. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-slate-200 bg-blue-600">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Edit IB Percentage
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-white hover:text-blue-100 p-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* IB Information */}
          <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">ID:</span>
                <span className="text-sm font-semibold text-gray-900">{ib.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Name:</span>
                <span className="text-sm font-semibold text-gray-900">{ib.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Email:</span>
                <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">{ib.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Current Percentage:</span>
                <span className="text-sm font-bold text-blue-600">{parseFloat(ib.percentage).toFixed(2)}%</span>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-emerald-800 text-sm font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {success}
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Percentage (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder="Enter percentage (0-100)"
                  className="w-full px-4 py-3 pr-10 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder-gray-400 font-medium"
                  required
                  disabled={loading}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">Enter a value between 0 and 100</p>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                ) : (
                  'Update Percentage'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default EditPercentageModal
