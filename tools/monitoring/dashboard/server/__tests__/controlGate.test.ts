import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { controlGate } from '../middleware/controlGate.js'

// Small app: GET is a read (always allowed), POST is a write (gated).
function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/control', controlGate)
  app.get('/api/control/queue', (_req, res) => res.json({ ok: true }))
  app.post('/api/control/dispatch', (_req, res) => res.status(201).json({ ok: true }))
  return app
}

describe('controlGate', () => {
  const ORIG = { ...process.env }

  beforeEach(() => {
    delete process.env.CAST_DASHBOARD_CONTROL
    delete process.env.DASHBOARD_TOKEN
  })

  afterEach(() => {
    process.env = { ...ORIG }
  })

  it('always allows read (GET) requests, even when control is disabled', async () => {
    const res = await request(makeApp()).get('/api/control/queue')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('404s writes when the control surface is disabled (default)', async () => {
    const res = await request(makeApp()).post('/api/control/dispatch').send({})
    expect(res.status).toBe(404)
  })

  it('503s writes when enabled but no token is configured', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    const res = await request(makeApp()).post('/api/control/dispatch').send({})
    expect(res.status).toBe(503)
    expect(res.body.error).toMatch(/DASHBOARD_TOKEN/)
  })

  it('403s writes when enabled with a token but none/wrong token provided', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = 'secret-token'

    const missing = await request(makeApp()).post('/api/control/dispatch').send({})
    expect(missing.status).toBe(403)

    const wrong = await request(makeApp())
      .post('/api/control/dispatch')
      .set('X-Dashboard-Token', 'wrong')
      .send({})
    expect(wrong.status).toBe(403)
  })

  it('allows writes when enabled with the correct token', async () => {
    process.env.CAST_DASHBOARD_CONTROL = '1'
    process.env.DASHBOARD_TOKEN = 'secret-token'

    const res = await request(makeApp())
      .post('/api/control/dispatch')
      .set('X-Dashboard-Token', 'secret-token')
      .send({})
    expect(res.status).toBe(201)
    expect(res.body.ok).toBe(true)
  })
})
