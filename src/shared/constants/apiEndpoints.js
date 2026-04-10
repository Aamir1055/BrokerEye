/**
 * API Endpoints Configuration
 * All API routes for the application
 */

// ==================== BASE URLS ====================
const IS_LOCAL = (() => {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return /^(http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0))(:\d+)?$/i.test(origin)
  } catch { 
    return false 
  }
})()

const envApiUrl = import.meta?.env?.VITE_API_BASE_URL
export const BASE_URL = IS_LOCAL 
  ? '' 
  : (typeof envApiUrl === 'string' ? envApiUrl : (import.meta?.env?.DEV ? '' : 'https://api.brokereye.work.gd'))

export const IB_BASE_URL = BASE_URL

// ==================== AUTH ENDPOINTS ====================
export const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH_TOKEN: '/auth/refresh',
  VERIFY_2FA: '/auth/verify-2fa',
  SETUP_2FA: '/auth/setup-2fa',
  BACKUP_CODES: '/auth/backup-codes'
}

// ==================== CLIENT ENDPOINTS ====================
export const CLIENT_ENDPOINTS = {
  LIST: '/clients',
  DETAILS: (login) => `/clients/${login}`,
  POSITIONS: (login) => `/clients/${login}/positions`,
  ORDERS: (login) => `/clients/${login}/orders`,
  HISTORY: (login) => `/clients/${login}/history`,
  PERCENTAGE: '/clients/percentage',
  UPDATE_PERCENTAGE: (login) => `/clients/${login}/percentage`,
  BULK_UPDATE_PERCENTAGE: '/clients/bulk-percentage'
}

// ==================== POSITION ENDPOINTS ====================
export const POSITION_ENDPOINTS = {
  LIST: '/positions',
  DETAILS: (id) => `/positions/${id}`,
  CLOSE: (id) => `/positions/${id}/close`,
  MODIFY: (id) => `/positions/${id}/modify`
}

// ==================== ORDER ENDPOINTS ====================
export const ORDER_ENDPOINTS = {
  LIST: '/orders',
  PENDING: '/orders/pending',
  HISTORY: '/orders/history',
  CREATE: '/orders',
  CANCEL: (id) => `/orders/${id}/cancel`
}

// ==================== DASHBOARD ENDPOINTS ====================
export const DASHBOARD_ENDPOINTS = {
  STATS: '/dashboard/stats',
  CHARTS: '/dashboard/charts',
  RECENT_ACTIVITY: '/dashboard/activity'
}

// ==================== MARGIN ENDPOINTS ====================
export const MARGIN_ENDPOINTS = {
  LEVELS: '/margin/levels',
  ALERTS: '/margin/alerts'
}

// ==================== LIVE DEALING ENDPOINTS ====================
export const LIVE_DEALING_ENDPOINTS = {
  DEALS: '/deals',
  RECENT: '/deals/recent'
}

// ==================== GROUP ENDPOINTS ====================
export const GROUP_ENDPOINTS = {
  LIST: '/groups',
  CREATE: '/groups',
  UPDATE: (id) => `/groups/${id}`,
  DELETE: (id) => `/groups/${id}`
}

// ==================== IB ENDPOINTS ====================
export const IB_ENDPOINTS = {
  LIST: '/ib/list',
  ACCOUNTS: '/ib/accounts',
  COMMISSIONS: '/ib/commissions'
}

// ==================== WEBSOCKET ENDPOINTS ====================
export const WEBSOCKET_ENDPOINTS = {
  POSITIONS: '/ws/positions',
  ORDERS: '/ws/orders',
  DEALS: '/ws/deals'
}
