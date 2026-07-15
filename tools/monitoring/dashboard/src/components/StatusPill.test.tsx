import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusPill from './StatusPill'

describe('StatusPill', () => {
  it('renders the status as the default label', () => {
    render(<StatusPill status="DONE" />)
    expect(screen.getByText('DONE')).toBeInTheDocument()
  })

  it('renders an overriding label when provided', () => {
    render(<StatusPill status="running" label="Live" />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.queryByText('running')).not.toBeInTheDocument()
  })

  it('shows a pulsing dot for live states', () => {
    const { container } = render(<StatusPill status="running" />)
    expect(container.querySelector('.animate-ping')).toBeInTheDocument()
  })

  it('does not pulse for terminal states', () => {
    const { container } = render(<StatusPill status="DONE" />)
    expect(container.querySelector('.animate-ping')).not.toBeInTheDocument()
  })

  it('maps blocked/failed statuses to the danger tone', () => {
    render(<StatusPill status="BLOCKED" />)
    expect(screen.getByText('BLOCKED').className).toContain('text-rose-400')
  })

  it('honors an explicit tone override', () => {
    render(<StatusPill status="anything" tone="success" label="OK" />)
    expect(screen.getByText('OK').className).toContain('text-emerald-400')
  })
})
