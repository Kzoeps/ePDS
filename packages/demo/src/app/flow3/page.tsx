'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { AppLogo } from '../components/AppLogo'

/**
 * Flow 3 test page — "App requests picker-with-random handle mode"
 *
 * No email form on the client side. Passes epds_handle_mode=picker-with-random
 * to the auth server, which shows the handle picker with a "Generate random
 * handle" button alongside the free-form input.
 */

function Flow3Login() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const [submitting, setSubmitting] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        overflow: 'hidden',
        background: '#f8f9fa',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <AppLogo size={64} />
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#1a1a2e',
              margin: '12px 0 4px',
            }}
          >
            ePDS Demo
          </h1>
        </div>

        <p
          style={{
            fontSize: '13px',
            color: '#6b7280',
            marginBottom: '24px',
          }}
        >
          Flow 3 — picker-with-random handle mode
        </p>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              marginBottom: '16px',
            }}
          >
            {decodeURIComponent(error)}
          </div>
        )}

        {/* Passes handle_mode=picker-with-random — auth server shows the handle
            picker with a "Generate random handle" button. */}
        <form
          action="/api/oauth/login"
          method="GET"
          style={{ margin: '0 auto', maxWidth: '290px' }}
          onSubmit={() => {
            setTimeout(() => {
              setSubmitting(true)
            }, 0)
          }}
        >
          <input type="hidden" name="handle_mode" value="picker-with-random" />
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: '14px 28px',
              fontSize: '16px',
              fontWeight: 500,
              color: '#ffffff',
              background: submitting ? '#4a4a4a' : '#2563eb',
              border: 'none',
              borderRadius: '8px',
              cursor: submitting ? 'default' : 'pointer',
              letterSpacing: '0.3px',
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? (
              'Redirecting...'
            ) : (
              <>
                <img
                  src="/certified-logo.png"
                  alt=""
                  style={{ height: '20px' }}
                />
                <span style={{ width: '12px', display: 'inline-block' }}></span>
                Sign in with Certified
              </>
            )}
          </button>
        </form>

        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            color: '#6b7280',
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          Switch to Flow 1 (email form)
        </a>
      </div>
    </div>
  )
}

export default function Flow3Page() {
  return (
    <Suspense>
      <Flow3Login />
    </Suspense>
  )
}
