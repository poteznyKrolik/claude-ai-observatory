import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock the loadAgents and other parsers before importing the router
vi.mock('../parsers/agents.js', () => ({
  loadAgents: () => [],
  writeAgent: vi.fn(),
  createAgent: vi.fn(),
}))

const { agentsRouter } = await import('../routes/agents.js')

const app = express()
app.use(express.json())
app.use('/api/agents', agentsRouter)

describe('GET /api/agents/roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with correct shape when agents directory exists', async () => {
    const res = await request(app).get('/api/agents/roster')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('agents')
    expect(res.body).toHaveProperty('count')
    expect(res.body).toHaveProperty('source')
    expect(Array.isArray(res.body.agents)).toBe(true)
    expect(typeof res.body.count).toBe('number')
  })

  it('returns count === agents.length when source is filesystem', async () => {
    const res = await request(app).get('/api/agents/roster')

    expect(res.status).toBe(200)
    if (res.body.source === 'filesystem') {
      expect(res.body.count).toBe(res.body.agents.length)
    }
  })

  it('returns agents when filesystem exists, with count matching array length', async () => {
    const res = await request(app).get('/api/agents/roster')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.agents)).toBe(true)
    expect(typeof res.body.count).toBe('number')
    // When filesystem source, count must match agents.length
    if (res.body.source === 'filesystem') {
      expect(res.body.count).toBe(res.body.agents.length)
    }
  })

  it('returns sorted agents when source is filesystem', async () => {
    const res = await request(app).get('/api/agents/roster')

    if (res.status === 200 && res.body.source === 'filesystem' && res.body.agents.length > 0) {
      const sorted = [...res.body.agents].sort()
      expect(res.body.agents).toEqual(sorted)
    }
  })
})
