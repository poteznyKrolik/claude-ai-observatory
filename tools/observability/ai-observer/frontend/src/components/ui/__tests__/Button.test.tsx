import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button', () => {
  describe('variants', () => {
    it('renders with default variant', () => {
      render(<Button>Default</Button>)
      const button = screen.getByRole('button', { name: 'Default' })
      expect(button).toHaveClass('bg-primary')
    })

    it('renders with destructive variant', () => {
      render(<Button variant="destructive">Destructive</Button>)
      const button = screen.getByRole('button', { name: 'Destructive' })
      expect(button).toHaveClass('bg-destructive')
    })

    it('renders with outline variant', () => {
      render(<Button variant="outline">Outline</Button>)
      const button = screen.getByRole('button', { name: 'Outline' })
      expect(button).toHaveClass('border')
      expect(button).toHaveClass('bg-background')
    })

    it('renders with secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button', { name: 'Secondary' })
      expect(button).toHaveClass('bg-secondary')
    })

    it('renders with ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button', { name: 'Ghost' })
      expect(button).toHaveClass('hover:bg-accent')
    })

    it('renders with link variant', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button', { name: 'Link' })
      expect(button).toHaveClass('text-primary')
      expect(button).toHaveClass('underline-offset-4')
    })
  })

  describe('sizes', () => {
    it('renders with default size', () => {
      render(<Button>Default Size</Button>)
      const button = screen.getByRole('button', { name: 'Default Size' })
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('px-4')
    })

    it('renders with sm size', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button', { name: 'Small' })
      expect(button).toHaveClass('h-8')
      expect(button).toHaveClass('px-3')
    })

    it('renders with lg size', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button', { name: 'Large' })
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('px-6')
    })

    it('renders with icon size', () => {
      render(<Button size="icon">Icon</Button>)
      const button = screen.getByRole('button', { name: 'Icon' })
      expect(button).toHaveClass('size-10')
    })
  })

  describe('interactions', () => {
    it('handles click events', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(<Button onClick={handleClick}>Click Me</Button>)
      await user.click(screen.getByRole('button', { name: 'Click Me' }))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not fire click when disabled', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()

      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      )

      await user.click(screen.getByRole('button', { name: 'Disabled' }))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('disabled state', () => {
    it('applies disabled styles', () => {
      render(<Button disabled>Disabled</Button>)
      const button = screen.getByRole('button', { name: 'Disabled' })
      expect(button).toBeDisabled()
      expect(button).toHaveClass('disabled:opacity-50')
      expect(button).toHaveClass('disabled:pointer-events-none')
    })
  })

  describe('ref forwarding', () => {
    it('forwards ref to button element', () => {
      const ref = { current: null }
      render(<Button ref={ref}>Ref Button</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })
  })

  describe('custom className', () => {
    it('merges custom className with base styles', () => {
      render(<Button className="custom-class">Custom</Button>)
      const button = screen.getByRole('button', { name: 'Custom' })
      expect(button).toHaveClass('custom-class')
      expect(button).toHaveClass('inline-flex')
    })
  })

  describe('button type', () => {
    it('renders as button element', () => {
      render(<Button>Button</Button>)
      const button = screen.getByRole('button', { name: 'Button' })
      expect(button.tagName).toBe('BUTTON')
    })

    it('accepts submit type', () => {
      render(<Button type="submit">Submit</Button>)
      const button = screen.getByRole('button', { name: 'Submit' })
      expect(button).toHaveAttribute('type', 'submit')
    })

    it('accepts button type explicitly', () => {
      render(<Button type="button">Click</Button>)
      const button = screen.getByRole('button', { name: 'Click' })
      expect(button).toHaveAttribute('type', 'button')
    })
  })
})
