import axios from 'axios'
const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'

// Base URL configuration
// Development: empty string uses Vite proxy (no CORS issues)
// Production: empty string uses Apache proxy (deployed with .htaccess)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increased to 30 seconds for slow endpoints
})

// A raw axios instance without interceptors, used for token refresh to avoid loops
const rawApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Refresh handling state
let isRefreshing = false
let refreshPromise = null
let requestQueue = [] // queued resolvers waiting for new token

const broadcastTokenRefreshed = (accessToken) => {
  try {
    window.dispatchEvent(new CustomEvent('auth:token_refreshed', { detail: { accessToken } }))
  } catch {}
}

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const status = error?.response?.status

    // If unauthorized and we have a refresh token, attempt a refresh once
    const hasRefresh = !!localStorage.getItem('refresh_token')
    const alreadyRetried = originalRequest?._retry

    if (status === 401 && hasRefresh && !alreadyRetried) {
      originalRequest._retry = true

      try {
        if (!isRefreshing) {
          isRefreshing = true
          const refresh_token = localStorage.getItem('refresh_token')
          refreshPromise = rawApi
            .post('/api/auth/broker/refresh', { refresh_token })
            .then((res) => res.data)
            .then((data) => {
              const newAccess = data?.data?.access_token || data?.access_token
              if (!newAccess) throw new Error('No access_token in refresh response')

              // Save and apply new token
              localStorage.setItem('access_token', newAccess)
              api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
              broadcastTokenRefreshed(newAccess)

              // Flush queue
              requestQueue.forEach((resolve) => resolve(newAccess))
              requestQueue = []
              return newAccess
            })
            .finally(() => {
              isRefreshing = false
            })
        }

        // Wait for the in-flight refresh to complete
        const token = await new Promise((resolve, reject) => {
          if (refreshPromise) {
            requestQueue.push(resolve)
          } else {
            // Should not happen, but guard anyway
            reject(new Error('No refresh promise available'))
          }
        })

        // Retry the original request with the new token
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers['Authorization'] = `Bearer ${token}`
        return api(originalRequest)
      } catch (refreshErr) {
        // Refresh failed: clear auth and redirect to login
        try {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user_data')
        } catch {}
        // Soft redirect to login route
        if (typeof window !== 'undefined') {
          try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
          window.location.href = '/login'
        }
        return Promise.reject(refreshErr)
      }
    }

    return Promise.reject(error)
  }
)

// Auth API endpoints
export const authAPI = {
  // Login
  login: async (username, password) => {
    const response = await api.post('/api/auth/broker/login', {
      username,
      password
    })
    return response.data
  },

  // Verify 2FA code
  verify2FA: async (tempToken, code) => {
    const response = await api.post('/api/auth/broker/verify-2fa', {
      temp_token: tempToken,
      code
    })
    return response.data
  },

  // Setup 2FA
  setup2FA: async () => {
    const response = await api.post('/api/auth/broker/2fa/setup')
    return response.data
  },

  // Enable 2FA
  enable2FA: async (code, backupCodes) => {
    const response = await api.post('/api/auth/broker/2fa/enable', {
      code,
      backup_codes: backupCodes
    })
    return response.data
  },

  // Get 2FA status
  get2FAStatus: async () => {
    const response = await api.get('/api/auth/broker/2fa/status')
    return response
  },

  // Disable 2FA
  disable2FA: async (password) => {
    const response = await api.post('/api/auth/broker/2fa/disable', {
      password
    })
    return response.data
  },

  // Regenerate backup codes
  regenerateBackupCodes: async (password) => {
    const response = await api.post('/api/auth/broker/2fa/backup-codes', {
      password
    })
    return response.data
  },

  // Refresh token (use rawApi to avoid interceptor recursion)
  refreshToken: async (refreshToken) => {
    const response = await rawApi.post('/api/auth/broker/refresh', {
      refresh_token: refreshToken
    })
    return response.data
  },

  // Logout
  logout: async () => {
    const response = await api.post('/api/auth/logout')
    return response.data
  }
}

