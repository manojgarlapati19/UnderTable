'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  /** Optional callback for reporting the error to an external service. */
  onError?: (error: Error, info: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  info?: React.ErrorInfo
}

/**
 * Top-level error boundary.
 *
 * - `Try again` clears local error state and re-renders the subtree in place
 *   (no full page reload, no lost client state).
 * - `Reload app` is a last-resort escape hatch for cases where the error has
 *   poisoned something at module scope.
 * - If an `onError` callback is provided we forward the error/info to it
 *   (e.g. Sentry, PostHog, a custom `/api/log` endpoint).
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App error:', error, info)
    this.setState({ info })
    this.props.onError?.(error, info)
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: undefined, info: undefined })
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0C0B1C] px-6 text-center text-white"
        style={{ fontFamily: 'sans-serif' }}
      >
        <div className="text-5xl" aria-hidden="true">
          👻
        </div>
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="max-w-md text-sm text-white/50">
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        {process.env.NODE_ENV !== 'production' && this.state.info?.componentStack ? (
          <details className="max-w-2xl overflow-auto rounded-md border border-white/10 bg-black/40 p-3 text-left text-xs text-white/60">
            <summary className="cursor-pointer text-white/80">Stack trace</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {this.state.info.componentStack}
            </pre>
          </details>
        ) : null}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={this.handleTryAgain}
            className="rounded-xl bg-gradient-to-br from-[#A78BFA] to-[#F0ABFC] px-6 py-2.5 text-sm font-semibold text-[#1E1B4B] transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#A78BFA] focus:ring-offset-2 focus:ring-offset-[#0C0B1C]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-xl border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0C0B1C]"
          >
            Reload app
          </button>
        </div>
      </div>
    )
  }
}
