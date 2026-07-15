import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  className?: string
  size?: number
}

export default function CopyButton({ text, className = '', size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center p-1 min-w-6 min-h-6 rounded hover:bg-[var(--bg-tertiary)] transition-colors ${className}`}
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
    >
      {copied
        ? <Check aria-hidden="true" className="text-[var(--accent)]" style={{ width: size, height: size }} />
        : <Copy aria-hidden="true" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]" style={{ width: size, height: size }} />
      }
    </button>
  )
}
