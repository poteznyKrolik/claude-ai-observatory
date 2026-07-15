import { useState } from 'react'
import { ChevronDown, ChevronUp, Wrench, CheckCircle, XCircle, Clock, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from '@/components/sessions/CodeBlock'

interface ToolCallBlockProps {
  toolName: string
  toolInput?: string
  toolOutput?: string
  content?: string
  durationMs?: number
  success?: boolean
  outputSize?: number
  className?: string
}

export function ToolCallBlock({
  toolName,
  toolInput,
  toolOutput,
  content,
  durationMs,
  success,
  outputSize,
  className
}: ToolCallBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatJSON = (jsonString: string | undefined) => {
    if (!jsonString) return null
    try {
      const parsed = JSON.parse(jsonString)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return jsonString
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formattedInput = formatJSON(toolInput)
  // Use toolOutput (from imports) if available, otherwise fall back to content
  const outputContent = toolOutput || content
  const hasDetails = formattedInput || outputContent || outputSize

  return (
    <div className={cn('rounded-lg border bg-muted/30 w-full max-w-full min-w-0 overflow-hidden', className)}>
      <Button
        variant="ghost"
        className="w-full justify-between h-auto py-2 px-3 hover:bg-muted/50"
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        disabled={!hasDetails}
      >
        <div className="flex items-center gap-2 text-sm">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{toolName}</span>
          {success !== undefined && (
            success ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            )
          )}
          {durationMs !== undefined && durationMs > 0 && (
            <Badge variant="secondary" className="text-xs py-0 h-5">
              <Clock className="h-3 w-3 mr-1" />
              {formatDuration(durationMs)}
            </Badge>
          )}
        </div>
        {hasDetails && (
          isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )
        )}
      </Button>

      {isExpanded && hasDetails && (
        <div className="px-3 pb-3 space-y-3 min-w-0 overflow-hidden">
          {formattedInput && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Input</div>
              <CodeBlock
                text={formattedInput}
                maxHeightClassName="max-h-48 overflow-y-auto"
              />
            </div>
          )}
          {outputContent ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
              <CodeBlock
                text={outputContent}
                maxHeightClassName="max-h-96 overflow-y-auto"
              />
            </div>
          ) : outputSize !== undefined && outputSize > 0 ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Output</div>
              <div className="text-xs text-muted-foreground bg-muted rounded p-2 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>Output not captured via OTLP telemetry ({formatBytes(outputSize)})</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
