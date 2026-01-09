# USD Normalization Implementation

## Overview
Implemented comprehensive USD currency normalization for the Positions module (both desktop and mobile views). This allows users to view all position values (profit, storage, commission) converted to USD for easier comparison across different currency pairs and symbols.

## Features Implemented

### 1. Currency Normalization Utility (`src/utils/currencyNormalization.js`)
Created a comprehensive utility module with the following features:

#### Exchange Rates
- **Supported Currencies**: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD
- **Base Currency**: USD (rate = 1.0)
- **Dynamic Updates**: `updateExchangeRates()` function allows real-time rate updates

#### Contract Sizes
- **Forex Pairs**: 100,000 (standard lot)
- **Gold (XAU)**: 100 oz
- **Silver (XAG)**: 5,000 oz
- **Indices**: 
  - US30: 10
  - NAS100: 20
  - SPX500: 50
- **Default**: 100,000 for unknown symbols

#### Core Functions

1. **`normalizePosition(position)`**
   - Converts a single position's profit, storage, and commission to USD
   - Adds new fields: `profit_usd`, `storage_usd`, `commission_usd`
   - Adds `currency` field (detected from symbol)
   - Preserves original values with `_original_*` prefix
   - Returns enhanced position object

2. **`normalizePositions(positions)`**
   - Batch normalizes an array of positions
   - Returns array of normalized positions

3. **`getTotalProfitUSD(positions)`**
   - Calculates total profit in USD across all positions
   - Useful for aggregate statistics

4. **`getCurrencyFromSymbol(symbol)`**
   - Extracts quote currency from symbol
   - For 6-character pairs (e.g., EURUSD), returns last 3 chars (USD)
   - Falls back to USD for non-standard symbols

5. **`normalizeVolume(volume, symbol)`**
   - Normalizes volume to standard lots
   - Divides by contract size

### 2. Desktop Implementation (`src/pages/PositionsPage.jsx`)

#### State Management
- Added `showNormalizedValues` toggle state (persisted in localStorage)
- Default: `false` (off by default)

#### Data Processing
```javascript
const normalizedPositions = useMemo(() => {
  if (!cachedPositions || cachedPositions.length === 0) return cachedPositions
  return normalizePositions(cachedPositions)
}, [cachedPositions])

const displayPositions = showNormalizedValues ? normalizedPositions : cachedPositions
```

#### UI Components

1. **USD Toggle Button**
   - Location: Top action bar, between "Display Mode" and "Export CSV"
   - Visual States:
     - **Active**: Blue background (`bg-blue-50`), blue text
     - **Inactive**: White background, gray text
   - Icon: Dollar sign in circle
   - Label: "USD"

2. **Table Columns Updated**
   - **Profit Column**: Shows `profit_usd` when toggle is on, `profit` when off
   - **Storage Column**: Shows `storage_usd` when toggle is on, `storage` when off
   - **Commission Column**: Shows `commission_usd` when toggle is on, `commission` when off
   - Each normalized value displays "USD" suffix in small text

3. **Summary Statistics**
   - Face cards use `profit_usd` when normalization is enabled
   - Total Floating Profit calculated with USD values

4. **NET Positions**
   - Automatically uses normalized values when toggle is on
   - Works for both Global NET and Client NET views

### 3. Mobile Implementation (`src/components/PositionModule.jsx`)

#### State Management
- Separate localStorage key: `showNormalizedValues_mobile`
- Same toggle behavior as desktop

#### Data Processing
```javascript
const normalizedPositions = useMemo(() => {
  if (!positions || positions.length === 0) return positions
  return normalizePositions(positions)
}, [positions])

const displayPositions = showNormalizedValues ? normalizedPositions : positions
```

#### UI Components

1. **USD Toggle Button**
   - Location: Top action row, after Filter button
   - Same visual states as desktop
   - Compact size for mobile (h-8 px-3)

2. **Cell Rendering**
   - Updated `renderCell()` function for profit, storage, and commission
   - Conditional display based on `showNormalizedValues`
   - Shows "USD" suffix when normalized

3. **Face Cards**
   - Total Profit uses `profit_usd` when enabled

## Technical Details

### USC Symbol Handling
- Existing `adjustValueForSymbol()` function continues to work
- USC symbols (ending in 'c' or 'C') divide by 100
- Normalization happens after USC adjustment

### Data Flow
```
Raw Position Data (WebSocket/API)
    ↓
normalizePositions() 
    ↓
Add profit_usd, storage_usd, commission_usd fields
    ↓
displayPositions (toggle dependent)
    ↓
Filters & Sorting
    ↓
Display in UI
```

### Performance Optimization
- Used `useMemo()` for normalization to prevent unnecessary recalculations
- Only normalizes when source positions change
- Toggle switch is instant (no re-normalization needed)

