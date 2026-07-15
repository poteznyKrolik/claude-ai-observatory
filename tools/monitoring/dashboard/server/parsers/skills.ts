import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { SKILLS_DIR, COMMANDS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'

export interface SkillFile {
  name: string
  description: string
  /** Whether this skill is user-invocable via a slash command.
   *  Primary source: `user-invocable` frontmatter field in SKILL.md.
   *  Fallback heuristic: if the frontmatter field is absent, a skill is
   *  considered invocable iff a matching .md file exists in COMMANDS_DIR
   *  (i.e. ~/.claude/commands/<name>.md). This covers skills like `ship`
   *  that lack explicit frontmatter but may or may not have a command stub.
   */
  invocable: boolean
  path: string
  modifiedAt: string
}

export function loadSkills(): SkillFile[] {
  if (!fs.existsSync(SKILLS_DIR)) return []

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())

  const skills: SkillFile[] = []

  for (const dir of dirs) {
    const skillMd = path.join(SKILLS_DIR, dir.name, 'SKILL.md')
    if (!fs.existsSync(skillMd)) continue

    const raw = fs.readFileSync(skillMd, 'utf-8')
    let data: Record<string, unknown> = {}
    try {
      data = matter(raw).data
    } catch (err) {
      console.warn('[parser] skipping malformed frontmatter:', skillMd, err)
      continue
    }
    const stat = fs.statSync(skillMd)
    const skillName = (data.name as string) || dir.name

    // Determine invocability: prefer explicit frontmatter, fall back to
    // command-file heuristic (skill is invocable iff ~/.claude/commands/<name>.md exists)
    let invocable: boolean
    if (typeof data['user-invocable'] === 'boolean') {
      invocable = data['user-invocable'] as boolean
    } else {
      // safeResolve guards against path traversal from untrusted frontmatter names
      // (skillName derives from data.name); returns null if the path escapes COMMANDS_DIR.
      const commandFile = safeResolve(COMMANDS_DIR, `${skillName}.md`)
      invocable = commandFile !== null && fs.existsSync(commandFile)
    }

    skills.push({
      name: skillName,
      description: (data.description as string) || '',
      invocable,
      path: skillMd,
      modifiedAt: stat.mtime.toISOString(),
    })
  }

  return skills
}

export function readSkill(name: string): string | null {
  const skillMd = safeResolve(SKILLS_DIR, name, 'SKILL.md')
  if (!skillMd || !fs.existsSync(skillMd)) return null
  return fs.readFileSync(skillMd, 'utf-8')
}
