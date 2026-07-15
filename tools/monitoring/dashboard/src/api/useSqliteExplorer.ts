import { useQuery } from '@tanstack/react-query'

export interface SqliteTableMeta {
  name: string
  rowCount: number
}

export interface SqliteTablesData {
  tables: SqliteTableMeta[]
}

export interface SqliteTableData {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  nullColumns: string[]
}

export interface SqliteTableParams {
  limit?: number
  offset?: number
}

async function fetchSqliteTables(): Promise<SqliteTablesData> {
  const res = await fetch('/api/cast/explore/tables')
  if (!res.ok) throw new Error('Failed to fetch tables')
  return res.json()
}

async function fetchSqliteTable(table: string, params: SqliteTableParams): Promise<SqliteTableData> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))
  const url = `/api/cast/explore/${table}${searchParams.toString() ? `?${searchParams}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch table ${table}`)
  return res.json()
}

export const useSqliteTables = () =>
  useQuery({
    queryKey: ['cast', 'explore', 'tables'],
    queryFn: fetchSqliteTables,
    staleTime: 10_000,
  })

export const useSqliteTable = (table: string | null, params: SqliteTableParams = {}) =>
  useQuery({
    queryKey: ['cast', 'explore', 'table', table, params],
    queryFn: () => fetchSqliteTable(table!, params),
    enabled: !!table,
    staleTime: 30_000,
  })
