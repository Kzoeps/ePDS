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
  const [showModal, setShowModal] = useState(false)
  const [iframeLoaded, setIframeLoaded] = useState(false)
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
    setShowModal(false)
    setIframeLoaded(false)
    setStatus('idle')
  }

  const startLogin = async (email?: string) => {
    setShowModal(true)
    setIframeLoaded(false)
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
      setShowModal(false)
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
          setShowModal(false)
          setAuthorizeUrl(null)
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
            setShowModal(false)
            setAuthorizeUrl(null)
            window.location.href = '/welcome'
          })
          .catch((exchangeError: unknown) => {
            setError(
              exchangeError instanceof Error
                ? exchangeError.message
                : 'Token exchange failed',
            )
            setShowModal(false)
            setAuthorizeUrl(null)
            setStatus('error')
          })
      }

      if (event.data?.type === 'epds:auth-error') {
        const response = event.data.response ?? {}
        setError(response.error_description || response.error || 'Login failed')
        setShowModal(false)
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

      {showModal && (status === 'loading' || status === 'authenticating') && (
        <div
          style={{
            display: 'grid',
            gap: '12px',
            justifyItems: 'center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '480px',
              height: '600px',
              borderRadius: '12px',
              boxShadow: '0 16px 32px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            {authorizeUrl ? (
              <iframe
                ref={iframeRef}
                title="Embedded login"
                src={authorizeUrl}
                onLoad={() => {
                  setIframeLoaded(true)
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            ) : null}

            {!iframeLoaded && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.92)',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '9999px',
                    border: '2px solid #d1d5db',
                    borderTopColor: '#2563eb',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <div>Loading secure sign-in...</div>
              </div>
            )}
          </div>
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

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
