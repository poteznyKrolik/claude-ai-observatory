import fs from 'fs'
import path from 'path'
import { COMMANDS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'

export interface CommandFile {
  name: string
  preview: string
  path: string
  modifiedAt: string
}

export function loadCommands(): CommandFile[] {
  if (!fs.existsSync(COMMANDS_DIR)) return []

  const files = fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.md'))
  return files.map(filename => {
    const filePath = path.join(COMMANDS_DIR, filename)
    const content = fs.readFileSync(filePath, 'utf-8')
    const stat = fs.statSync(filePath)

    // Extract agent name from the command content (pattern: "Use the `agentname` agent")
    const agentMatch = content.match(/Use the `([^`]+)` agent/)

    return {
      name: path.basename(filename, '.md'),
      preview: agentMatch ? `Routes to: ${agentMatch[1]}` : content.slice(0, 100).replace(/\n/g, ' ').trim(),
      path: filePath,
      modifiedAt: stat.mtime.toISOString(),
    }
  })
}

export function readCommand(name: string): string | null {
  const filePath = safeResolve(COMMANDS_DIR, `${name}.md`)
  if (!filePath || !fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf-8')
}
