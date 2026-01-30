# 📚 BrokerEye Module Migration Guide

This guide shows you exactly what code to move where in your new modular structure.

---

## 🎯 PHASE 1: SHARED RESOURCES

### 1️⃣ shared/constants/index.js

**Purpose:** Store all magic numbers, default values, and configuration constants

**What to extract:**

```javascript
// ==================== PAGINATION ====================
// Find in: PositionsPage.jsx, Client2Page.jsx, PendingOrdersPage.jsx
// Look for: const itemsPerPage = 12
// Look for: const [currentPage, setCurrentPage] = useState(1)
export const PAGINATION = {
  ITEMS_PER_PAGE: 12,
  NET_ITEMS_PER_PAGE: 12,
  DEFAULT_PAGE: 1
}

// ==================== API CONFIGURATION ====================
// Find in: services/api.js
// Look for: timeout: 30000
export const API_CONFIG = {
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
}

// ==================== LOCAL STORAGE KEYS ====================
// Find in: All pages with localStorage.getItem/setItem
// Look for: 'access_token', 'sidebarOpen', 'visibleColumns'
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
// Find in: All pages with window.innerWidth <= 768
// Look for: setIsMobile(window.innerWidth <= 768)
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280
}

// ==================== DEFAULT VISIBLE COLUMNS ====================
// Find in: PositionsPage.jsx, LiveDealingPage.jsx, PendingOrdersPage.jsx
// Look for: useState with column visibility objects
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

// ==================== COLORS ====================
export const COLORS = {
  PRIMARY: '#1A63BC',
  SUCCESS: '#10B981',
  DANGER: '#EF4444',
  WARNING: '#F59E0B',
  BUY: '#10B981',
  SELL: '#EF4444'
}
```

---

### 2️⃣ shared/constants/apiEndpoints.js

**Purpose:** All API route definitions

**What to extract:**

```javascript
// Find in: services/api.js
// Look for: all API endpoint strings

export const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH_TOKEN: '/auth/refresh',
  VERIFY_2FA: '/auth/verify-2fa',
  SETUP_2FA: '/auth/setup-2fa'
}

export const CLIENT_ENDPOINTS = {
  LIST: '/clients',
  DETAILS: (login) => `/clients/${login}`,
  POSITIONS: (login) => `/clients/${login}/positions`,
  PERCENTAGE: '/clients/percentage',
  UPDATE_PERCENTAGE: (login) => `/clients/${login}/percentage`
}

export const POSITION_ENDPOINTS = {
  LIST: '/positions',
  DETAILS: (id) => `/positions/${id}`
}

export const ORDER_ENDPOINTS = {
  LIST: '/orders',
  PENDING: '/orders/pending'
}

export const DASHBOARD_ENDPOINTS = {
  STATS: '/dashboard/stats'
}

export const GROUP_ENDPOINTS = {
  LIST: '/groups',
  CREATE: '/groups',
  UPDATE: (id) => `/groups/${id}`,
  DELETE: (id) => `/groups/${id}`
}

export const IB_ENDPOINTS = {
  LIST: '/ib/list',
  ACCOUNTS: '/ib/accounts'
}
```

---

### 3️⃣ shared/constants/routes.js

**Purpose:** Application route paths

**What to extract:**

```javascript
// Find in: App.jsx
// Look for: all <Route path="..." />

export const ROUTES = {
  LOGIN: '/',
  DASHBOARD: '/dashboard',
  CLIENTS: '/clients',
  POSITIONS: '/positions',
  PENDING_ORDERS: '/pending-orders',
  MARGIN_LEVEL: '/margin-level',
  LIVE_DEALING: '/live-dealing',
  CLIENT_PERCENTAGE: '/client-percentage',
  SETTINGS: '/settings'
}

// Find in: services/api.js
// Look for: getBasePath function
export const getBasePath = () => {
  try {
    const path = window.location?.pathname || '/'
    const match = path.match(/^\/(amari-capital|broker-branch|broker)\b/)
    return match ? `/${match[1]}` : ''
  } catch {
    return ''
  }
}
```

