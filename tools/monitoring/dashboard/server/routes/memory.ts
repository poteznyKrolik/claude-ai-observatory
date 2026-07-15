import { Router } from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execSync } from 'child_process'
import { AGENT_MEMORY_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'
import { loadAgentMemory, loadProjectMemory } from '../parsers/memory.js'
import { getCastDb } from './castDb.js'

const router = Router()

function withLastModified(entries: ReturnType<typeof loadAgentMemory>) {
  return entries.map(({ modifiedAt, ...rest }) => ({
    ...rest,
    lastModified: modifiedAt,
  }))
}

router.get('/agent', (_req, res) => {
  const memory = loadAgentMemory()
  res.json(withLastModified(memory))
})

router.get('/agent/:agentName', (req, res) => {
  const memory = loadAgentMemory().filter(m => m.agent === req.params.agentName)
  res.json(withLastModified(memory))
})

router.get('/project', (_req, res) => {
  const memory = loadProjectMemory()
  res.json(withLastModified(memory))
})

// PUT /api/memory/agent/:agentName/:filename — overwrite a memory file body
router.put('/agent/:agentName/:filename', (req, res) => {
  try {
    const { agentName, filename } = req.params
    const { body } = req.body as { body?: string }
    if (typeof body !== 'string') return res.status(400).json({ error: 'body required' })
    // Security: validate agentName and confine the target under AGENT_MEMORY_DIR.
    // agentName/filename are untrusted path segments. The previous path.join + startsWith
    // guard was defeated by agentName='..', which moved memDir itself out of AGENT_MEMORY_DIR
    // so the containment check compared against the attacker-moved base. safeResolve resolves
    // the full path and returns null on any escape.
    if (!/^[a-zA-Z0-9_-]+$/.test(agentName)) {
      return res.status(400).json({ error: 'Invalid agent name' })
    }
    const filePath = safeResolve(AGENT_MEMORY_DIR, agentName, filename)
    if (!filePath) return res.status(403).json({ error: 'Invalid path' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
    fs.writeFileSync(filePath, body, 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    console.error('Memory write error:', err)
    res.status(500).json({ error: 'Failed to write memory file' })
  }
})

// DELETE /api/memory/agent/:agentName/:filename — delete a memory file
router.delete('/agent/:agentName/:filename', (req, res) => {
  try {
    const { agentName, filename } = req.params
    // Security: same confinement as PUT (see note above).
    if (!/^[a-zA-Z0-9_-]+$/.test(agentName)) {
      return res.status(400).json({ error: 'Invalid agent name' })
    }
    const filePath = safeResolve(AGENT_MEMORY_DIR, agentName, filename)
    if (!filePath) return res.status(403).json({ error: 'Invalid path' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' })
    fs.unlinkSync(filePath)
    res.json({ ok: true })
  } catch (err) {
    console.error('Memory delete error:', err)
    res.status(500).json({ error: 'Failed to delete memory file' })
  }
})

// GET /api/memory/backup-status — reads ~/.claude/logs/memory-backup.log
router.get('/backup-status', (_req, res) => {
  try {
    const logPath = path.join(os.homedir(), '.claude/logs/memory-backup.log')
    if (!fs.existsSync(logPath)) {
      return res.json({ lastBackup: null, logSizeBytes: null })
    }
    const content = fs.readFileSync(logPath, 'utf-8').trim()
    const lines = content ? content.split('\n') : []
    const lastLine = lines.slice().reverse().find(l => l.includes('Backup complete'))
    const timestamp = lastLine?.match(/\[(.+?)\]/)?.[1] ?? null
    const stat = fs.statSync(logPath)
    res.json({ lastBackup: timestamp, logSizeBytes: stat.size })
  } catch (err) {
    console.error('Memory backup-status error:', err)
    res.status(500).json({ lastBackup: null, logSizeBytes: null })
  }
})

// POST /api/memory/backup-trigger — runs cast-memory-backup.sh --dry-run
router.post('/backup-trigger', (_req, res) => {
  try {
    const scriptPath = path.join(os.homedir(), 'Projects/personal/claude-agent-team/scripts/cast-memory-backup.sh')
    const out = execSync(`bash "${scriptPath}" --dry-run`, { timeout: 15000 }).toString()
    res.json({ ok: true, output: out })
  } catch (err) {
    console.error('Memory backup-trigger error:', err)
    res.status(500).json({ ok: false, error: 'Backup failed' })
  }
})

// GET /api/memory/db-memories — agent_memories from cast.db with importance/decay/retrieval fields
router.get('/db-memories', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) {
      return res.json({ memories: [] })
    }

    // Check table exists
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_memories'"
    ).get()
    if (!tableCheck) {
      return res.json({ memories: [] })
    }

    const memories = db.prepare(`
      SELECT
        id,
        agent,
        project,
        type,
        name,
        description,
        content,
        importance,
        decay_rate,
        created_at,
        updated_at
      FROM agent_memories
      ORDER BY updated_at DESC
      LIMIT 500
    `).all() as Array<{
      id: string; agent: string; project: string | null; type: string | null;
      name: string; description: string | null; content: string;
      importance: number | null; decay_rate: number | null;
      created_at: string; updated_at: string
    }>

    res.json({ memories })
  } catch (err) {
    console.error('DB memories error:', err)
    res.json({ memories: [] })
  }
})

export { router as memoryRouter }
