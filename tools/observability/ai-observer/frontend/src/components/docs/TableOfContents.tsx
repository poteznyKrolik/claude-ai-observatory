import { cn } from '@/lib/utils'
import type { DocSection } from '@/data/documentation'

interface TableOfContentsProps {
  sections: DocSection[]
  activeSection: string
  onSectionClick: (sectionId: string) => void
}

export function TableOfContents({
  sections,
  activeSection,
  onSectionClick,
}: TableOfContentsProps) {
  return (
    <nav className="space-y-1" aria-label="Table of contents">
      <p className="text-sm font-medium mb-3 text-foreground">On this page</p>
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => onSectionClick(section.id)}
          className={cn(
            'block w-full text-left text-sm py-1.5 px-2 rounded-md transition-colors',
            activeSection === section.id
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
          )}
        >
          {section.title}
        </button>
      ))}
    </nav>
  )
}
