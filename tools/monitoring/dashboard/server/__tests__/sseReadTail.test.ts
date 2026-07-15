import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readTail, readLastLine } from '../watchers/sse.js'

// P1: readLastLine reads only the file tail instead of the whole (multi-MB) JSONL.
// These tests validate the tail logic + the full-read fallback. Uses os.tmpdir()
// (system temp), never $HOME.

let tmpDir: string | null = null
function writeTemp(content: string): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sse-tail-'))
  const fp = path.join(tmpDir, 'session.jsonl')
  fs.writeFileSync(fp, content)
  return fp
}
afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

describe('readLastLine / readTail', () => {
  it('returns the last non-empty JSONL entry for a small file', () => {
    const fp = writeTemp('{"a":1}\n{"a":2}\n{"a":3}\n')
    expect(readLastLine(fp)).toEqual({ a: 3 })
  })

  it('ignores trailing blank lines', () => {
    const fp = writeTemp('{"a":1}\n{"a":2}\n\n\n')
    expect(readLastLine(fp)).toEqual({ a: 2 })
  })

  it('returns undefined for an empty / whitespace-only file', () => {
    const fp = writeTemp('\n  \n')
    expect(readLastLine(fp)).toBeUndefined()
  })

  it('reads the last entry from a file far larger than the tail window', () => {
    const filler = Array.from({ length: 40000 }, (_, i) => `{"i":${i}}`).join('\n')
    const fp = writeTemp(filler + '\n{"last":true}\n')
    expect(fs.statSync(fp).size).toBeGreaterThan(256 * 1024)
    expect(readLastLine(fp)).toEqual({ last: true })
  })

  it('falls back to a full read when the last entry exceeds the tail window', () => {
    const huge = 'x'.repeat(300 * 1024)
    const fp = writeTemp('{"a":1}\n' + JSON.stringify({ big: huge }) + '\n')
    const res = readLastLine(fp) as { big: string } | undefined
    expect(res?.big.length).toBe(huge.length)
  })

  it('readTail drops the partial first line but keeps complete trailing lines', () => {
    const filler = Array.from({ length: 40000 }, (_, i) => `{"i":${i}}`).join('\n')
    const fp = writeTemp(filler + '\n')
    const tail = readTail(fp)
    // The first filler line ({"i":0}) is beyond the window and dropped.
    expect(tail.startsWith('{"i":0}')).toBe(false)
    // The tail is a suffix of complete, parseable lines.
    const lines = tail.trimEnd().split('\n')
    expect(() => JSON.parse(lines[lines.length - 1])).not.toThrow()
  })
})
