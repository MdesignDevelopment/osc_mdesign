'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          backgroundColor: '#0a0a0a',
          color: '#ededed',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <AlertTriangle style={{ width: 24, height: 24, color: '#f87171' }} />
        </div>

        <span
          style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: 9999,
            background: 'rgba(255,255,255,0.06)',
            color: '#737373',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Critical Error
        </span>

        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: '0.875rem',
            color: '#737373',
            maxWidth: 280,
            lineHeight: 1.6,
            margin: '0 0 32px',
          }}
        >
          A critical error occurred. Refresh the page or try again.
        </p>

        <button
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: 6,
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <RotateCcw style={{ width: 14, height: 14 }} />
          Try Again
        </button>

        {error.digest && (
          <p
            style={{
              marginTop: 32,
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#404040',
            }}
          >
            Ref: {error.digest}
          </p>
        )}
      </body>
    </html>
  )
}
