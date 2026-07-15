import { cn } from '@/lib/utils'

interface CodeBlockProps {
  text: string
  className?: string
  maxHeightClassName?: string
}

type ParsedLine = {
  lineNumber?: string
  content: string
}

function parseArrowNumberedLines(text: string): { lines: ParsedLine[]; hasLineNumbers: boolean } {
  const rawLines = text.split('\n')
  const parsed: ParsedLine[] = []
  let numberedCount = 0

  // Matches: "   12→foo" or "12 -> foo" (we only strip when a line number is clearly present)
  const re = /^\s*(\d+)\s*(?:→|->)\s?(.*)$/

  for (const line of rawLines) {
    const m = line.match(re)
    if (m) {
      numberedCount++
      parsed.push({ lineNumber: m[1], content: m[2] ?? '' })
    } else {
      parsed.push({ content: line })
    }
  }

  // Only treat as line-numbered output if it’s consistently present (avoid stripping real arrows)
  const hasLineNumbers = parsed.length > 0 && numberedCount >= Math.min(3, parsed.length)

  if (!hasLineNumbers) {
    return { lines: [{ content: text }], hasLineNumbers: false }
  }

  return { lines: parsed.map((l) => ({ lineNumber: l.lineNumber, content: l.content })), hasLineNumbers: true }
}

export function CodeBlock({ text, className, maxHeightClassName }: CodeBlockProps) {
  const { lines, hasLineNumbers } = parseArrowNumberedLines(text)

  if (!hasLineNumbers) {
    return (
      <div className={cn('w-full max-w-full min-w-0 overflow-x-hidden', maxHeightClassName, className)}>
        <pre className="text-xs bg-muted rounded p-2 whitespace-pre-wrap break-words min-w-0">
          {text}
        </pre>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-full min-w-0 overflow-x-hidden', maxHeightClassName, className)}>
      <div className="text-xs font-mono bg-muted rounded p-2">
        {lines.map((l, idx) => (
          <div key={idx} className="flex items-start">
            <span className="w-[4ch] pr-3 text-muted-foreground select-none text-right tabular-nums shrink-0">
              {l.lineNumber ?? ''}
            </span>
            <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {l.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

