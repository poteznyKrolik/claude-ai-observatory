import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from '../select'

describe('Select', () => {
  const renderSelect = (props = {}) =>
    render(
      <Select data-testid="select" {...props}>
        <option value="">Select an option</option>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      </Select>
    )

  it('renders with base styles', () => {
    renderSelect()
    const select = screen.getByTestId('select')
    expect(select).toHaveClass('flex')
    expect(select).toHaveClass('h-10')
    expect(select).toHaveClass('w-full')
    expect(select).toHaveClass('rounded-md')
    expect(select).toHaveClass('border')
  })

  it('applies custom className', () => {
    renderSelect({ className: 'custom-class' })
    expect(screen.getByTestId('select')).toHaveClass('custom-class')
  })

  it('forwards ref', () => {
    const ref = { current: null }
    render(
      <Select ref={ref}>
        <option>Option</option>
      </Select>
    )
    expect(ref.current).toBeInstanceOf(HTMLSelectElement)
  })

  it('renders children options', () => {
    renderSelect()
    expect(screen.getByRole('option', { name: 'Option 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 2' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Option 3' })).toBeInTheDocument()
  })

  describe('value handling', () => {
    it('handles controlled value', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      renderSelect({ value: '1', onChange: handleChange })

      await user.selectOptions(screen.getByTestId('select'), '2')

      expect(handleChange).toHaveBeenCalled()
    })

    it('handles uncontrolled select', async () => {
      const user = userEvent.setup()

      renderSelect({ defaultValue: '' })
      const select = screen.getByTestId('select')

      await user.selectOptions(select, '2')

      expect(select).toHaveValue('2')
    })
  })

  describe('disabled state', () => {
    it('applies disabled styles', () => {
      renderSelect({ disabled: true })
      const select = screen.getByTestId('select')
      expect(select).toBeDisabled()
      expect(select).toHaveClass('disabled:opacity-50')
      expect(select).toHaveClass('disabled:cursor-not-allowed')
    })

    it('cannot change value when disabled', async () => {
      const handleChange = vi.fn()
      const user = userEvent.setup()

      renderSelect({ disabled: true, onChange: handleChange })

      await user.selectOptions(screen.getByTestId('select'), '2')

      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('can be associated with a label', () => {
      render(
        <>
          <label htmlFor="test-select">Test Label</label>
          <Select id="test-select">
            <option>Option</option>
          </Select>
        </>
      )

      expect(screen.getByLabelText('Test Label')).toBeInTheDocument()
    })

    it('supports aria-label', () => {
      render(
        <Select aria-label="Country selector">
          <option>Option</option>
        </Select>
      )
      expect(screen.getByLabelText('Country selector')).toBeInTheDocument()
    })

    it('all options are accessible', () => {
      renderSelect()
      const options = screen.getAllByRole('option')
      expect(options).toHaveLength(4)
    })
  })

  describe('multiple selection', () => {
    it('supports multiple attribute', () => {
      render(
        <Select multiple data-testid="select">
          <option value="1">Option 1</option>
          <option value="2">Option 2</option>
        </Select>
      )

      expect(screen.getByTestId('select')).toHaveAttribute('multiple')
    })
  })
})
