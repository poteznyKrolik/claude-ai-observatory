import { Router } from 'express'
import { loadOutputs } from '../parsers/memory.js'

const router = Router()

const VALID_CATEGORIES = ['briefings', 'meetings', 'reports'] as const
type Category = typeof VALID_CATEGORIES[number]

router.get('/:category', (req, res) => {
  const category = req.params.category as string
  if (!VALID_CATEGORIES.includes(category as Category)) {
    res.status(400).json({ error: 'Invalid category. Use: briefings, meetings, reports' })
    return
  }
  const outputs = loadOutputs(category as Category)
  res.json(outputs)
})

export { router as outputsRouter }
