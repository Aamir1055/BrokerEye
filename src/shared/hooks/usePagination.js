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
