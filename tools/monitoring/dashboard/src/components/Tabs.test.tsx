import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Tabs, { type TabItem } from './Tabs'

const TABS: TabItem[] = [
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
]

function setup(active = 'one') {
  const onChange = vi.fn()
  render(
    <Tabs tabs={TABS} activeTab={active} onChange={onChange} ariaLabel="Test tabs" idBase="test">
      <p>panel content</p>
    </Tabs>,
  )
  return { onChange }
}

describe('Tabs', () => {
  it('exposes the WAI-ARIA tablist structure', () => {
    setup()
    const tablist = screen.getByRole('tablist', { name: 'Test tabs' })
    expect(tablist).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)

    const selected = screen.getByRole('tab', { name: 'One' })
    expect(selected).toHaveAttribute('aria-selected', 'true')
    expect(selected).toHaveAttribute('tabindex', '0')

    const unselected = screen.getByRole('tab', { name: 'Two' })
    expect(unselected).toHaveAttribute('aria-selected', 'false')
    expect(unselected).toHaveAttribute('tabindex', '-1')
  })

  it('wires the tab panel to the active tab', () => {
    setup('two')
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', 'test-tab-two')
    expect(panel).toHaveAttribute('id', 'test-panel')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-controls', 'test-panel')
  })

  it('moves focus with arrow keys without changing selection (manual activation)', async () => {
    const user = userEvent.setup()
    const { onChange } = setup('one')

    await user.tab() // focus enters the tablist on the selected tab
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled() // focus moved, selection did not

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus()
  })

  it('wraps focus and selects on Enter / click', async () => {
    const user = userEvent.setup()
    const { onChange } = setup('one')

    await user.tab()
    await user.keyboard('{ArrowLeft}') // wraps to last
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('three')

    await user.click(screen.getByRole('tab', { name: 'Two' }))
    expect(onChange).toHaveBeenCalledWith('two')
  })
})
