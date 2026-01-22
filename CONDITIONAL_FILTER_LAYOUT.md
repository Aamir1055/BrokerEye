# Conditional Filter Layout Implementation

## Overview
Updated Client2 filter UI to display condition layouts conditionally based on whether checkbox values exist for the column.

## Changes Made

### 1. Conditional Positioning Logic

#### For Columns WITH Checkbox Values (login, name, group, etc.)
- **Layout**: Collapsible side panel opens to the RIGHT
- **Button Icon**: Right arrow (→)
- **Position**: `top-0 left-full ml-2` (opens to the side)
- **Behavior**: Clean separation from checkbox list below

#### For Columns WITHOUT Checkbox Values (fees, credit, balance, etc.)
- **Layout**: Dropdown opens BELOW the button
- **Button Icon**: Down arrow (↓)
- **Position**: `top-full mt-2 left-0 right-0` (opens below)
- **Behavior**: Simple dropdown, no side navigation needed

### 2. Loading Spinner Optimization

**Problem**: Loading spinner was showing for ALL columns, even those that never fetch checkbox values

**Solution**: 
- Added conditional check in filter button click handler
- Only calls `fetchColumnValues()` for columns in the allowed list:
  - Identifiers: login, id
  - Names & contact: name, lastName, middleName, email, phone
  - Account metadata: group, accountType, status, currency, leverage, comment
  - Location: country, city, state, address, zipCode, company
  - Leads: leadSource, leadCampaign, processorType

- Numeric-only columns (fees, credit, balance, etc.) skip checkbox value fetching entirely
- Prevents unnecessary API calls and UI flickering

### 3. Sections Updated

#### Number Filters Section (Lines 4920-5140)
```jsx
{(columnValues[columnKey] || []).length > 0 ? (
  /* Has checkbox values - collapsible side panel */
  <div className="absolute top-0 left-full ml-2 w-64">
    {/* Opens to the right with → icon */}
  </div>
) : (
  /* No checkbox values - dropdown below */
  <div className="absolute top-full mt-2 left-0 right-0">
    {/* Opens below with ↓ icon */}
  </div>
)}
```

#### Text Filters Section (Lines 5364-5576)
- Same conditional logic as Number Filters
- Consistent UI pattern across both filter types

### 4. Closing Behavior
- Both layouts (side and below) properly close the parent filter dropdown
- OK button calls: `setShowFilterDropdown(null)` after applying filter
- Enter key handlers also close both menus

## Visual Differences

### Before (Always Side Panel)
```
[Column Header ▼]
  ├─ Sort Options
  ├─ Number Filters → [Side Panel]
  ├─ Text Filters → [Side Panel]
  └─ Checkbox Values List
```

### After (Conditional)

**With Checkboxes (login, name, group):**
```
[Column Header ▼]
  ├─ Sort Options
  ├─ Number Filters → [Side Panel]
  ├─ Text Filters → [Side Panel]
  └─ Checkbox Values List
```

**Without Checkboxes (fees, credit, balance):**
```
[Column Header ▼]
  ├─ Sort Options
  ├─ Number Filters ↓
  │   └─ [Dropdown Below]
  └─ Text Filters ↓
      └─ [Dropdown Below]
```

## Benefits

1. **Cleaner UI**: Columns without checkboxes don't need complex side navigation
2. **Better Performance**: No unnecessary API calls for numeric-only columns
3. **No Loading Spinner**: Columns that don't fetch data don't show loading states
4. **Consistent UX**: Users see simpler UI for simpler columns, richer UI for complex ones
5. **Space Efficiency**: Dropdown below uses vertical space better when no checkbox list exists

## Testing Checklist

- [ ] Open filter for columns WITH checkboxes (login, name, group)
  - [ ] Number Filters opens to the side with → icon
  - [ ] Text Filters opens to the side with → icon
  - [ ] Checkbox list appears below
  - [ ] OK button closes both menus

- [ ] Open filter for columns WITHOUT checkboxes (fees, credit, balance)
  - [ ] Number Filters opens below with ↓ icon
  - [ ] Text Filters opens below with ↓ icon
  - [ ] No checkbox list shown
  - [ ] No loading spinner shown
  - [ ] OK button closes both menus

- [ ] Verify no API calls made for non-checkbox columns
  - [ ] Check browser network tab
  - [ ] Confirm only allowed columns trigger /api/client2/column-values

## Files Modified

- `src/pages/Client2Page.jsx`
  - Line ~4800: Updated filter button click handler to conditionally fetch values
  - Line ~4920: Conditional Number Filters layout
  - Line ~5364: Conditional Text Filters layout
