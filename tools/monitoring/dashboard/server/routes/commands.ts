import { Router } from 'express'
import { loadCommands, readCommand } from '../parsers/commands.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(loadCommands())
})

router.get('/:name', (req, res) => {
  const content = readCommand(req.params.name)
  if (!content) {
    res.status(404).json({ error: 'Command not found' })
    return
  }
  res.json({ name: req.params.name, body: content })
})

export { router as commandsRouter }
