import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

// C2: the /exec endpoint spawns a detached `cast exec` process. Auto-mock
// child_process so NO real process is ever launched; fs is spied per-test so NO
// real filesystem is touched. `spawn` here is the same mocked binding the route uses.
vi.mock('child_process')

import { castExecRouter } from '../routes/castExec.js'

const PLANS_DIR = path.join(os.homedir(), '.claude', 'plans')

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/cast', castExecRouter)
  return app
}

describe('POST /api/cast/exec', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockReturnValue({ unref: () => {} } as unknown as ReturnType<typeof spawn>)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 400 when planFile is missing and does not spawn', async () => {
    const res = await request(makeApp()).post('/api/cast/exec').send({})
    expect(res.status).toBe(400)
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()
  })

  it('returns 404 when the plan file does not exist and does not spawn', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false)
    const res = await request(makeApp()).post('/api/cast/exec').send({ planFile: 'real-plan.md' })
    expect(res.status).toBe(404)
    expect(vi.mocked(spawn)).not.toHaveBeenCalled()
  })

  it('confines the spawned path to PLANS_DIR for a traversal planFile', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true)
    const res = await request(makeApp())
      .post('/api/cast/exec')
      .send({ planFile: '../../etc/passwd' })
    expect(res.status).toBe(200)
    expect(vi.mocked(spawn)).toHaveBeenCalledTimes(1)
    const args = vi.mocked(spawn).mock.calls[0][1]
    // basename('../../etc/passwd') === 'passwd' → confined under PLANS_DIR, never /etc/passwd
    expect(args).toEqual(['exec', path.join(PLANS_DIR, 'passwd')])
  })
})

describe('GET /api/cast/exec/:plan_id/status', () => {
  it('returns 400 for an invalid plan_id', async () => {
    // 'bad$id' contains '$', which fails /^[\w.\-]+$/
    const res = await request(makeApp()).get('/api/cast/exec/bad%24id/status')
    expect(res.status).toBe(400)
  })
})
