import { useState, useCallback, useMemo } from 'react'

interface UsePaginationOptions {
  defaultPageSize?: number
  defaultPage?: number
  storageKey?: string  // Optional localStorage key for persisting pageSize
}

interface UsePaginationReturn {
  page: number
  pageSize: number
  offset: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  totalPages: (total: number) => number
  resetToFirstPage: () => void
}

/**
 * Read pageSize from localStorage if storageKey is provided
 */
function getInitialPageSize(storageKey: string | undefined, defaultPageSize: number): number {
  if (!storageKey) return defaultPageSize
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) {
      const parsed = JSON.parse(stored)
      if (typeof parsed === 'number' && parsed > 0) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors, use default
  }
  return defaultPageSize
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { defaultPageSize = 10, defaultPage = 1, storageKey } = options

  const [page, setPageState] = useState(defaultPage)
  const [pageSize, setPageSizeState] = useState(() =>
    getInitialPageSize(storageKey, defaultPageSize)
  )

  const offset = useMemo(() => (page - 1) * pageSize, [page, pageSize])

  const totalPages = useCallback((total: number) => {
    return Math.max(1, Math.ceil(total / pageSize))
  }, [pageSize])

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage))
  }, [])

  const setPageSize = useCallback((newSize: number) => {
    // When page size changes, adjust current page to keep roughly the same position
    const currentFirstItem = (page - 1) * pageSize
    const newPage = Math.max(1, Math.floor(currentFirstItem / newSize) + 1)
    setPageSizeState(newSize)
    setPageState(newPage)

    // Persist to localStorage if storageKey provided
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(newSize))
      } catch {
        // Ignore storage errors
      }
    }
  }, [page, pageSize, storageKey])

  const resetToFirstPage = useCallback(() => {
    setPageState(1)
  }, [])

  return {
    page,
    pageSize,
    offset,
    setPage,
    setPageSize,
    totalPages,
    resetToFirstPage,
  }
}
