import { Router } from 'express'
import fs from 'fs'
import { loadPlans } from '../parsers/memory.js'
import { PLANS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'
import { getCastDb } from './castDb.js'

const router = Router()

router.get('/', (_req, res) => {
  const plans = loadPlans()
  res.json(plans)
})

// GET /api/plans/sessions — plan_sessions table (which session ran each plan file).
// Declared before '/:filename' so it isn't captured as a filename param.
router.get('/sessions', (_req, res) => {
  try {
    const db = getCastDb()
    if (!db) return res.json({ sessions: [] })
    const tableCheck = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='plan_sessions'"
    ).get()
    if (!tableCheck) return res.json({ sessions: [] })
    const sessions = db.prepare(`
      SELECT id, session_id, plan_file, started_at
      FROM plan_sessions
      ORDER BY started_at DESC
      LIMIT 200
    `).all()
    return res.json({ sessions })
  } catch (err) {
    console.error('[plan-sessions] error:', err)
    return res.json({ sessions: [] })
  }
})

router.get('/:filename', (req, res) => {
  const filePath = safeResolve(PLANS_DIR, req.params.filename)
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' })
    return
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Plan not found' })
    return
  }
  const content = fs.readFileSync(filePath, 'utf-8')
  const stat = fs.statSync(filePath)

  const plans = loadPlans()
  const meta = plans.find(p => p.filename === req.params.filename)

  res.json({
    filename: req.params.filename,
    title: meta?.title || req.params.filename,
    body: content,
    modifiedAt: stat.mtime.toISOString(),
  })
})

export { router as plansRouter }
