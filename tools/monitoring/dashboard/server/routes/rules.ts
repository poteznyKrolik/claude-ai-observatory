import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { RULES_DIR } from '../constants.js'
import { loadRules, readRule } from '../parsers/rules.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(loadRules())
})

router.get('/:filename', (req, res) => {
  const content = readRule(req.params.filename)
  if (!content) {
    res.status(404).json({ error: 'Rule not found' })
    return
  }
  res.json({ filename: req.params.filename, body: content })
})

// PUT /api/rules/:filename — overwrite a rule file
router.put('/:filename', (req, res) => {
  try {
    const { body } = req.body as { body?: string }
    if (typeof body !== 'string') return res.status(400).json({ error: 'body required' })
    const filePath = path.join(RULES_DIR, req.params.filename)
    // Security: prevent path traversal
    if (!filePath.startsWith(RULES_DIR + path.sep) && filePath !== RULES_DIR) {
      return res.status(403).json({ error: 'Invalid path' })
    }
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' })
    fs.writeFileSync(filePath, body, 'utf-8')
    res.json({ ok: true })
  } catch (err) {
    console.error('Rules write error:', err)
    res.status(500).json({ error: 'Failed to write rule file' })
  }
})

export { router as rulesRouter }
