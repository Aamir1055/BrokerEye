/**
 * Application Routes Configuration
 * All route paths for the application
 */

export const ROUTES = {
  // Auth
  LOGIN: '/',
  
  // Main Modules
  DASHBOARD: '/dashboard',
  CLIENTS: '/clients',
  POSITIONS: '/positions',
  PENDING_ORDERS: '/pending-orders',
  MARGIN_LEVEL: '/margin-level',
  LIVE_DEALING: '/live-dealing',
  CLIENT_PERCENTAGE: '/client-percentage',
  
  // Settings
  SETTINGS: '/settings',
  
  // Additional
  BROKER_RULE: '/broker-rule',
  ANALYTICS: '/analytics',
  IB_COMMISSIONS: '/ib-commissions'
}

/**
 * Get base path for sub-folder deployments
 * Used for handling different deployment paths like /amari-capital or /broker
 */
export const getBasePath = () => {
  try {
    const path = window.location?.pathname || '/'
    const match = path.match(/^\/(amari-capital|broker-branch|broker)\b/)
    return match ? `/${match[1]}` : ''
  } catch {
    return ''
  }
}
