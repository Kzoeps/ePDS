/**
 * OAuth token exchange handler for iframe flow.
 *
 * Flow:
 * 1. Verify state matches signed cookie
 * 2. Exchange code for tokens using DPoP
 * 3. Validate DID from token response
 * 4. Resolve handle from PLC directory
 * 5. Create signed user session cookie
 * 6. Return JSON success
 */

import { NextResponse } from 'next/server'
import {
  getBaseUrl,
  restoreDpopKeyPair,
  createDpopProof,
  resolveDidToPds,
  PDS_URL,
  PLC_DIRECTORY_URL,
} from '@/lib/auth'
import { cookies } from 'next/headers'
import {
  getOAuthSessionFromCookie,
  createUserSessionCookie,
  OAUTH_COOKIE,
} from '@/lib/session'
import { sanitizeForLog } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const baseUrl = getBaseUrl()

  try {
    const body = (await request.json().catch(() => null)) as {
      code?: string
      state?: string
      iss?: string
    } | null

    if (!body?.code || !body.state) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }

    if (body.iss) {
      console.log(`[oauth/exchange] iss=${sanitizeForLog(body.iss)}`)
    }

    // Retrieve OAuth session from signed cookie
    const cookieStore = await cookies()
    const stateData = getOAuthSessionFromCookie(cookieStore)
    if (!stateData) {
      return NextResponse.json({ error: 'session_expired' }, { status: 400 })
    }

    if (stateData.state !== body.state) {
      return NextResponse.json({ error: 'state_mismatch' }, { status: 400 })
    }

    const codeVerifier = stateData.codeVerifier
    const tokenUrl = stateData.tokenEndpoint || `${PDS_URL}/oauth/token`

    const clientId = `${baseUrl}/client-metadata.json`
    const redirectUri = `${baseUrl}/api/oauth/callback`

    // Exchange code for tokens with DPoP
    // TODO: Extract shared token exchange helper with callback handler.
    const { privateKey, publicJwk } = restoreDpopKeyPair(
      stateData.dpopPrivateJwk,
    )

    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: body.code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    })

    // First attempt
    let dpopProof = createDpopProof({
      privateKey,
      jwk: publicJwk,
      method: 'POST',
      url: tokenUrl,
    })

    let tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        DPoP: dpopProof,
      },
      body: tokenBody.toString(),
    })

    // Handle DPoP nonce requirement
    if (!tokenRes.ok) {
      const dpopNonce = tokenRes.headers.get('dpop-nonce')
      if (dpopNonce) {
        dpopProof = createDpopProof({
          privateKey,
          jwk: publicJwk,
          method: 'POST',
          url: tokenUrl,
          nonce: dpopNonce,
        })

        tokenRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            DPoP: dpopProof,
          },
          body: tokenBody.toString(),
        })
      }
    }

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text().catch(() => '')
      console.error(
        `[oauth/exchange] FAILED status=${tokenRes.status} url=${tokenUrl} body=${errBody}`,
      )
      return NextResponse.json({ error: 'auth_failed' }, { status: 400 })
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string
      token_type: string
      sub: string
      scope?: string
    }

    // Validate sub matches expected DID (blocks malicious PDS impersonation)
    if (stateData.expectedDid && tokenData.sub !== stateData.expectedDid) {
      console.error(
        `[oauth/exchange] FAIL=did_mismatch sub=${tokenData.sub} expected=${stateData.expectedDid}`,
      )
      return NextResponse.json({ error: 'auth_failed' }, { status: 400 })
    }

    // For email login: verify the returned DID's PDS matches our token endpoint
    if (!stateData.expectedDid && tokenData.sub) {
      try {
        const didPdsUrl = await resolveDidToPds(tokenData.sub)
        const didPdsOrigin = new URL(didPdsUrl).origin
        const tokenOrigin = new URL(tokenUrl).origin
        if (didPdsOrigin !== tokenOrigin) {
          console.error(
            `[oauth/exchange] FAIL=email_pds_mismatch did_pds=${didPdsOrigin} token=${tokenOrigin}`,
          )
          return NextResponse.json({ error: 'auth_failed' }, { status: 400 })
        }
      } catch (err) {
        console.error(
          `[oauth/exchange] FAIL=email_pds_resolve error=${err instanceof Error ? err.message : err}`,
        )
        return NextResponse.json({ error: 'auth_failed' }, { status: 400 })
      }
    }

    console.log(`[oauth/exchange] OK sub=${sanitizeForLog(tokenData.sub)}`)

    // Resolve handle from DID via PLC directory (no auth needed)
    let handle = tokenData.sub
    try {
      const plcRes = await fetch(`${PLC_DIRECTORY_URL}/${tokenData.sub}`)
      if (plcRes.ok) {
        const plcData = (await plcRes.json()) as { alsoKnownAs?: string[] }
        const atUri = plcData.alsoKnownAs?.find((u: string) =>
          u.startsWith('at://'),
        )
        if (atUri) {
          handle = atUri.replace('at://', '')
        }
      }
    } catch {
      console.warn('[oauth/exchange] Could not resolve handle from PLC')
    }

    // Create signed user session cookie
    const userCookie = createUserSessionCookie({
      userDid: tokenData.sub,
      userHandle: handle,
      createdAt: Date.now(),
    })

    // Delete OAuth cookie, set user session cookie
    cookieStore.delete(OAUTH_COOKIE)
    cookieStore.set(userCookie.name, userCookie.value, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })

    return NextResponse.json({ ok: true, handle, did: tokenData.sub })
  } catch (err) {
    console.error(
      '[oauth/exchange] Error:',
      err instanceof Error ? err.message : 'Unknown error',
    )
    return NextResponse.json({ error: 'auth_failed' }, { status: 500 })
  }
}
