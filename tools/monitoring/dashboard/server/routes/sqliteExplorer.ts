import { Router } from 'express'
import { getCastDb } from './castDb.js'

export const sqliteExplorerRouter = Router()

// Tables denied from the explorer (internal SQLite / Litestream implementation tables)
const DENIED_TABLES = new Set([
  '_litestream_lock',
  '_litestream_seq',
  'sqlite_sequence',
])

function isDenied(name: string): boolean {
  return DENIED_TABLES.has(name) || name.startsWith('sqlite_')
}

sqliteExplorerRouter.get('/tables', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ tables: [] })
    }
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>

    // Expose all real tables except the internal deny-listed ones
    const allowedNames = rows.map(r => r.name).filter(n => !isDenied(n))

    const tables = allowedNames.map(name => {
      const countRow = db.prepare(`SELECT COUNT(*) AS total FROM "${name}"`).get() as { total: number }
      return { name, rowCount: countRow.total }
    })

    res.json({ tables })
  } catch (err) {
    console.error('SQLite explorer tables error:', err)
    res.status(500).json({ error: 'Failed to list tables' })
  }
})

sqliteExplorerRouter.get('/:table', (req, res) => {
  const { table } = req.params
  if (isDenied(table)) {
    return res.status(400).json({ error: `Table '${table}' is not accessible` })
  }

  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ columns: [], rows: [], total: 0, nullColumns: [] })
    }

    // Verify the table actually exists in the DB before querying it
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(table)
    if (!tableExists) {
      return res.status(404).json({ error: `Table '${table}' does not exist` })
    }

    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200))
    const offset = Number(req.query.offset) || 0

    const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get() as { total: number }

    // Get column names from PRAGMA
    const pragmaRows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; pk: number }>
    const columns = pragmaRows.map(r => r.name)

    // Sort newest-first if the table has an integer primary key named 'id'
    const hasPkId = pragmaRows.some(r => r.name === 'id' && r.pk === 1)
    const orderClause = hasPkId ? 'ORDER BY id DESC' : ''

    const rows = db.prepare(
      `SELECT * FROM "${table}" ${orderClause} LIMIT ? OFFSET ?`
    ).all(limit, offset) as Array<Record<string, unknown>>

    // Compute which columns are ALL NULL across returned rows
    const nullColumns: string[] = rows.length > 0
      ? columns.filter(col => rows.every(row => row[col] === null || row[col] === undefined))
      : []

    res.json({ columns, rows, total: totalRow.total, nullColumns })
  } catch (err) {
    console.error('SQLite explorer table error:', err)
    res.status(500).json({ error: 'Failed to query table' })
  }
})
