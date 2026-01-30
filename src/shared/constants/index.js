/**
 * Global Application Constants
 * Centralized configuration for the BrokerEye application
 */

// ==================== PAGINATION ====================
export const PAGINATION = {
  ITEMS_PER_PAGE: 12,
  NET_ITEMS_PER_PAGE: 12,
  DEFAULT_PAGE: 1
}

// ==================== API CONFIGURATION ====================
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000 // 1 second
}

// ==================== LOCAL STORAGE KEYS ====================
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  SIDEBAR_STATE: 'sidebarOpen',
  THEME: 'theme',
  VISIBLE_COLUMNS: 'visibleColumns',
  FILTERS: 'filters',
  DASHBOARD_ORDER: 'dashboardFaceCardOrder',
  DASHBOARD_VISIBILITY: 'dashboardCardVisibility',
  LIVE_DEALS_CACHE: 'live_deals_cache'
}

// ==================== SCREEN BREAKPOINTS ====================
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280
}

// ==================== DEFAULT VISIBLE COLUMNS ====================
export const DEFAULT_VISIBLE_COLUMNS = {
  positions: {
    login: true,
    symbol: true,
    type: true,
    volume: true,
    openPrice: true,
    currentPrice: true,
    profit: true,
    storage: false,
    commission: false,
    openTime: true,
    comment: false
  },
  netPositions: {
    symbol: true,
    netType: true,
    netVolume: true,
    avgPrice: true,
    totalProfit: true,
    totalStorage: false,
    totalCommission: false,
    loginCount: true,
    totalPositions: true,
    variantCount: false
  }
}

// ==================== SORT DIRECTIONS ====================
export const SORT_DIRECTION = {
  ASC: 'asc',
  DESC: 'desc'
}

// ==================== STATUS TYPES ====================
export const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
}

// ==================== CURRENCY ====================
export const CURRENCY = {
  USD: 'USD',
  USC: 'USC',
  EUR: 'EUR'
}

// ==================== POSITION TYPES ====================
export const POSITION_TYPE = {
  BUY: 0,
  SELL: 1
}

export const POSITION_TYPE_LABELS = {
  [POSITION_TYPE.BUY]: 'Buy',
  [POSITION_TYPE.SELL]: 'Sell'
}

// ==================== COLORS ====================
export const COLORS = {
  PRIMARY: '#1A63BC',
  SUCCESS: '#10B981',
  DANGER: '#EF4444',
  WARNING: '#F59E0B',
  INFO: '#3B82F6',
  BUY: '#10B981',
  SELL: '#EF4444'
}

// ==================== DATE FORMATS ====================
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  API: 'yyyy-MM-dd',
  FULL: 'MMM dd, yyyy HH:mm:ss',
  TIME_ONLY: 'HH:mm:ss'
}

// ==================== FILTER OPTIONS ====================
export const FILTER_OPTIONS = {
  DATE_RANGES: [
    { value: null, label: 'All Time' },
    { value: 3, label: 'Last 3 Days' },
    { value: 5, label: 'Last 5 Days' },
    { value: 7, label: 'Last 7 Days' }
  ]
}

// ==================== WEBSOCKET CONFIGURATION ====================
export const WEBSOCKET_CONFIG = {
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
  HEARTBEAT_INTERVAL: 30000
}

// ==================== DEBUG ====================
export const DEBUG = {
  LOGS_ENABLED: import.meta?.env?.VITE_DEBUG_LOGS === 'true'
}
