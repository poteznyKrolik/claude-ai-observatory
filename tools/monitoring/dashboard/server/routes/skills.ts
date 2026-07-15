import { Router } from 'express'
import { loadSkills, readSkill } from '../parsers/skills.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(loadSkills())
})

router.get('/:name', (req, res) => {
  const content = readSkill(req.params.name)
  if (!content) {
    res.status(404).json({ error: 'Skill not found' })
    return
  }
  res.json({ name: req.params.name, body: content })
})

export { router as skillsRouter }
