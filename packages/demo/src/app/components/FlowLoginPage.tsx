'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import { AppLogo } from './AppLogo'

export interface FlowLink {
  href: string
  label: string
}

interface FlowLoginPageProps {
  subtitle: string
  /** Value passed as ?handle_mode=... to /api/oauth/login. Omit for Flow 2
   *  (no handle_mode param — auth server uses its configured default). */
  handleMode?: string
  navLinks: FlowLink[]
}

function FlowLogin({ subtitle, handleMode, navLinks }: FlowLoginPageProps) {
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
          {subtitle}
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
          {handleMode && (
            <input type="hidden" name="handle_mode" value={handleMode} />
          )}
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
                  style={{ height: '20px', marginRight: '12px' }}
                />
                Sign in with Certified
              </>
            )}
          </button>
        </form>

        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              display: 'block',
              marginTop: '8px',
              color: '#6b7280',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

export function FlowLoginPage(props: FlowLoginPageProps) {
  return (
    <Suspense>
      <FlowLogin {...props} />
    </Suspense>
  )
}
