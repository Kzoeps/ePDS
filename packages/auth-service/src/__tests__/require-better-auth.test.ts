/**
 * Tests for the requireBetterAuth middleware.
 *
 * Exercises all five branches using minimal mock req/res/next objects and
 * vi.spyOn(globalThis, 'fetch') to control getDidByEmail responses — the
 * same pattern used by csrf.test.ts and get-did-by-email.test.ts.
 *
 * Branches covered:
 * 1. No session (getSession returns null)          → redirect 303 /account/login
 * 2. getSession throws                             → redirect 303 /account/login (catch)
 * 3. PDS unavailable (fetch rejects)               → 503 error page
 * 4. No PDS account (did === null), signOut ok     → 403 no-account page, signOut called
 * 5. No PDS account (did === null), signOut throws → 403 no-account page (signOut failure non-fatal)
 * 6. Happy path (did present)                      → next() called, res.locals populated
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requireBetterAuth } from '../middleware/require-better-auth.js'

const PDS_URL = 'https://core:3000'
const SECRET = 'test-secret'

function makeReq(headers: Record<string, string> = {}) {
  return { headers }
}

function makeRes() {
  const res = {
    _status: 200,
    _body: null as unknown,
    _redirectCode: null as number | null,
    _redirectUrl: null as string | null,
    locals: {} as Record<string, unknown>,
    status(code: number) {
      res._status = code
      return res
    },
    type(_t: string) {
      return res
    },
    send(body: unknown) {
      res._body = body
      return res
    },
    redirect(code: number, url: string) {
      res._redirectCode = code
      res._redirectUrl = url
    },
  }
  return res
}

function makeAuth(overrides?: {
  getSession?: ReturnType<typeof vi.fn>
  signOut?: ReturnType<typeof vi.fn>
}) {
  return {
    api: {
      getSession: overrides?.getSession ?? vi.fn(),
      signOut: overrides?.signOut ?? vi.fn().mockResolvedValue(undefined),
    },
  }
}

const MOCK_SESSION = {
  user: { email: 'alice@example.com' },
  session: { token: 'tok-abc' },
}

async function runMiddleware(
  auth: ReturnType<typeof makeAuth>,
  headers?: Record<string, string>,
) {
  const middleware = requireBetterAuth(auth as never, PDS_URL, SECRET)
  const req = makeReq(headers)
  const res = makeRes()
  let nextCalled = false
  await middleware(req as never, res as never, () => {
    nextCalled = true
  })
  return { nextCalled, res }
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe('requireBetterAuth middleware', () => {
  it('redirects to /account/login when there is no session', async () => {
    const auth = makeAuth({ getSession: vi.fn().mockResolvedValue(null) })
    const { nextCalled, res } = await runMiddleware(auth)

    expect(nextCalled).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(res._redirectCode).toBe(303)
    expect(res._redirectUrl).toBe('/account/login')
  })

  it('redirects to /account/login when getSession throws', async () => {
    const auth = makeAuth({
      getSession: vi.fn().mockRejectedValue(new Error('DB error')),
    })
    const { nextCalled, res } = await runMiddleware(auth)

    expect(nextCalled).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(res._redirectCode).toBe(303)
    expect(res._redirectUrl).toBe('/account/login')
  })

  it('returns 503 when the PDS is unavailable', async () => {
    const auth = makeAuth({
      getSession: vi.fn().mockResolvedValue(MOCK_SESSION),
    })
    fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const { nextCalled, res } = await runMiddleware(auth)

    expect(nextCalled).toBe(false)
    expect(res._status).toBe(503)
    expect(res._body).toContain('Service temporarily unavailable')
    expect(res._redirectUrl).toBeNull()
  })

  it('returns 403 and signs out when no PDS account exists for the email', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined)
    const auth = makeAuth({
      getSession: vi.fn().mockResolvedValue(MOCK_SESSION),
      signOut,
    })
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ did: null }), { status: 200 }),
    )
    const { nextCalled, res } = await runMiddleware(auth)

    expect(nextCalled).toBe(false)
    expect(res._status).toBe(403)
    expect(res._body).toContain('No account found')
    expect(signOut).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect(res._redirectUrl).toBeNull()
  })

  it('still returns 403 when signOut throws during no-account path', async () => {
    const signOut = vi.fn().mockRejectedValue(new Error('sign-out failed'))
    const auth = makeAuth({
      getSession: vi.fn().mockResolvedValue(MOCK_SESSION),
      signOut,
    })
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ did: null }), { status: 200 }),
    )
    const { nextCalled, res } = await runMiddleware(auth)

    expect(nextCalled).toBe(false)
    expect(res._status).toBe(403)
    expect(res._body).toContain('No account found')
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('calls next() and populates res.locals on happy path', async () => {
    const auth = makeAuth({
      getSession: vi.fn().mockResolvedValue(MOCK_SESSION),
    })
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ did: 'did:plc:abc123' }), { status: 200 }),
    )
    const { nextCalled, res } = await runMiddleware(auth)

    expect(nextCalled).toBe(true)
    expect(res.locals.did).toBe('did:plc:abc123')
    expect(res.locals.betterAuthSession).toBe(MOCK_SESSION)
    expect(res._redirectUrl).toBeNull()
    expect(res._status).toBe(200)
  })
})
