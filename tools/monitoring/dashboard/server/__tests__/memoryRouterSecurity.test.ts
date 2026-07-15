import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { memoryRouter } from '../routes/memory.js'

// S1: path-traversal hardening on the memory PUT/DELETE handlers.
// Every assertion below is rejected at the agentName regex or by safeResolve
// (pure path math) BEFORE any fs call, so this test performs ZERO real
// $HOME / agent-memory-local access — no temp-HOME isolation required.
//
// Note: a *literal* ".." agentName segment (e.g. %2e%2e) is normalized away by
// Express before routing (yields a 404, never reaching the handler), so the
// regex is defense-in-depth for that vector. The reachable invalid inputs we
// assert here are: (a) a non-[A-Za-z0-9_-] agentName -> 400, and (b) a
// %2f-encoded filename traversal under a valid agentName -> 403 (safeResolve).

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/memory', memoryRouter)
  return app
}

describe('memory router path-traversal hardening (S1)', () => {
  it('PUT rejects an agentName containing a disallowed char (dot) with 400', async () => {
    const res = await request(makeApp())
      .put('/api/memory/agent/has.dot/file.md')
      .send({ body: 'x' })
    expect(res.status).toBe(400)
  })

  it('PUT rejects an agentName containing a disallowed char (space) with 400', async () => {
    const res = await request(makeApp())
      .put('/api/memory/agent/bad%20name/file.md')
      .send({ body: 'x' })
    expect(res.status).toBe(400)
  })

  it('DELETE rejects an agentName containing a disallowed char (space) with 400', async () => {
    const res = await request(makeApp()).delete('/api/memory/agent/bad%20name/file.md')
    expect(res.status).toBe(400)
  })

  it('PUT rejects a filename traversal under a valid agentName with 403 (safeResolve escape)', async () => {
    // agentName passes the regex; the escape is in the filename segment ("../../cast.db").
    // safeResolve resolves outside AGENT_MEMORY_DIR and returns null -> 403, before any fs call.
    const res = await request(makeApp())
      .put('/api/memory/agent/valid-agent/%2e%2e%2f%2e%2e%2fcast.db')
      .send({ body: 'pwned' })
    expect(res.status).toBe(403)
  })

  it('DELETE rejects a filename traversal under a valid agentName with 403', async () => {
    const res = await request(makeApp()).delete(
      '/api/memory/agent/valid-agent/%2e%2e%2f%2e%2e%2fcast.db',
    )
    expect(res.status).toBe(403)
  })
})
