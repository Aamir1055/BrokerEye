/**
 * Centralized mobile filter utility
 * 
 * This utility applies filters in the correct cumulative order:
 * 1. Customize View filters (hasFloating, hasCredit, noDeposit) - applied first to raw data
 * 2. IB filter - applied to Customize-filtered results
 * 3. Group filter - applied to IB-filtered results
 * 
 * Each filter operates on the results of the previous filter, ensuring cumulative filtering.
 */

/**
 * Apply all mobile filters in cumulative order
 * 
 * @param {Array} items - Raw data array to filter
 * @param {Object} options - Filter options
 * @param {Object} options.customizeFilters - Customize View filters {hasFloating, hasCredit, noDeposit}
 * @param {Function} options.filterByActiveIB - IB filter function from IBContext
 * @param {Function} options.filterByActiveGroup - Group filter function from GroupContext
 * @param {string} options.loginField - Field name for login (default: 'login')
 * @param {string} options.moduleName - Module name for group filtering
 * @returns {Array} Filtered array
 */
export function applyCumulativeFilters(items, options = {}) {
  const {
    customizeFilters = {},
    filterByActiveIB,
    filterByActiveGroup,
    loginField = 'login',
    moduleName
  } = options

  let filtered = items

  // Step 1: Apply Customize View filters first (hasFloating, hasCredit, noDeposit)
  if (customizeFilters.hasFloating || customizeFilters.hasCredit || customizeFilters.noDeposit) {
    filtered = filtered.filter(item => {
      // hasFloating: only show items with non-zero profit
      if (customizeFilters.hasFloating && (!item.profit || item.profit === 0)) {
        return false
      }

      // hasCredit: only show items with non-zero credit
      if (customizeFilters.hasCredit && (!item.credit || item.credit === 0)) {
        return false
      }

      // noDeposit: only show items with no deposit or zero deposit
      if (customizeFilters.noDeposit && item.deposit && item.deposit > 0) {
        return false
      }

      return true
    })
  }

  // Step 2: Apply IB filter to Customize-filtered results
  if (filterByActiveIB && typeof filterByActiveIB === 'function') {
    filtered = filterByActiveIB(filtered, loginField)
  }

  // Step 3: Apply Group filter to IB-filtered results
  if (filterByActiveGroup && typeof filterByActiveGroup === 'function' && moduleName) {
    filtered = filterByActiveGroup(filtered, moduleName)
  }

  return filtered
}

/**
 * Apply only IB filter (for backward compatibility)
 * @param {Array} items - Array to filter
 * @param {Function} filterByActiveIB - IB filter function
 * @param {string} loginField - Field name for login
 * @returns {Array} Filtered array
 */
export function applyIBFilter(items, filterByActiveIB, loginField = 'login') {
  if (!filterByActiveIB || typeof filterByActiveIB !== 'function') {
    return items
  }
  return filterByActiveIB(items, loginField)
}

/**
 * Apply only Group filter (for backward compatibility)
 * @param {Array} items - Array to filter
 * @param {Function} filterByActiveGroup - Group filter function
 * @param {string} moduleName - Module name
 * @returns {Array} Filtered array
 */
export function applyGroupFilter(items, filterByActiveGroup, moduleName) {
  if (!filterByActiveGroup || typeof filterByActiveGroup !== 'function' || !moduleName) {
    return items
  }
  return filterByActiveGroup(items, moduleName)
}

/**
 * Apply only Customize View filters (for backward compatibility)
 * @param {Array} items - Array to filter
 * @param {Object} customizeFilters - Filter options {hasFloating, hasCredit, noDeposit}
 * @returns {Array} Filtered array
 */
export function applyCustomizeFilters(items, customizeFilters = {}) {
  if (!customizeFilters.hasFloating && !customizeFilters.hasCredit && !customizeFilters.noDeposit) {
    return items
  }

  return items.filter(item => {
    // hasFloating: only show items with non-zero profit
    if (customizeFilters.hasFloating && (!item.profit || item.profit === 0)) {
      return false
    }

    // hasCredit: only show items with non-zero credit
    if (customizeFilters.hasCredit && (!item.credit || item.credit === 0)) {
      return false
    }

    // noDeposit: only show items with no deposit or zero deposit
    if (customizeFilters.noDeposit && item.deposit && item.deposit > 0) {
      return false
    }

    return true
  })
}

/**
 * Apply search filter to items
 * @param {Array} items - Array to filter
 * @param {string} searchTerm - Search term
 * @param {Array} fields - Fields to search in
 * @returns {Array} Filtered array
 */
export function applySearchFilter(items, searchTerm, fields = []) {
  if (!searchTerm || !searchTerm.trim()) {
    return items
  }

  const lowerSearch = searchTerm.toLowerCase().trim()
  
  return items.filter(item => {
    return fields.some(field => {
      const value = item[field]
      if (value == null) return false
      return String(value).toLowerCase().includes(lowerSearch)
    })
  })
}

/**
 * Apply sorting to items
 * @param {Array} items - Array to sort
 * @param {string} sortKey - Key to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export function applySorting(items, sortKey, sortDirection = 'asc') {
  if (!sortKey || !items || items.length === 0) {
    return items
  }

  return [...items].sort((a, b) => {
    let aVal = a[sortKey]
    let bVal = b[sortKey]

    // Handle null/undefined
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return sortDirection === 'asc' ? 1 : -1
    if (bVal == null) return sortDirection === 'asc' ? -1 : 1

    // Handle numbers
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    }

    // Handle strings
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    
    if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
    if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
    return 0
  })
}