import { Router } from 'express'
import os from 'os'
import { getCachedSessions } from '../parsers/sessions.js'
import { loadAgents } from '../parsers/agents.js'
import { loadPlans, loadAgentMemory, loadProjectMemory } from '../parsers/memory.js'

export const searchRouter = Router()

// Collapse the absolute home path to ~ so search results don't leak the server's
// filesystem layout (username, home structure) to the client.
function relativizeHome(p: string | undefined): string | undefined {
  if (!p) return p
  const home = os.homedir()
  return p.startsWith(home) ? '~' + p.slice(home.length) : p
}

searchRouter.get('/', (req, res) => {
  const q = (req.query.q as string || '').toLowerCase()
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100))

  const empty = { sessions: [], agents: [], plans: [], memories: [] }

  if (!q || q.length < 2) {
    res.json(empty)
    return
  }

  // Sessions: match on slug or project
  const allSessions = getCachedSessions()
  const matchedSessions: Array<{
    id: string
    project: string
    projectEncoded: string
    startedAt: string
    slug?: string
    matchReason: 'slug' | 'project' | 'content'
  }> = []

  for (const s of allSessions) {
    if (matchedSessions.length >= 5) break
    if (s.slug?.toLowerCase().includes(q)) {
      matchedSessions.push({
        id: s.id,
        project: s.project,
        projectEncoded: s.projectEncoded,
        startedAt: s.startedAt,
        slug: s.slug,
        matchReason: 'slug',
      })
    } else if (s.project.toLowerCase().includes(q)) {
      matchedSessions.push({
        id: s.id,
        project: s.project,
        projectEncoded: s.projectEncoded,
        startedAt: s.startedAt,
        slug: s.slug,
        matchReason: 'project',
      })
    }
  }

  // Agents: match on name or description
  const allAgents = loadAgents()
  const matchedAgents = allAgents
    .filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(a => ({
      name: a.name,
      description: a.description,
      model: a.model,
      color: a.color,
    }))

  // Plans: match on title or filename
  const allPlans = loadPlans()
  const matchedPlans = allPlans
    .filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.filename.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(p => ({
      filename: p.filename,
      title: p.title,
      date: p.date,
      preview: p.preview,
    }))

  // Memories: combine agent + project memory
  const allMemories = [...loadAgentMemory(), ...loadProjectMemory()]
  const matchedMemories = allMemories
    .filter(m =>
      m.name?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q)
    )
    .slice(0, 5)
    .map(m => ({
      agent: m.agent,
      name: m.name,
      description: m.description,
      type: m.type,
      path: relativizeHome(m.path),
    }))

  res.json({
    sessions: matchedSessions,
    agents: matchedAgents,
    plans: matchedPlans,
    memories: matchedMemories,
  })
})
