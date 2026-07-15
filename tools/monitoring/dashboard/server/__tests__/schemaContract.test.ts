import { describe, it, expect } from 'vitest'
import fs from 'fs'
import Database from 'better-sqlite3'
import { CAST_DB } from '../constants.js'
import { EXPECTED_SCHEMA, verifySchema } from '../utils/schemaGuard.js'

/**
 * The durable guard against the schema-drift bug class (the one that produced
 * the `task_summary`, `dispatch_decisions`, `plans`, and `mismatch_signals`
 * bugs). If CAST renames/drops a column the dashboard reads, this fails loudly
 * instead of the dashboard silently showing zeros.
 *
 * Skips when no live cast.db is present (e.g. clean CI) so the suite stays
 * portable; runs and gates wherever a real cast.db exists.
 */
describe('cast.db schema contract', () => {
  it('EXPECTED_SCHEMA is well-formed (every table lists ≥1 column)', () => {
    const tables = Object.keys(EXPECTED_SCHEMA)
    expect(tables.length).toBeGreaterThan(0)
    for (const [table, cols] of Object.entries(EXPECTED_SCHEMA)) {
      expect(Array.isArray(cols), `${table} columns should be an array`).toBe(true)
      expect(cols.length, `${table} should list at least one column`).toBeGreaterThan(0)
      // no duplicate column names
      expect(new Set(cols).size, `${table} has duplicate columns`).toBe(cols.length)
    }
  })

  const dbExists = fs.existsSync(CAST_DB)

  it.runIf(dbExists)('live cast.db has every column the dashboard routes depend on', () => {
    const db = new Database(CAST_DB, { readonly: true, fileMustExist: true })
    try {
      const drift = verifySchema(db)
      expect(
        drift,
        `cast.db schema drift detected — update routes + EXPECTED_SCHEMA:\n${JSON.stringify(drift, null, 2)}`,
      ).toEqual([])
    } finally {
      db.close()
    }
  })

  it.skipIf(dbExists)('skipped: no live cast.db to verify against', () => {
    expect(true).toBe(true)
  })
})
