'use client'

import React from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0C0B1C',
          color: 'white',
          fontFamily: 'sans-serif',
          gap: '16px'
        }}>
          <div style={{ fontSize: '48px' }}>👻</div>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #A78BFA, #F0ABFC)',
              color: '#1E1B4B',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
