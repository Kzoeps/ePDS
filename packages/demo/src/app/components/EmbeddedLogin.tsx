'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type EmbeddedLoginStatus =
  | 'idle'
  | 'loading'
  | 'authenticating'
  | 'success'
  | 'error'

interface EmbeddedLoginProps {
  pdsOrigin: string
}

export function EmbeddedLogin({ pdsOrigin }: EmbeddedLoginProps) {
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<EmbeddedLoginStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const expectedOrigin = useMemo(() => {
    try {
      return new URL(pdsOrigin).origin
    } catch {
      return pdsOrigin
    }
  }, [pdsOrigin])

  const reset = () => {
    setAuthorizeUrl(null)
    setError(null)
    setStatus('idle')
  }

  const startLogin = async (email?: string) => {
    setStatus('loading')
    setError(null)

    try {
      const params = new URLSearchParams({ delivery: 'iframe' })
      if (email) {
        params.set('email', email)
      }

      const res = await fetch(`/api/oauth/login?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to start login')
      }

      if (!data?.authorizeUrl) {
        throw new Error('Missing authorization URL')
      }

      setAuthorizeUrl(data.authorizeUrl)
      setStatus('authenticating')
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : 'Failed to start login',
      )
      setStatus('error')
    }
  }

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('[embedded-login] message received', {
        eventOrigin: event.origin,
        expectedOrigin,
        pageOrigin: window.location.origin,
        data: event.data,
      })

      if (event.origin !== expectedOrigin) {
        console.warn('[embedded-login] origin mismatch, dropping message', {
          eventOrigin: event.origin,
          expectedOrigin,
        })
        return
      }

      if (event.data?.type === 'epds:auth-complete') {
        const { code, state, iss } = event.data.response ?? {}

        if (!code || !state || !iss) {
          setError('Missing authorization response data')
          setStatus('error')
          return
        }

        console.log(
          '[embedded-login] auth-complete accepted, calling /api/oauth/exchange',
          {
            codePresent: Boolean(code),
            statePresent: Boolean(state),
            iss,
          },
        )

        void fetch('/api/oauth/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state, iss }),
        })
          .then(async (res) => {
            const data = await res.json()

            console.log('[embedded-login] /api/oauth/exchange response', {
              ok: res.ok,
              status: res.status,
              data,
            })

            if (!res.ok || !data?.ok) {
              throw new Error(data?.error ?? 'Token exchange failed')
            }

            setStatus('success')
            setAuthorizeUrl(null)
            window.location.href = '/welcome'
          })
          .catch((exchangeError: unknown) => {
            setError(
              exchangeError instanceof Error
                ? exchangeError.message
                : 'Token exchange failed',
            )
            setStatus('error')
          })
      }

      if (event.data?.type === 'epds:auth-error') {
        const response = event.data.response ?? {}
        setError(response.error_description || response.error || 'Login failed')
        setStatus('error')
        setAuthorizeUrl(null)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [expectedOrigin])

  useEffect(() => {
    if (status !== 'authenticating') {
      return
    }

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    window.history.pushState(null, '', window.location.href)

    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [status])

  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {(status === 'idle' || status === 'error') && (
        <button
          type="button"
          onClick={() => {
            void startLogin()
          }}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign in
        </button>
      )}

      {status === 'loading' && (
        <div style={{ color: '#6b7280', fontSize: '14px' }}>
          Starting embedded login...
        </div>
      )}

      {status === 'authenticating' && authorizeUrl && (
        <div
          style={{
            display: 'grid',
            gap: '12px',
            justifyItems: 'center',
          }}
        >
          <iframe
            ref={iframeRef}
            title="Embedded login"
            src={authorizeUrl}
            style={{
              width: '480px',
              height: '600px',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.15)',
            }}
          />
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#111827',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {status === 'error' && error && (
        <div
          style={{
            background: '#fef2f2',
            color: '#dc2626',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
          }}
        >
          Error: {error}
        </div>
      )}
    </div>
  )
}
