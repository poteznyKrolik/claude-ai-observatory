import { describe, it, expect, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { verifySchema, EXPECTED_SCHEMA } from '../utils/schemaGuard.js'

// C4: verifySchema is the durable schema-drift guard, but its detection logic only
// runs via schemaContract.test.ts's it.runIf(dbExists) against a live cast.db — so in
// clean CI it never executes. These deterministic in-memory tests exercise the logic
// itself (no live cast.db, no $HOME).

let db: ReturnType<typeof Database> | null = null

afterEach(() => {
  db?.close()
  db = null
})

function createTable(database: ReturnType<typeof Database>, table: string, cols: string[]) {
  const colDefs = cols.map(c => `"${c}"`).join(', ')
  database.exec(`CREATE TABLE "${table}" (${colDefs})`)
}

function buildFullSchema(database: ReturnType<typeof Database>) {
  for (const [table, cols] of Object.entries(EXPECTED_SCHEMA)) {
    createTable(database, table, cols)
  }
}

describe('verifySchema', () => {
  it('returns [] when every expected table and column is present', () => {
    db = new Database(':memory:')
    buildFullSchema(db)
    expect(verifySchema(db)).toEqual([])
  })

  it('flags a missing column as missing-columns drift naming the column', () => {
    db = new Database(':memory:')
    for (const [table, cols] of Object.entries(EXPECTED_SCHEMA)) {
      // Omit a real expected column from agent_runs
      const use = table === 'agent_runs' ? cols.filter(c => c !== 'cost_usd') : cols
      createTable(db, table, use)
    }
    const drift = verifySchema(db)
    const arDrift = drift.find(d => d.table === 'agent_runs')
    expect(arDrift).toBeDefined()
    expect(arDrift?.status).toBe('missing-columns')
    expect(arDrift?.missing).toContain('cost_usd')
  })

  it('flags a missing table as missing-table drift', () => {
    db = new Database(':memory:')
    for (const [table, cols] of Object.entries(EXPECTED_SCHEMA)) {
      if (table === 'sessions') continue // omit the table entirely
      createTable(db, table, cols)
    }
    const drift = verifySchema(db)
    const sessDrift = drift.find(d => d.table === 'sessions')
    expect(sessDrift).toBeDefined()
    expect(sessDrift?.status).toBe('missing-table')
    expect(sessDrift?.missing).toEqual(EXPECTED_SCHEMA.sessions)
  })
})