// Broker API endpoints
export const brokerAPI = {
  // Get all clients
  getClients: async () => {
    const response = await api.get('/api/broker/clients')
    return response.data
  },
  
  // Get all positions
  getPositions: async () => {
    const response = await api.get('/api/broker/positions')
    return response.data
  },
  
  // Get all pending orders
  getOrders: async () => {
    const response = await api.get('/api/broker/orders')
    return response.data
  },
  
  // Get client deals
  getClientDeals: async (login, from, to) => {
    const response = await api.get(`/api/broker/clients/${login}/deals?from=${from}&to=${to}`)
    return response.data
  },
  
  // Get all recent deals (for live dealing page)
  getAllDeals: async (from, to, limit = 100) => {
    const endpoints = [
      `/api/broker/deals?from=${from}&to=${to}&limit=${limit}`,
      `/api/broker/deals?from=${from}&to=${to}`,
      `/api/broker/trading/deals?from=${from}&to=${to}&limit=${limit}`,
      `/api/broker/deals/recent?limit=${limit}`,
      `/api/broker/deals`,
      `/api/deals?from=${from}&to=${to}&limit=${limit}`
    ]
    
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const endpoint = endpoints[i]
        if (DEBUG_LOGS) console.log(`[API] Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint}`)
        const response = await api.get(endpoint)
        if (DEBUG_LOGS) console.log(`[API] ✅ SUCCESS! Endpoint works: ${endpoint}`)
        if (DEBUG_LOGS) console.log('[API] Response data:', response.data)
        return response.data
      } catch (error) {
        if (DEBUG_LOGS) console.log(`[API] ❌ Endpoint ${i + 1} failed (${endpoints[i]}):`, error.response?.status || error.code || error.message)
        // Continue to next endpoint
      }
    }
    
    // All attempts failed
    if (DEBUG_LOGS) console.error('[API] ❌ All endpoint attempts failed. Tried:', endpoints)
    throw new Error('No working deals endpoint found')
  },
  
  // Deposit funds
  depositFunds: async (login, amount, comment) => {
    const response = await api.post(`/api/broker/clients/${login}/deposit`, {
      amount,
      comment
    })
    return response.data
  },
  
  // Withdraw funds
  withdrawFunds: async (login, amount, comment) => {
    const response = await api.post(`/api/broker/clients/${login}/withdrawal`, {
      amount,
      comment
    })
    return response.data
  },
  
  // Credit in
  creditIn: async (login, amount, comment) => {
    const response = await api.post(`/api/broker/clients/${login}/credit-in`, {
      amount,
      comment
    })
    return response.data
  },
  
  // Credit out
  creditOut: async (login, amount, comment) => {
    const response = await api.post(`/api/broker/clients/${login}/credit-out`, {
      amount,
      comment
    })
    return response.data
  },
  
  // Get all client percentages
  getAllClientPercentages: async () => {
    const response = await api.get('/api/broker/clients/percentages')
    return response.data
  },
  
  // Get specific client percentage
  getClientPercentage: async (login) => {
    const response = await api.get(`/api/broker/clients/${login}/percentage`)
    return response.data
  },
  
  // Set client percentage
  setClientPercentage: async (login, percentage, comment) => {
    const response = await api.post(`/api/broker/clients/${login}/percentage`, {
      percentage,
      comment
    })
    return response.data
  },

  // Get available rules
  getAvailableRules: async () => {
    const response = await api.get('/api/broker/rules')
    return response.data
  },

  // Get client rules
  getClientRules: async (login) => {
    const response = await api.get(`/api/broker/clients/${login}/rules`)
    return response.data
  },

  // Apply rule to client
  applyClientRule: async (login, ruleCode, timeParameter = null) => {
    const payload = { rule_code: ruleCode }
    if (timeParameter) {
      payload.time_parameter = timeParameter
    }
    const response = await api.post(`/api/broker/clients/${login}/rules`, payload)
    return response.data
  },

  // Remove rule from client
  removeClientRule: async (login, ruleCode) => {
    const response = await api.delete(`/api/broker/clients/${login}/rules/${ruleCode}`)
    return response.data
  },

  // Get IB commissions with pagination and search
  getIBCommissions: async (page = 1, pageSize = 50, search = '') => {
    let url = `/api/amari/ib/commissions?page=${page}&page_size=${pageSize}`
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`
    }
    const response = await api.get(url)
    return response.data
  },

  // Get IB percentage by ID
  getIBPercentage: async (id) => {
    const response = await api.get(`/api/amari/ib/commissions/${id}/percentage`)
    return response.data
  },

  // Update IB percentage
  updateIBPercentage: async (id, percentage) => {
    const response = await api.put(`/api/amari/ib/commissions/${id}/percentage`, {
      percentage
    })
    return response.data
  },

  // Bulk update IB percentages
  bulkUpdateIBPercentages: async (updates) => {
    const response = await api.post('/api/amari/ib/commissions/percentage/bulk', {
      updates
    })
    return response.data
  },

  // Get IB commission totals
  getIBCommissionTotals: async () => {
    const response = await api.get('/api/amari/ib/commissions/total')
    return response.data
  }
}

export default api
