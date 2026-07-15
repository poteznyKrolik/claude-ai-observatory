import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useSqliteTables, useSqliteTable } from './useSqliteExplorer'
import type { SqliteTablesData, SqliteTableData } from './useSqliteExplorer'

// ─── Fetch mock helpers ──────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  })
}

// ─── Wrapper ─────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_TABLES: SqliteTablesData = {
  tables: [
    { name: 'agent_runs', rowCount: 241 },
    { name: 'task_queue', rowCount: 0 },
    { name: 'memories', rowCount: 29 },
  ],
}

const EMPTY_TABLES: SqliteTablesData = {
  tables: [],
}

const MOCK_TABLE_DATA: SqliteTableData = {
  columns: ['id', 'agent', 'status'],
  rows: [
    { id: 'run-1', agent: 'code-writer', status: 'done' },
    { id: 'run-2', agent: 'debugger', status: 'done' },
  ],
  total: 2,
  nullColumns: [],
}

const EMPTY_TABLE_DATA: SqliteTableData = {
  columns: ['id', 'agent', 'status'],
  rows: [],
  total: 0,
  nullColumns: [],
}

// ─── useSqliteTables ─────────────────────────────────────────────────────────

describe('useSqliteTables', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_TABLES)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useSqliteTables(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/cast/explore/tables', async () => {
    const { result } = renderHook(() => useSqliteTables(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/explore/tables')
  })

  it('returns the tables array on success', async () => {
    const { result } = renderHook(() => useSqliteTables(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const tables = result.current.data!.tables
    expect(tables).toHaveLength(3)
    expect(tables.map(t => t.name)).toContain('agent_runs')
    expect(tables.map(t => t.name)).toContain('task_queue')
    expect(tables.map(t => t.name)).toContain('memories')
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useSqliteTables(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty tables array when no tables exist', async () => {
    global.fetch = makeFetchOk(EMPTY_TABLES)
    const { result } = renderHook(() => useSqliteTables(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.tables).toHaveLength(0)
  })
})

// ─── useSqliteTable ───────────────────────────────────────────────────────────

describe('useSqliteTable', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_TABLE_DATA)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not fetch when table is null', () => {
    const { result } = renderHook(
      () => useSqliteTable(null),
      { wrapper: makeWrapper() }
    )
    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetches from /api/cast/explore/:table when a table name is provided', async () => {
    const { result } = renderHook(
      () => useSqliteTable('agent_runs'),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/explore/agent_runs')
  })

  it('appends limit and offset query params when provided', async () => {
    const { result } = renderHook(
      () => useSqliteTable('agent_runs', { limit: 20, offset: 40 }),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    expect(url).toContain('limit=20')
    expect(url).toContain('offset=40')
  })

  it('returns columns, rows, and total on success', async () => {
    const { result } = renderHook(
      () => useSqliteTable('agent_runs'),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.columns).toEqual(['id', 'agent', 'status'])
    expect(data.rows).toHaveLength(2)
    expect(data.rows[0]).toMatchObject({ id: 'run-1', agent: 'code-writer' })
    expect(data.total).toBe(2)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(
      () => useSqliteTable('agent_runs'),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty rows array when the table has no data', async () => {
    global.fetch = makeFetchOk(EMPTY_TABLE_DATA)
    const { result } = renderHook(
      () => useSqliteTable('agent_runs'),
      { wrapper: makeWrapper() }
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data!.rows).toHaveLength(0)
    expect(result.current.data!.total).toBe(0)
  })
})