### Preserved Functionality
- All existing features continue to work:
  - WebSocket real-time updates
  - Flash indicators for position changes
  - Percentage display modes
  - NET positions calculations
  - Group/IB filtering
  - Date filtering
  - Column customization

## Currency Detection Logic

The system detects currency from symbol patterns:
- **Standard Forex**: Last 3 characters (e.g., EURUSD → USD)
- **Metals**: 
  - XAUUSD → USD (Gold)
  - XAGUSD → USD (Silver)
- **Indices**: 
  - US30 → USD
  - NAS100 → USD
  - SPX500 → USD
- **Fallback**: USD for unknown patterns

## Exchange Rate Updates

Current rates (hardcoded):
```javascript
USD: 1.0
EUR: 1.10
GBP: 1.27
JPY: 0.0067
AUD: 0.66
CAD: 0.74
CHF: 1.16
NZD: 0.60
```

To update rates dynamically:
```javascript
import { updateExchangeRates } from '../utils/currencyNormalization'

// Fetch from API
const newRates = await fetchExchangeRates()
updateExchangeRates(newRates)
```

## Testing Checklist

### Desktop View
- [ ] Toggle button appears and works
- [ ] Profit displays USD values when enabled
- [ ] Storage displays USD values when enabled
- [ ] Commission displays USD values when enabled
- [ ] Face cards show USD totals when enabled
- [ ] NET positions use USD calculations when enabled
- [ ] Toggle state persists after page reload
- [ ] WebSocket updates work with normalization
- [ ] Flash indicators work correctly
- [ ] Sorting works with normalized values
- [ ] Filtering works with normalized values

### Mobile View
- [ ] Toggle button appears and works
- [ ] Profit cells show USD values when enabled
- [ ] Storage cells show USD values when enabled
- [ ] Commission cells show USD values when enabled
- [ ] Face cards show USD totals when enabled
- [ ] Toggle state persists after page reload
- [ ] Scrolling works smoothly
- [ ] NET positions work correctly

### Currency Conversion
- [ ] EUR positions convert correctly
- [ ] GBP positions convert correctly
- [ ] JPY positions convert correctly (division by ~150)
- [ ] AUD positions convert correctly
- [ ] Gold (XAUUSD) positions work
- [ ] Silver (XAGUSD) positions work
- [ ] Index positions work
- [ ] Mixed currency portfolios show correct totals

## Future Enhancements

### Potential Improvements
1. **Real-time Exchange Rates**
   - Integrate with forex API (e.g., exchangerate-api.com)
   - Update rates every hour or on demand
   - Show last update timestamp

2. **Multi-Currency Display**
   - Allow users to select base currency (USD, EUR, GBP, etc.)
   - Convert to user's preferred currency
   - Remember user preference

3. **Exchange Rate Indicator**
   - Show exchange rates used in UI
   - Display rate staleness warning
   - Manual rate override option

4. **Historical Rate Support**
   - Use historical rates for closed positions
   - Store rate used at position open time
   - Compare performance across time periods

5. **Volume Normalization Display**
   - Show normalized volume in separate column
   - Toggle between contract volume and standard lots
   - Display contract size in tooltip

6. **Export with Normalization**
   - CSV export includes both original and USD values
   - Separate columns for each currency
   - Rate table in export header

## Files Modified

1. **Created**: `src/utils/currencyNormalization.js` (207 lines)
2. **Modified**: `src/pages/PositionsPage.jsx` 
   - Added import
   - Added state and normalization logic (30 lines)
   - Added USD toggle button (18 lines)
   - Updated profit/storage/commission display (30 lines)
   - Updated summary stats calculation (6 lines)

3. **Modified**: `src/components/PositionModule.jsx`
   - Added import
   - Added state and normalization logic (30 lines)
   - Added USD toggle button (15 lines)
   - Updated cell rendering for profit/storage/commission (30 lines)
   - Updated face card calculations (4 lines)

## Total Lines Added
- New file: 207 lines
- PositionsPage.jsx: ~84 lines
- PositionModule.jsx: ~79 lines
- **Total**: ~370 lines of code

## Configuration

No configuration required. The feature is:
- **Opt-in**: Disabled by default
- **Persistent**: User preference saved in localStorage
- **Independent**: Desktop and mobile have separate toggles
- **Non-breaking**: All existing functionality preserved

## Notes

- Exchange rates are currently hardcoded and should be updated regularly
- The system assumes standard contract sizes for common instruments
- Currency detection works for 6-character forex pairs (e.g., EURUSD, GBPJPY)
- Exotic pairs or custom symbols may need additional handling
- Original values are always preserved and can be displayed by toggling off
