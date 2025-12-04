import React, { useState, useEffect } from 'react'
import { brokerAPI } from '../services/api'

export default function SetCustomPercentageModal({ client, onClose, onSuccess }) {
  const [percentage, setPercentage] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (client) {
      setPercentage(client.percentage || '')
      setComment(client.comment || '')
    }
  }, [client])

  const handleSave = async () => {
    if (!percentage || percentage === '') {
      setError('Please enter a percentage')
      return
    }

    const percentageNum = parseFloat(percentage)
    if (isNaN(percentageNum) || percentageNum < 0 || percentageNum > 100) {
      setError('Percentage must be between 0 and 100')
      return
    }

    try {
      setSaving(true)
      setError('')
      
      await brokerAPI.setClientPercentage({
        client_login: client.client_login || client.login,
        percentage: percentageNum,
        comment: comment.trim()
      })
      
      if (onSuccess) {
        await onSuccess()
      }
      onClose()
    } catch (err) {
      console.error('Error saving percentage:', err)
      setError(err.response?.data?.message || 'Failed to save percentage')
      setSaving(false)
    }
  }

  if (!client) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        {/* Modal Header */}
        <div className="bg-white px-6 py-4 rounded-t-2xl border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">
            Set Custom Percentage
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={saving}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Client Login Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              Client Login: <span className="font-semibold text-gray-900">{client.client_login || client.login}</span>
            </p>
          </div>

          {/* Percentage Input with Dropdown */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Set Custom Percentage
            </label>
            <select
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              disabled={saving}
            >
              <option value="">Select Percentage</option>
              <option value="100">100</option>
              <option value="90">90</option>
              <option value="80">80</option>
              <option value="70">70</option>
              <option value="60">60</option>
              <option value="50">50</option>
              <option value="40">40</option>
              <option value="30">30</option>
              <option value="20">20</option>
              <option value="10">10</option>
              <option value="-10">-10</option>
              <option value="-20">-20</option>
              <option value="-30">-30</option>
              <option value="-40">-40</option>
              <option value="-50">-50</option>
              <option value="-60">-60</option>
              <option value="-70">-70</option>
              <option value="-80">-80</option>
              <option value="-90">-90</option>
              <option value="-100">-100</option>
            </select>
          </div>

          {/* Comment Field */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Comment...
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 resize-none"
              placeholder="Write here"
              disabled={saving}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-6 py-3 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Percentage'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
