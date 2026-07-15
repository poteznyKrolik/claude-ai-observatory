import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>)
    const badge = screen.getByText('Default')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-primary')
  })

  it('renders with secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    const badge = screen.getByText('Secondary')
    expect(badge).toHaveClass('bg-secondary')
  })

  it('renders with destructive variant', () => {
    render(<Badge variant="destructive">Destructive</Badge>)
    const badge = screen.getByText('Destructive')
    expect(badge).toHaveClass('bg-destructive')
  })

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText('Outline')
    expect(badge).toHaveClass('text-foreground')
  })

  it('renders with success variant', () => {
    render(<Badge variant="success">Success</Badge>)
    const badge = screen.getByText('Success')
    expect(badge).toHaveClass('bg-success')
    expect(badge).toHaveClass('text-white')
  })

  it('renders with warning variant', () => {
    render(<Badge variant="warning">Warning</Badge>)
    const badge = screen.getByText('Warning')
    expect(badge).toHaveClass('bg-warning')
    expect(badge).toHaveClass('text-black')
  })

  it('applies custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-class')
  })

  it('passes through additional props', () => {
    render(<Badge data-testid="test-badge">Test</Badge>)
    expect(screen.getByTestId('test-badge')).toBeInTheDocument()
  })

  it('has correct base classes', () => {
    render(<Badge>Base</Badge>)
    const badge = screen.getByText('Base')
    expect(badge).toHaveClass('inline-flex')
    expect(badge).toHaveClass('items-center')
    expect(badge).toHaveClass('rounded-full')
    expect(badge).toHaveClass('text-xs')
    expect(badge).toHaveClass('font-semibold')
  })
})
