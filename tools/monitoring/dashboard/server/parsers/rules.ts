import fs from 'fs'
import path from 'path'
import { RULES_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'

export interface RuleFile {
  filename: string
  path: string
  preview: string
  modifiedAt: string
}

export function loadRules(): RuleFile[] {
  if (!fs.existsSync(RULES_DIR)) return []

  const files = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.md'))
  return files.map(filename => {
    const filePath = path.join(RULES_DIR, filename)
    const content = fs.readFileSync(filePath, 'utf-8')
    const stat = fs.statSync(filePath)
    return {
      filename,
      path: filePath,
      preview: content.slice(0, 200).replace(/\n/g, ' ').trim(),
      modifiedAt: stat.mtime.toISOString(),
    }
  })
}

export function readRule(filename: string): string | null {
  const filePath = safeResolve(RULES_DIR, filename)
  if (!filePath || !fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf-8')
}
