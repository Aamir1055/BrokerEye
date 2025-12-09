import axios from 'axios'
const DEBUG_LOGS = import.meta?.env?.VITE_DEBUG_LOGS === 'true'

// Base URL: empty in dev (uses Vite proxy), hardcoded SSL in production
const BASE_URL = import.meta?.env?.VITE_API_BASE_URL || (import.meta?.env?.DEV ? '' : 'https://api.brokereye.work.gd')
if (DEBUG_LOGS) console.log('[API] Base URL:', BASE_URL || '(empty - using Vite proxy)')

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

// IB endpoints use different domain (https://brokereye.work.gd without api. subdomain)
const ibApi = axios.create({
  baseURL: 'https://brokereye.work.gd',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})
if (DEBUG_LOGS) console.log('[API] IB Base URL (hardcoded):', 'https://brokereye.work.gd')

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

// Mirror auth header for IB API
ibApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response
  },
  async (error) => {
    if (DEBUG_LOGS) {
      const errInfo = {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        status: error.response?.status,
        responseDataSnippet: typeof error.response?.data === 'string' ? error.response.data.slice(0,200) : error.response?.data
      }
      console.warn('[API] Axios error captured:', errInfo)
    }
    const originalRequest = error.config
    const status = error?.response?.status
    const networkErr = error?.code === 'ERR_NETWORK'
    if (!error.response) {
      console.warn('[API] Error without response object:', error.message)
    }

    // If unauthorized and we have a refresh token, attempt a refresh once
    const hasRefresh = !!localStorage.getItem('refresh_token')
    const alreadyRetried = originalRequest?._retry

    const shouldAttemptRefresh = (
      (status === 401) || // standard unauthorized
      (status === 403) || // forbidden (token might be invalid)
      (networkErr && hasRefresh && !alreadyRetried) // network edge case while token may have expired
    ) && hasRefresh && !alreadyRetried

    if (shouldAttemptRefresh) {
      originalRequest._retry = true
      console.warn('[API] 401 detected. Attempting token refresh. url=', originalRequest?.url)

      try {
        if (!isRefreshing) {
          isRefreshing = true
          const refresh_token = localStorage.getItem('refresh_token')
          console.log('[API] 🔄 Initiating token refresh (primary attempt)...')

          refreshPromise = rawApi
            .post('/api/auth/broker/refresh', { refresh_token })
            .then((res) => res.data)
            .then((data) => {
              const newAccess = data?.data?.access_token || data?.access_token
              if (!newAccess) throw new Error('No access_token in refresh response')
              // Persist token
              localStorage.setItem('access_token', newAccess)
              api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
              ibApi.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
              broadcastTokenRefreshed(newAccess)
              console.log('[API] ✅ Token refreshed (primary)')
              return newAccess
            })
            .catch(async (err) => {
              // If refresh token itself is expired (401), logout immediately
              if (err?.response?.status === 401) {
                console.error('[API] ❌ Refresh token expired (401). Logging out immediately.')
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                localStorage.removeItem('user_data')
                if (typeof window !== 'undefined') {
                  try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
                  window.location.href = '/login'
                }
                throw new Error('Refresh token expired')
              }
              
              console.error('[API] ❌ Primary refresh attempt failed:', err?.message)
              // Fallback attempt using api instance (with possibly expired Authorization header)
              try {
                const refresh_token2 = localStorage.getItem('refresh_token')
                console.log('[API] 🔁 Trying fallback refresh via api instance...')
                const res2 = await api.post('/api/auth/broker/refresh', { refresh_token: refresh_token2 })
                const data2 = res2.data
                const newAccess2 = data2?.data?.access_token || data2?.access_token
                if (!newAccess2) throw new Error('No access_token in fallback refresh response')
                localStorage.setItem('access_token', newAccess2)
                api.defaults.headers.common['Authorization'] = `Bearer ${newAccess2}`
                ibApi.defaults.headers.common['Authorization'] = `Bearer ${newAccess2}`
                broadcastTokenRefreshed(newAccess2)
                console.log('[API] ✅ Token refreshed (fallback)')
                return newAccess2
              } catch (fallbackErr) {
                // If fallback also gets 401, logout immediately
                if (fallbackErr?.response?.status === 401) {
                  console.error('[API] ❌ Fallback refresh token expired (401). Logging out immediately.')
                  localStorage.removeItem('access_token')
                  localStorage.removeItem('refresh_token')
                  localStorage.removeItem('user_data')
                  if (typeof window !== 'undefined') {
                    try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
                    window.location.href = '/login'
                  }
                  throw new Error('Refresh token expired')
                }
                console.error('[API] ❌ Fallback refresh failed:', fallbackErr?.message)
                throw fallbackErr
              }
            })
            .finally(() => {
              isRefreshing = false
              refreshPromise = null
            })
        }

        const token = await (refreshPromise || Promise.reject(new Error('No refresh in progress'))) // wait for whichever promise is active

        // Retry original request
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers['Authorization'] = `Bearer ${token}`
        console.log('[API] 🔁 Retrying original request after refresh:', originalRequest?.url)
        return api(originalRequest)
      } catch (refreshErr) {
        console.error('[API] 🚫 Refresh sequence failed. Logging out.')
        try {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user_data')
        } catch {}
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

// Reuse the same refresh logic for IB API
ibApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (DEBUG_LOGS) {
      const errInfo = {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        status: error.response?.status,
        responseDataSnippet: typeof error.response?.data === 'string' ? error.response.data.slice(0,200) : error.response?.data
      }
      console.warn('[IB API] Axios error captured:', errInfo)
    }
    const originalRequest = error.config
    const status = error?.response?.status
    const hasRefresh = !!localStorage.getItem('refresh_token')
    const alreadyRetried = originalRequest?._retry

    if (status === 401 && hasRefresh && !alreadyRetried) {
      originalRequest._retry = true
      try {
        if (!isRefreshing) {
          isRefreshing = true
          const refresh_token = localStorage.getItem('refresh_token')
          console.log('[IB API] 🔄 Initiating token refresh...')
          
          refreshPromise = rawApi
            .post('/api/auth/broker/refresh', { refresh_token })
            .then((res) => res.data)
            .then((data) => {
              const newAccess = data?.data?.access_token || data?.access_token
              if (!newAccess) throw new Error('No access_token in refresh response')
              localStorage.setItem('access_token', newAccess)
              api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
              ibApi.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
              broadcastTokenRefreshed(newAccess)
              
              console.log('[IB API] ✅ Token refreshed via interceptor')
              
              requestQueue.forEach((resolve) => resolve(newAccess))
              requestQueue = []
              return newAccess
            })
            .catch((err) => {
              // If refresh token itself is expired (401), logout immediately
              if (err?.response?.status === 401) {
                console.error('[IB API] ❌ Refresh token expired (401). Logging out immediately.')
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                localStorage.removeItem('user_data')
                if (typeof window !== 'undefined') {
                  try { window.dispatchEvent(new CustomEvent('auth:logout')) } catch {}
                  window.location.href = '/login'
                }
                requestQueue = []
                throw new Error('Refresh token expired')
              }
              console.error('[IB API] ❌ Token refresh failed:', err.message)
              requestQueue = []
              throw err
            })
            .finally(() => { 
              isRefreshing = false
              refreshPromise = null
            })
        }
        
        const token = await (refreshPromise || Promise.reject(new Error('No refresh in progress')))
        
        originalRequest.headers = originalRequest.headers || {}
        originalRequest.headers['Authorization'] = `Bearer ${token}`
        return ibApi(originalRequest)
      } catch (refreshErr) {
        try {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user_data')
        } catch {}
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
  
  // Get aggregated deal stats for a client (POST as provided by backend)
  getClientDealStats: async (login, from = 0, to = null) => {
    try {
      const payload = {}
      if (from != null) payload.from = from
      if (to != null) payload.to = to
      const response = await api.post(`/api/broker/clients/${login}/deals/stats`, payload)
      return response.data
    } catch (err) {
      // Fallback to GET if some installations expose it as GET
      try {
        const qs = []
        if (from != null) qs.push(`from=${from}`)
        if (to != null) qs.push(`to=${to}`)
        const q = qs.length ? `?${qs.join('&')}` : ''
        const response = await api.get(`/api/broker/clients/${login}/deals/stats${q}`)
        return response.data
      } catch (e) {
        throw err
      }
    }
  },

  // Get aggregated deal stats for a client via GET (explicit endpoint as requested)
  getClientDealStatsGET: async (login, from = null, to = null) => {
    const qs = []
    if (from != null) qs.push(`from=${from}`)
    if (to != null) qs.push(`to=${to}`)
    const q = qs.length ? `?${qs.join('&')}` : ''
    const response = await api.get(`/api/broker/clients/${login}/deals/stats${q}`)
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
  
  // Get client deals (attempt with limit first, fallback without if not supported)
  getClientDeals: async (login, from, to, limit = 1000) => {
    const endpoints = [
      `/api/broker/clients/${login}/deals?from=${from}&to=${to}&limit=${limit}`,
      `/api/broker/clients/${login}/deals?from=${from}&to=${to}`
    ]
    for (let i = 0; i < endpoints.length; i++) {
      try {
        const endpoint = endpoints[i]
        if (DEBUG_LOGS) console.log(`[API] ClientDeals attempt ${i + 1}: ${endpoint}`)
        const response = await api.get(endpoint)
        if (DEBUG_LOGS) console.log('[API] ClientDeals response length:', response.data?.data?.deals?.length || response.data?.deals?.length)
        return response.data
      } catch (err) {
        if (DEBUG_LOGS) console.warn(`[API] ClientDeals endpoint failed (${endpoints[i]}):`, err.response?.status || err.code || err.message)
      }
    }
    throw new Error('All client deals endpoint attempts failed')
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
  
  // Get positions by login
  getPositionsByLogin: async (login) => {
    const response = await api.get(`/api/broker/clients/${login}/positions`)
    return response.data
  },
  
  // Get deals by login
  getDealsByLogin: async (login, limit = 1000) => {
    const response = await api.get(`/api/broker/clients/${login}/deals?limit=${limit}`)
    return response.data
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
  getIBCommissions: async (page = 1, pageSize = 50, search = '', sortBy = 'created_at', sortOrder = 'desc') => {
    let url = `/api/amari/ib/commissions?page=${page}&page_size=${pageSize}`
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`
    }
    if (sortBy) {
      url += `&sort_by=${encodeURIComponent(sortBy)}`
    }
    if (sortOrder) {
      url += `&sort_order=${encodeURIComponent(sortOrder)}`
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
    if (DEBUG_LOGS) console.log('[API] Fetching IB commission totals from:', api.defaults.baseURL + '/api/amari/ib/commissions/total')
    const response = await api.get('/api/amari/ib/commissions/total')
    if (DEBUG_LOGS) console.log('[API] IB commission totals response:', response.data)
    return response
  },

  // Get all IB emails
  getIBEmails: async () => {
    if (DEBUG_LOGS) console.log('[API] Fetching IB emails from:', api.defaults.baseURL + '/api/amari/ib/emails')
    const response = await api.get('/api/amari/ib/emails')
    if (DEBUG_LOGS) console.log('[API] IB emails response:', response.data)
    return response
  },

  // Get MT5 accounts for a specific IB
  getIBMT5Accounts: async (email) => {
    if (DEBUG_LOGS) console.log('[API] Fetching MT5 accounts for:', email)
    const response = await api.get(`/api/amari/ib/mt5-accounts?ib_email=${encodeURIComponent(email)}`)
    if (DEBUG_LOGS) console.log('[API] MT5 accounts response:', response.data)
    return response
  },

  // Search clients with advanced filtering, pagination, and sorting
  // Accept optional axios config (e.g., { signal, timeout }) for per-request control
  searchClients: async (payload, options = {}) => {
    const response = await api.post('/api/broker/clients/search', payload, options)
    return response
  },

  // Get unique field values for column filters with search
  getClientFields: async (params, options = {}) => {
    const response = await api.get('/api/broker/clients/fields', { params, ...options })
    return response
  }
}

// Also export these methods on default api for backwards compatibility
api.getIBEmails = brokerAPI.getIBEmails
api.getIBMT5Accounts = brokerAPI.getIBMT5Accounts

export default api
