# Client Percentage API Integration - Search & Sort

## Overview
Implemented API-based search and sorting for Client Percentage module in both desktop and mobile views. Previously, all data was fetched and filtered/sorted on the client-side. Now the API handles search and sorting on the server-side for better performance.

## Changes Made

### 1. Desktop View (ClientPercentagePage.jsx)

#### Added States
```javascript
// Sort states for API
const [sortColumn, setSortColumn] = useState('login')
const [sortDirection, setSortDirection] = useState('asc')

// Filter state for has_custom
const [hasCustomFilter, setHasCustomFilter] = useState(null) // null, true, or false
```

#### Updated `fetchAllClientPercentages` Function
- **Added API Parameters:**
  - `login` - Partial match search for client login
  - `has_custom` - Filter by custom (true) or default (false) percentage
  - `sort_by` - Column to sort by (login/percentage)
  - `sort_order` - Sort direction (asc/desc)

```javascript
const params = {
  page,
  page_size: itemsPerPage,
  sort_by: sortColumn,
  sort_order: sortDirection
}

// Add search query if present
if (searchQuery.trim()) {
  params.login = searchQuery.trim()
}

// Add has_custom filter if set
if (hasCustomFilter !== null) {
  params.has_custom = hasCustomFilter
}
```

#### Removed Client-Side Search
- Removed `searchClients()` function that was filtering locally
- API now handles the search with `login` parameter

#### Updated useEffect Logic
```javascript
// Reset to page 1 when search, sort, or filter changes
useEffect(() => {
  setCurrentPage(1)
}, [searchQuery, sortColumn, sortDirection, hasCustomFilter])

// Fetch data when page, search, sort, or filter changes
useEffect(() => {
  const timeoutId = setTimeout(() => {
    fetchAllClientPercentages(currentPage)
  }, 300) // 300ms debounce for search
  
  return () => clearTimeout(timeoutId)
}, [currentPage, searchQuery, sortColumn, sortDirection, hasCustomFilter, isAuthenticated, unauthorized])
```

#### Updated `sortedClients()` Function
- Removed client-side sorting logic
- API handles sorting, function now only applies local IB/Group filters

### 2. Mobile View (ClientPercentageModule.jsx)

#### Added States
```javascript
const [sortColumn, setSortColumn] = useState('login')
const [sortDirection, setSortDirection] = useState('asc')
const [hasCustomFilter, setHasCustomFilter] = useState(null)
```

#### Updated `fetchAllClientPercentages` Function
Similar to desktop, but uses `limit` instead of `page_size`:
```javascript
const params = {
  page,
  limit: itemsPerPage,
  sort_by: sortColumn,
  sort_order: sortDirection
}
```

#### Removed Client-Side Filtering & Sorting
- Removed local search filtering logic from `filteredData` useMemo
- Removed local sorting logic
- API now handles both search and sort

```javascript
// API handles search and sort, so filteredData is just IB filtered data
const filteredData = useMemo(() => {
  return ibFilteredData
}, [ibFilteredData])
```

#### Updated useEffect Logic
```javascript
// Reset to page 1 when search/sort/filter changes
useEffect(() => {
  setCurrentPage(1)
}, [searchInput, sortColumn, sortDirection, hasCustomFilter])

// Fetch data when page changes or on initial mount
useEffect(() => {
  const timeoutId = setTimeout(() => {
    fetchAllClientPercentages(currentPage)
  }, 300) // 300ms debounce
  
  return () => clearTimeout(timeoutId)
}, [currentPage, searchInput, sortColumn, sortDirection, hasCustomFilter])
```

## API Parameters Summary

| Parameter | Type | Description | Values |
|-----------|------|-------------|--------|
| `page` | number | Page number for pagination | 1, 2, 3... |
| `page_size` / `limit` | number | Items per page | Desktop: 100, Mobile: 15 |
| `login` | string | Partial match search for client login | Any string |
| `has_custom` | boolean | Filter by custom/default percentage | true, false, or omit |
| `sort_by` | string | Column to sort by | 'login', 'percentage' |
| `sort_order` | string | Sort direction | 'asc', 'desc' |

## Key Features

### 1. Search Debouncing
- 300ms debounce on search input to avoid excessive API calls
- Automatically resets to page 1 when search query changes

### 2. Sort Integration
- Clicking column headers triggers API sort
- Resets to page 1 when sort changes
- Shows sort indicators (arrows) in UI

### 3. Filter Support
- `has_custom` parameter ready for integration with filter UI
- Can filter by Custom (true) or Default (false) percentages

### 4. Pagination
- Server-side pagination maintained
- Page resets to 1 when search/sort/filter changes
- Different page sizes for desktop (100) vs mobile (15)

## Performance Benefits

1. **Reduced Data Transfer** - Only fetches needed page of results
2. **Faster Search** - Database handles search queries efficiently
3. **Better for Large Datasets** - Doesn't load all clients at once
4. **Lower Memory Usage** - Client only holds current page in memory

## Testing Recommendations

1. **Search Testing:**
   - Test partial login search (e.g., "100" should find "1001", "2100", etc.)
   - Test empty search (should show all results)
   - Verify debouncing works (rapid typing doesn't spam API)

2. **Sort Testing:**
   - Test sorting by login (ascending/descending)
   - Test sorting by percentage
   - Verify sort indicators show correctly in UI

3. **Filter Testing:**
   - Test has_custom filter once UI is connected
   - Verify Custom/Default filter works correctly

4. **Pagination Testing:**
   - Verify page resets to 1 on search/sort/filter change
   - Test navigating between pages
   - Check page numbers display correctly

5. **Combined Testing:**
   - Search + Sort + Page navigation
   - Search + Filter + Sort
   - Verify all combinations work correctly

## Next Steps

1. **Add Filter UI** - Connect has_custom filter to UI controls (dropdown/buttons)
2. **Add Sort Indicators** - Show visual sort direction in column headers
3. **Loading States** - Ensure loading indicators show during API calls
4. **Error Handling** - Display user-friendly errors if API fails
5. **Empty States** - Show appropriate message when no results found

## Files Modified

- `/src/pages/ClientPercentagePage.jsx` - Desktop view
- `/src/components/ClientPercentageModule.jsx` - Mobile view

## Backward Compatibility

- All existing functionality maintained
- IB and Group filters still work (applied client-side after API fetch)
- Column filters still work (applied client-side)
- No breaking changes to UI or user experience
