import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

vi.mock('../api/useSqliteExplorer', () => ({
  useSqliteTables: vi.fn(),
  useSqliteTable: vi.fn(),
}))

import { useSqliteTables, useSqliteTable } from '../api/useSqliteExplorer'
import SqliteExplorerView, { renderCell } from './SqliteExplorerView'

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('SqliteExplorerView', () => {
  it('renders the table sidebar with table names', () => {
    vi.mocked(useSqliteTables).mockReturnValue({
      data: { tables: [{ name: 'agent_runs', rowCount: 42 }, { name: 'sessions', rowCount: 10 }] },
      isLoading: false,
    } as ReturnType<typeof useSqliteTables>)
    vi.mocked(useSqliteTable).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSqliteTable>)

    render(<SqliteExplorerView />, { wrapper: Wrapper })

    expect(screen.getByText('agent_runs')).toBeTruthy()
    expect(screen.getByText('sessions')).toBeTruthy()
  })

  it('shows loading skeletons when tables are loading', () => {
    vi.mocked(useSqliteTables).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useSqliteTables>)
    vi.mocked(useSqliteTable).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSqliteTable>)

    render(<SqliteExplorerView />, { wrapper: Wrapper })

    // Page heading should still render
    expect(screen.getByText('DB Explorer')).toBeTruthy()
  })

  it('shows empty state when no tables exist', () => {
    vi.mocked(useSqliteTables).mockReturnValue({
      data: { tables: [] },
      isLoading: false,
    } as ReturnType<typeof useSqliteTables>)
    vi.mocked(useSqliteTable).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSqliteTable>)

    render(<SqliteExplorerView />, { wrapper: Wrapper })

    expect(screen.getByText(/no tables found/i)).toBeTruthy()
  })

  it('prompts user to select a table before showing data', () => {
    vi.mocked(useSqliteTables).mockReturnValue({
      data: { tables: [{ name: 'sessions', rowCount: 5 }] },
      isLoading: false,
    } as ReturnType<typeof useSqliteTables>)
    vi.mocked(useSqliteTable).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useSqliteTable>)

    render(<SqliteExplorerView />, { wrapper: Wrapper })

    expect(screen.getByText(/select a table/i)).toBeTruthy()
  })
})

describe('renderCell — BLOB columns', () => {
  it('renders a compact BLOB summary for Buffer-shaped values', () => {
    const bufferValue = { type: 'Buffer', data: [1, 2, 3] }
    const node = renderCell('sz', bufferValue, false, () => {})
    render(<>{node}</>)

    // Must show byte count, not "[object Object]"
    expect(screen.getByText(/BLOB 3 bytes/)).toBeTruthy()
    expect(screen.queryByText('[object Object]')).toBeNull()
  })

  it('does not treat plain objects as BLOBs', () => {
    const plainObj = { foo: 'bar' }
    const node = renderCell('data', plainObj, false, () => {})
    render(<>{node}</>)

    // Should JSON-stringify it, not show BLOB
    expect(screen.queryByText(/BLOB/)).toBeNull()
    expect(screen.getByText(/foo/)).toBeTruthy()
  })
})
