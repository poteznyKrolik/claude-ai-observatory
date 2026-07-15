import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SectionHeader from './SectionHeader'

describe('SectionHeader', () => {
  it('renders the title as a level-2 heading by default', () => {
    render(<SectionHeader title="Sessions" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Sessions' })).toBeInTheDocument()
  })

  it('renders as a level-1 heading when as="h1"', () => {
    render(<SectionHeader as="h1" title="Dashboard" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders the kicker and description when provided', () => {
    render(<SectionHeader kicker="cast.db" title="Agent Runs" description="All dispatches" />)
    expect(screen.getByText('cast.db')).toBeInTheDocument()
    expect(screen.getByText('All dispatches')).toBeInTheDocument()
  })

  it('renders action content', () => {
    render(<SectionHeader title="Evals" actions={<button>Refresh</button>} />)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })
})
