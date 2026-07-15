import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { useModalA11y } from './useModalA11y'

function Modal({ onClose }: { onClose: () => void }) {
  const ref = useModalA11y<HTMLDivElement>(true, onClose)
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Test dialog">
      <button type="button">Inside</button>
    </div>
  )
}

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && <Modal onClose={() => setOpen(false)} />}
    </div>
  )
}

describe('useModalA11y', () => {
  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    // Focus lands inside the dialog (jsdom reports no layout, so the hook
    // falls back to focusing the dialog container itself).
    const dialog = screen.getByRole('dialog', { name: 'Test dialog' })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus to the trigger on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })
})