---

### 4️⃣ shared/utils/formatters.js

**Purpose:** Formatting functions (numbers, dates, currency)

**What to create (NEW FILE):**

```javascript
/**
 * Format number with Indian locale
 * Find in: Multiple components
 * Look for: toLocaleString('en-IN')
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
 * Format currency
 */
export const formatCurrency = (amount, currency = 'USD') => {
  return `${formatNumber(amount)} ${currency}`
}

/**
 * Format percentage
 */
export const formatPercentage = (value) => {
  return `${formatNumber(value, 2)}%`
}

/**
 * Format volume
 */
export const formatVolume = (volume) => {
  return formatNumber(volume, 2)
}
```

---

### 5️⃣ shared/utils/currencyNormalization.js

**Action:** COPY existing file as-is
**From:** `src/utils/currencyNormalization.js`
**To:** `shared/utils/currencyNormalization.js`

**No changes needed** - This file is already well-structured!

---

### 6️⃣ shared/utils/dateFormatter.js

**Action:** COPY existing file as-is
**From:** `src/utils/dateFormatter.js`
**To:** `shared/utils/dateFormatter.js`

**No changes needed** - This file is already well-structured!

---

### 7️⃣ shared/utils/mobileFilters.js

**Action:** COPY existing file as-is
**From:** `src/utils/mobileFilters.js`
**To:** `shared/utils/mobileFilters.js`

**No changes needed** - This file is already well-structured!

---

### 8️⃣ shared/services/api.js

**Action:** COPY existing file
**From:** `src/services/api.js`
**To:** `shared/services/api.js`

**Then UPDATE imports:**

```javascript
// Add at the top
import { API_CONFIG, STORAGE_KEYS } from '../constants'
import { BASE_URL, IB_BASE_URL, AUTH_ENDPOINTS } from '../constants/apiEndpoints'

// Replace all hardcoded values:
// - Replace 30000 with API_CONFIG.TIMEOUT
// - Replace 'access_token' with STORAGE_KEYS.ACCESS_TOKEN
// - Replace 'refresh_token' with STORAGE_KEYS.REFRESH_TOKEN
```

---

### 9️⃣ shared/services/websocket.js

**Action:** COPY existing file
**From:** `src/services/websocket.js`
**To:** `shared/services/websocket.js`

**Then UPDATE imports:**

```javascript
// Add at the top
import { STORAGE_KEYS } from '../constants'

// Replace 'access_token' with STORAGE_KEYS.ACCESS_TOKEN
```

---

### 🔟 shared/contexts/

**Action:** MOVE all context files
**From:** `src/contexts/*.jsx`
**To:** `shared/contexts/*.jsx`

**Files to move:**
- AuthContext.jsx
- DataContext.jsx
- GroupContext.jsx
- IBContext.jsx

**Then UPDATE their imports:**

```javascript
// In each context file, update:
import { STORAGE_KEYS } from '../constants'
import api from '../services/api'
import websocketService from '../services/websocket'

// Replace all hardcoded localStorage keys with STORAGE_KEYS.*
```

---

### 1️⃣1️⃣ shared/hooks/ (CREATE NEW)

**File: shared/hooks/useDebounce.js**

```javascript
/**
 * Debounce hook for search inputs
 * Extract from: Any component with search functionality
 */
import { useState, useEffect } from 'react'

export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
```

**File: shared/hooks/usePagination.js**

```javascript
/**
 * Pagination hook
 * Extract from: PositionsPage, Client2Page, etc.
 */
import { useState, useMemo } from 'react'
import { PAGINATION } from '../constants'

export const usePagination = (items = [], itemsPerPage = PAGINATION.ITEMS_PER_PAGE) => {
  const [currentPage, setCurrentPage] = useState(PAGINATION.DEFAULT_PAGE)

  const totalPages = Math.ceil(items.length / itemsPerPage)
  
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return items.slice(startIndex, endIndex)
  }, [items, currentPage, itemsPerPage])

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const nextPage = () => goToPage(currentPage + 1)
  const prevPage = () => goToPage(currentPage - 1)
  const resetPage = () => setCurrentPage(1)

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  }
}
```

