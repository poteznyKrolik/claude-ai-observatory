import Database from 'better-sqlite3'
import fs from 'fs'
import { CAST_DB } from '../constants.js'

let _db: ReturnType<typeof Database> | null = null

export function getCastDb(): ReturnType<typeof Database> | null {
  if (!fs.existsSync(CAST_DB)) return null
  if (!_db) {
    _db = new Database(CAST_DB, { readonly: true, fileMustExist: true })
  }
  return _db
}

/** Open a fresh read-write connection to cast.db. Caller MUST close it when done. */
export function getCastDbWritable(): ReturnType<typeof Database> | null {
  if (!fs.existsSync(CAST_DB)) return null
  return new Database(CAST_DB, { fileMustExist: true })
}
