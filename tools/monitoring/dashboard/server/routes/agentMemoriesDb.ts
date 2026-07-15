import { Router } from 'express'
import Database from 'better-sqlite3'
import { getCastDb } from './castDb.js'
import { CAST_DB } from '../constants.js'
import fs from 'fs'

export const agentMemoriesDbRouter = Router()

agentMemoriesDbRouter.get('/', (req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ memories: [], total: 0 })
    }

    const agent = req.query.agent as string | undefined
    const type = req.query.type as string | undefined
    const project = req.query.project as string | undefined
    const q = req.query.q as string | undefined

    const conditions: string[] = []
    const params: unknown[] = []

    if (agent) { conditions.push('agent = ?'); params.push(agent) }
    if (type) { conditions.push('type = ?'); params.push(type) }
    if (project) { conditions.push('project = ?'); params.push(project) }
    if (q) {
      conditions.push('(name LIKE ? OR content LIKE ?)')
      params.push(`%${q}%`, `%${q}%`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const memories = db.prepare(`
      SELECT id, agent, type, project, name, content, created_at, updated_at,
             last_validated_at, retrieval_count
      FROM agent_memories
      ${where}
      ORDER BY updated_at DESC
    `).all(params) as Array<{
      id: string; agent: string; type: string; project: string | null;
      name: string; content: string; created_at: string; updated_at: string;
      last_validated_at: string | null; retrieval_count: number
    }>

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS total FROM agent_memories ${where}
    `).get(params) as { total: number }

    res.json({ memories, total: totalRow.total })
  } catch (err) {
    console.error('Agent memories error:', err)
    res.status(500).json({ error: 'Failed to fetch agent memories' })
  }
})

agentMemoriesDbRouter.delete('/:id', (req, res) => {
  const { id } = req.params
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid memory id' })
  }
  if (!fs.existsSync(CAST_DB)) {
    return res.status(404).json({ error: 'cast.db not found' })
  }
  let db: ReturnType<typeof Database> | null = null
  try {
    db = new Database(CAST_DB, { fileMustExist: true })
    const result = db.prepare('DELETE FROM agent_memories WHERE id = ?').run(id)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Memory not found' })
    }
    res.json({ success: true, deleted: id })
  } catch (err) {
    console.error('Delete memory error:', err)
    res.status(500).json({ error: 'Failed to delete memory' })
  } finally {
    if (db) db.close()
  }
})
