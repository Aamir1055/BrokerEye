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
