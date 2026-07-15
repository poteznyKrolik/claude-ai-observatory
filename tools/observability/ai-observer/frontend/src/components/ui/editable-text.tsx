import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface EditableTextProps {
  value: string
  onSave: (value: string) => void
  isEditing: boolean
  placeholder?: string
  className?: string
  inputClassName?: string
}

export function EditableText({
  value,
  onSave,
  isEditing,
  placeholder = '',
  className = '',
  inputClassName = '',
}: EditableTextProps) {
  const [editValue, setEditValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync edit value when external value changes
  useEffect(() => {
    if (!isFocused) {
      setEditValue(value)
    }
  }, [value, isFocused])

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed !== value) {
      onSave(trimmed)
    }
    setIsFocused(false)
  }, [editValue, value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setEditValue(value)
      setIsFocused(false)
      inputRef.current?.blur()
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    handleSave()
  }

  // When in edit mode, show an editable input with subtle styling
  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={cn(
          // Base text styling from className
          className,
          // Input-specific styling
          'bg-transparent border-0 border-b-2 border-transparent rounded-none px-0 py-0.5 w-full',
          'hover:border-muted-foreground/30',
          'focus:border-primary focus:outline-none focus:ring-0',
          'placeholder:text-muted-foreground/50',
          'transition-colors',
          inputClassName
        )}
      />
    )
  }

  // When not in edit mode, show static text
  return (
    <span className={cn(className, !value && 'text-muted-foreground/50')}>
      {value || placeholder}
    </span>
  )
}
