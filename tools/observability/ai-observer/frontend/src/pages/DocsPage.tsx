import { useState, useEffect, useRef, useCallback } from 'react'
import { DOCUMENTATION_SECTIONS } from '@/data/documentation'
import { TableOfContents } from '@/components/docs/TableOfContents'
import { DocSection } from '@/components/docs/DocSection'

export function DocsPage() {
  const [activeSection, setActiveSection] = useState<string>(
    DOCUMENTATION_SECTIONS[0]?.id || ''
  )
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Setup Intersection Observer for scrollspy
  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const visibleSections = new Set<string>()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const sectionId = entry.target.id
          if (entry.isIntersecting) {
            visibleSections.add(sectionId)
          } else {
            visibleSections.delete(sectionId)
          }
        })

        // Find the topmost visible section based on document order
        const orderedIds = DOCUMENTATION_SECTIONS.map((s) => s.id)
        for (const id of orderedIds) {
          if (visibleSections.has(id)) {
            setActiveSection(id)
            break
          }
        }
      },
      {
        rootMargin: '-80px 0px -50% 0px', // Account for header
        threshold: 0.1,
      }
    )

    // Observe all sections
    sectionRefs.current.forEach((element) => {
      observerRef.current?.observe(element)
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  const handleSectionClick = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const setSectionRef = useCallback(
    (sectionId: string) => (el: HTMLElement | null) => {
      if (el) {
        sectionRefs.current.set(sectionId, el)
      } else {
        sectionRefs.current.delete(sectionId)
      }
    },
    []
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to use AI Observer to monitor your AI coding tools
        </p>
      </div>

      {/* Content with TOC */}
      <div className="flex gap-8">
        {/* Main content */}
        <div className="flex-1 max-w-3xl">
          {DOCUMENTATION_SECTIONS.map((section) => (
            <DocSection
              key={section.id}
              section={section}
              ref={setSectionRef(section.id)}
            />
          ))}
        </div>

        {/* Table of Contents sidebar */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-20">
            <TableOfContents
              sections={DOCUMENTATION_SECTIONS}
              activeSection={activeSection}
              onSectionClick={handleSectionClick}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
