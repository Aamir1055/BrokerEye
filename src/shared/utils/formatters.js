/**
 * Formatting Utilities
 * Common formatting functions for numbers, currency, dates, etc.
 */

/**
 * Format number with Indian locale
 * @param {number} n - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (n, decimals = 2) => {
  const v = Number(n || 0)
  if (!isFinite(v)) return '0.00'
  return v.toLocaleString('en-IN', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })
}

/**
 * Format currency with amount and currency code
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'USD')
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return `${formatNumber(amount)} ${currency}`
}

/**
 * Format percentage value
 * @param {number} value - Value to format as percentage
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value) => {
  return `${formatNumber(value, 2)}%`
}

/**
 * Format volume with 2 decimal places
 * @param {number} volume - Volume to format
 * @returns {string} Formatted volume string
 */
export const formatVolume = (volume) => {
  return formatNumber(volume, 2)
}

/**
 * Format price with appropriate decimal places
 * @param {number} price - Price to format
 * @param {number} decimals - Number of decimal places (default: 5 for forex)
 * @returns {string} Formatted price string
 */
export const formatPrice = (price, decimals = 5) => {
  return formatNumber(price, decimals)
}

/**
 * Format profit/loss with color indication
 * @param {number} value - P&L value
 * @returns {object} Object with formatted value and color class
 */
export const formatProfitLoss = (value) => {
  const formatted = formatNumber(value, 2)
  const color = value >= 0 ? 'text-green-600' : 'text-red-600'
  return {
    value: formatted,
    colorClass: color,
    isProfit: value >= 0
  }
}

/**
 * Format large numbers with K, M, B suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number with suffix
 */
export const formatCompactNumber = (num) => {
  const value = Number(num || 0)
  if (!isFinite(value)) return '0'
  
  if (Math.abs(value) >= 1e9) {
    return (value / 1e9).toFixed(2) + 'B'
  }
  if (Math.abs(value) >= 1e6) {
    return (value / 1e6).toFixed(2) + 'M'
  }
  if (Math.abs(value) >= 1e3) {
    return (value / 1e3).toFixed(2) + 'K'
  }
  return value.toFixed(2)
}
