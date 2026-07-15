import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationFirst,
  PaginationPrevious,
  PaginationNext,
  PaginationLast,
} from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

interface DataPaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
}

export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  // Don't render if no data
  if (total === 0) {
    return null
  }

  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  const handleClick = (newPage: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    onPageChange(newPage)
  }

  return (
    <div className="flex items-center justify-between gap-4 pt-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Rows per page:</span>
        <Select
          value={pageSize.toString()}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="w-20"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {startItem}-{endItem} of {total}
        </span>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationFirst
                href="#"
                onClick={handleClick(1)}
                disabled={isFirstPage}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={handleClick(page - 1)}
                disabled={isFirstPage}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="flex h-10 items-center px-2 text-sm">
                Page {page} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={handleClick(page + 1)}
                disabled={isLastPage}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationLast
                href="#"
                onClick={handleClick(totalPages)}
                disabled={isLastPage}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