**File: shared/hooks/useSort.js**

```javascript
/**
 * Sorting hook
 * Extract from: PositionsPage, Client2Page
 */
import { useState, useMemo } from 'react'
import { SORT_DIRECTION } from '../constants'

export const useSort = (items = [], defaultColumn = null) => {
  const [sortColumn, setSortColumn] = useState(defaultColumn)
  const [sortDirection, setSortDirection] = useState(SORT_DIRECTION.ASC)

  const sortedItems = useMemo(() => {
    if (!sortColumn) return items

    return [...items].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === bVal) return 0
      
      const comparison = aVal > bVal ? 1 : -1
      return sortDirection === SORT_DIRECTION.ASC ? comparison : -comparison
    })
  }, [items, sortColumn, sortDirection])

  const toggleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(d => d === SORT_DIRECTION.ASC ? SORT_DIRECTION.DESC : SORT_DIRECTION.ASC)
    } else {
      setSortColumn(column)
      setSortDirection(SORT_DIRECTION.ASC)
    }
  }

  const resetSort = () => {
    setSortColumn(defaultColumn)
    setSortDirection(SORT_DIRECTION.ASC)
  }

  return {
    sortColumn,
    sortDirection,
    sortedItems,
    toggleSort,
    resetSort
  }
}
```

**File: shared/hooks/useMobile.js**

```javascript
/**
 * Mobile detection hook
 * Extract from: All pages with isMobile state
 */
import { useState, useEffect } from 'react'
import { BREAKPOINTS } from '../constants'

export const useMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= BREAKPOINTS.MOBILE
    }
    return false
  })

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= BREAKPOINTS.MOBILE)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
```

---

### 1️⃣2️⃣ shared/components/layout/

**Move these files:**

**From:** `src/components/Sidebar.jsx`  
**To:** `shared/components/layout/Sidebar.jsx`

**From:** `src/components/Header.jsx`  
**To:** `shared/components/layout/Header.jsx`

**From:** `src/components/Footer.jsx`  
**To:** `shared/components/layout/Footer.jsx`

**Update imports in these files to use shared paths**

---

### 1️⃣3️⃣ shared/components/feedback/

**Move these files:**

**From:** `src/components/LoadingSpinner.jsx`  
**To:** `shared/components/feedback/LoadingSpinner.jsx`

**From:** `src/components/WebSocketIndicator.jsx`  
**To:** `shared/components/feedback/WebSocketIndicator.jsx`

---

### 1️⃣4️⃣ shared/components/modals/

**Move these files:**

- CustomizeViewModal.jsx
- FilterModal.jsx
- DateFilterModal.jsx
- TimeFilterModal.jsx
- DealsFilterModal.jsx
- GroupModal.jsx
- IBFilterModal.jsx
- LoginDetailsModal.jsx
- ShowHideColumnsModal.jsx

**From:** `src/components/`  
**To:** `shared/components/modals/`

---

## ✅ PHASE 1 COMPLETE CHECKLIST

- [ ] Created shared/constants/index.js
- [ ] Created shared/constants/apiEndpoints.js
- [ ] Created shared/constants/routes.js
- [ ] Copied utils files to shared/utils/
- [ ] Created shared/utils/formatters.js
- [ ] Moved services to shared/services/
- [ ] Updated api.js imports
- [ ] Moved contexts to shared/contexts/
- [ ] Updated context imports
- [ ] Created shared/hooks/
- [ ] Moved layout components
- [ ] Moved feedback components
- [ ] Moved modal components

---

## 🎯 NEXT: PHASE 2 - MODULES

After completing Phase 1, we'll refactor each module:
1. auth module (Login)
2. dashboard module
3. clients module
4. positions module
5. ...and so on

**Ready to start Phase 1?** Let me know when you've completed these steps and we'll move to Phase 2!
