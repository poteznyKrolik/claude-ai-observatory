import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../input'

describe('Input', () => {
  it('renders with base styles', () => {
    render(<Input data-testid="input" />)
    const input = screen.getByTestId('input')
    expect(input).toHaveClass('flex')
    expect(input).toHaveClass('h-10')
    expect(input).toHaveClass('w-full')
    expect(input).toHaveClass('rounded-md')
    expect(input).toHaveClass('border')
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" data-testid="input" />)
    expect(screen.getByTestId('input')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(<Input ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })

  describe('input types', () => {
    it('renders text input by default', () => {
      render(<Input data-testid="input" />)
      expect(screen.getByTestId('input')).not.toHaveAttribute('type')
    })

    it('renders email input', () => {
      render(<Input type="email" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'email')
    })

    it('renders password input', () => {
      render(<Input type="password" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'password')
    })

    it('renders number input', () => {
      render(<Input type="number" data-testid="input" />)
      expect(screen.getByTestId('input')).toHaveAttribute('type', 'number')
    })
  })

  describe('placeholder', () => {
    it('renders with placeholder', () => {
      render(<Input placeholder="Enter text" />)
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
    })
  })

  describe('value handling', () => {
    it('handles controlled value', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      render(<Input value="initial" onChange={handleChange} data-testid="input" />)

      await user.type(screen.getByTestId('input'), 'a')

      expect(handleChange).toHaveBeenCalled()
    })

    it('handles uncontrolled input', async () => {
      const user = userEvent.setup()

      render(<Input defaultValue="" data-testid="input" />)
      const input = screen.getByTestId('input')

      await user.type(input, 'hello')

      expect(input).toHaveValue('hello')
    })
  })

  describe('disabled state', () => {
    it('applies disabled styles', () => {
      render(<Input disabled data-testid="input" />)
      const input = screen.getByTestId('input')
      expect(input).toBeDisabled()
      expect(input).toHaveClass('disabled:opacity-50')
      expect(input).toHaveClass('disabled:cursor-not-allowed')
    })

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup()

      render(<Input disabled defaultValue="" data-testid="input" />)
      const input = screen.getByTestId('input')

      await user.type(input, 'hello')

      expect(input).toHaveValue('')
    })
  })

  describe('accessibility', () => {
    it('can be associated with a label', () => {
      render(
        <>
          <label htmlFor="test-input">Test Label</label>
          <Input id="test-input" />
        </>
      )

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(<Input aria-label="Search input" />)
      expect(screen.getByLabelText('Search input')).toBeInTheDocument()
    })
  })
})
