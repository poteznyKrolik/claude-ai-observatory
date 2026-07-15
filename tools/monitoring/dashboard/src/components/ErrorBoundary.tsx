import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * ErrorBoundary wraps lazy-loaded views so a runtime render error produces a
 * visible message instead of leaving the Suspense fallback ("Loading...") on
 * screen indefinitely or unmounting the entire React tree silently.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset)
      }
      return (
        <div role="alert" className="p-8 flex flex-col gap-3">
          <p className="text-sm font-semibold text-[var(--error)]">Something went wrong</p>
          <p className="text-xs text-[var(--text-muted)]">Something went wrong. Try refreshing the page.</p>
          <button
            onClick={this.reset}
            className="self-start text-xs px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
