import fs from 'fs'

export function decodeProjectPath(dirName: string): string {
  // The dir name is the full path with / replaced by -
  // e.g. "-Users-edkubiak-Projects-work-ses-wiki"
  // We need to figure out which hyphens are path separators vs part of names
  // Strategy: try from left, greedily match existing directories
  const parts = dirName.split('-').filter(Boolean)
  const segments: string[] = []
  let i = 0
  while (i < parts.length) {
    let matched = false
    for (let len = Math.min(parts.length - i, 4); len >= 1; len--) {
      const candidate = '/' + segments.concat([parts.slice(i, i + len).join('-')]).join('/')
      if (fs.existsSync(candidate) || (len === 1 && i + len === parts.length)) {
        segments.push(parts.slice(i, i + len).join('-'))
        i += len
        matched = true
        break
      }
    }
    if (!matched) {
      segments.push(parts[i])
      i++
    }
  }
  return '/' + segments.join('/')
}
