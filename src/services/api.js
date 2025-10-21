import axios from 'axios'

// Base URL - use proxy in development, direct URL in production
const BASE_URL = import.meta.env.PROD ? 
  (import.meta.env.VITE_API_BASE_URL || 'http://185.136.159.142:8080') : 
  '' // Use proxy in development

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      baseURL: config.baseURL,
      data: config.data
    })
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Add response interceptor for debugging
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    })
    return response
  },
  (error) => {
    console.error('API Error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
      fullError: error
    })
    console.error('Full error object:', error)
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

  // Refresh token
  refreshToken: async (refreshToken) => {
    const response = await api.post('/api/auth/broker/refresh', {
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
  
  // Get client deals
  getClientDeals: async (login, from, to) => {
    const response = await api.get(`/api/broker/clients/${login}/deals?from=${from}&to=${to}`)
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
  }
}

export default api
