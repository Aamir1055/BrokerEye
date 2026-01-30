/**
 * USD Normalization Utility
 * Converts position values to USD and normalizes volumes
 */

// Exchange rates (update these from an API or configuration)
const EXCHANGE_RATES = {
  USD: 1.0,
  EUR: 1.10,
  GBP: 1.27,
  JPY: 0.0067,
  AUD: 0.66,
  CAD: 0.74,
  CHF: 1.16,
  NZD: 0.60,
  // Add more currencies as needed
}

// Contract sizes for volume normalization
const CONTRACT_SIZES = {
  // Forex pairs (standard lot = 100,000 units)
  'EURUSD': 100000,
  'GBPUSD': 100000,
  'USDJPY': 100000,
  'AUDUSD': 100000,
  'USDCAD': 100000,
  'USDCHF': 100000,
  'NZDUSD': 100000,
  // Metals
  'XAUUSD': 100, // Gold
  'XAGUSD': 5000, // Silver
  // Indices (varies by broker)
  'US30': 10,
  'NAS100': 20,
  'SPX500': 50,
  // Default
  'default': 100000
}

/**
 * Get exchange rate for a currency
 * @param {string} currency - Currency code (e.g., 'EUR', 'GBP')
 * @returns {number} - Exchange rate to USD
 */
export const getExchangeRate = (currency) => {
  if (!currency) return 1.0
  const upperCurrency = currency.toUpperCase()
  return EXCHANGE_RATES[upperCurrency] || 1.0
}

/**
 * Get contract size for a symbol
 * @param {string} symbol - Trading symbol (e.g., 'EURUSD', 'XAUUSD')
 * @returns {number} - Contract size
 */
export const getContractSize = (symbol) => {
  if (!symbol) return CONTRACT_SIZES.default
  const upperSymbol = symbol.toUpperCase()
  return CONTRACT_SIZES[upperSymbol] || CONTRACT_SIZES.default
}

/**
 * Extract currency from symbol
 * @param {string} symbol - Trading symbol (e.g., 'EURUSD')
 * @returns {string} - Profit currency (usually quote currency)
 */
export const getCurrencyFromSymbol = (symbol) => {
  if (!symbol || symbol.length < 6) return 'USD'
  
  // For standard forex pairs (6 characters)
  if (symbol.length === 6) {
    return symbol.substring(3, 6) // Quote currency (last 3 chars)
  }
  
  // For metals and other symbols
  if (symbol.startsWith('XAU') || symbol.startsWith('XAG')) {
    return 'USD'
  }
  
  // Default to USD
  return 'USD'
}

/**
 * Normalize monetary value to USD
 * @param {number} value - Value to normalize
 * @param {string} currency - Source currency
 * @returns {number} - Normalized value in USD
 */
export const normalizeToUSD = (value, currency) => {
  if (value === null || value === undefined || isNaN(value)) return 0
  const rate = getExchangeRate(currency)
  return Number((value * rate).toFixed(2))
}

/**
 * Normalize volume to standard lots
 * @param {number} volume - Volume in lots
 * @param {string} symbol - Trading symbol
 * @returns {number} - Normalized volume
 */
export const normalizeVolume = (volume, symbol) => {
  if (volume === null || volume === undefined || isNaN(volume)) return 0
  const contractSize = getContractSize(symbol)
  const standardLot = 100000
  return Number((volume * contractSize / standardLot).toFixed(2))
}

/**
 * Normalize a single position
 * @param {Object} position - Position object
 * @returns {Object} - Position with normalized USD values
 */
export const normalizePosition = (position) => {
  if (!position) return position

  const currency = getCurrencyFromSymbol(position.symbol)
  
  return {
    ...position,
    profit_usd: normalizeToUSD(position.profit || 0, currency),
    storage_usd: normalizeToUSD(position.storage || 0, currency),
    commission_usd: normalizeToUSD(position.commission || 0, currency),
    volume_normalized: normalizeVolume(position.volume, position.symbol),
    currency_original: currency
  }
}

/**
 * Normalize an array of positions
 * @param {Array} positions - Array of position objects
 * @returns {Array} - Array of positions with normalized USD values
 */
export const normalizePositions = (positions) => {
  if (!Array.isArray(positions)) return []
  return positions.map(normalizePosition)
}

/**
 * Calculate total normalized profit for an array of positions
 * @param {Array} positions - Array of position objects
 * @returns {number} - Total profit in USD
 */
export const calculateTotalProfitUSD = (positions) => {
  if (!Array.isArray(positions) || positions.length === 0) return 0
  
  const normalizedPositions = normalizePositions(positions)
  const total = normalizedPositions.reduce((sum, pos) => sum + (pos.profit_usd || 0), 0)
  return Number(total.toFixed(2))
}

/**
 * Format USD value for display
 * @param {number} value - USD value
 * @param {boolean} showCurrency - Whether to show USD suffix
 * @returns {string} - Formatted value
 */
export const formatUSD = (value, showCurrency = true) => {
  if (value === null || value === undefined || isNaN(value)) return '0.00'
  const formatted = Math.abs(value).toFixed(2)
  const sign = value < 0 ? '-' : ''
  return showCurrency ? `${sign}${formatted} USD` : `${sign}${formatted}`
}