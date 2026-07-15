import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ThemeProvider, useTheme } from './themeState'

// ── localStorage stub (jsdom initializes it lazily; stub avoids undefined) ──

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})

// ── matchMedia mock (jsdom doesn't implement it) ─────────────────────────────

function makeMatchMedia(preferLight: boolean) {
  const listeners: ((e: Partial<MediaQueryListEvent>) => void)[] = []
  return {
    _listeners: listeners,
    _fire: (matches: boolean) => {
      listeners.forEach(fn => fn({ matches } as MediaQueryListEvent))
    },
    matches: preferLight,
    addEventListener: (_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
      listeners.push(fn)
    },
    removeEventListener: (_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
      const idx = listeners.indexOf(fn)
      if (idx !== -1) listeners.splice(idx, 1)
    },
  }
}

// ── helper consumer ───────────────────────────────────────────────────────────

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.style.backgroundColor = ''
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ThemeProvider', () => {
  it('defaults to dark when OS prefers dark and no stored preference', () => {
    const mq = makeMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList)

    // Simulate what the inline HTML script would have set
    document.documentElement.classList.add('dark')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme').textContent).toBe('dark')
  })

  it('defaults to light when OS prefers light and no stored preference', () => {
    const mq = makeMatchMedia(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList)

    // Simulate what the inline HTML script would have set
    document.documentElement.classList.remove('dark')
    document.documentElement.classList.add('light')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('reads persisted theme from localStorage over OS preference', () => {
    window.localStorage.setItem('cast-theme', 'light')
    // OS says dark, but localStorage says light — localStorage wins (inline script read it first)
    const mq = makeMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList)

    // Simulate the html class the inline script would have applied
    document.documentElement.classList.add('light')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme').textContent).toBe('light')
  })

  it('toggleTheme flips the html class and persists to localStorage', async () => {
    const mq = makeMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList)
    document.documentElement.classList.add('dark')

    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Toggle' }))

    expect(screen.getByTestId('theme').textContent).toBe('light')
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem('cast-theme')).toBe('light')
  })

  it('does not follow OS changes once a preference is persisted', async () => {
    const mq = makeMatchMedia(false)
    vi.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList)
    window.localStorage.setItem('cast-theme', 'dark')
    document.documentElement.classList.add('dark')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    // Fire OS preference change — should NOT affect theme because localStorage is set
    act(() => {
      mq._fire(true) // OS switches to light
    })

    expect(screen.getByTestId('theme').textContent).toBe('dark')
    expect(window.localStorage.getItem('cast-theme')).toBe('dark')
  })

  it('useTheme throws when used outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ThemeConsumer />)).toThrow('useTheme must be used inside ThemeProvider')
    spy.mockRestore()
  })
})
