/**
 * Look up a DID for an email address via the PDS internal endpoint.
 *
 * Used by multiple routes to determine whether a PDS account already
 * exists for a given email (sign-up vs. login distinction, consent
 * checks, account settings).
 *
 * Return value semantics:
 * - `{ did: string }` — PDS responded 200 and an account exists for this email
 * - `{ did: null }`  — PDS responded 200 but no account exists for this email
 * - `null` (outer)   — PDS error: non-2xx response, timeout, or network failure
 */

import { createLogger } from '@certified-app/shared'

const logger = createLogger('auth:get-did-by-email')

export async function getDidByEmail(
  email: string,
  pdsUrl: string,
  internalSecret: string,
): Promise<{ did: string | null } | null> {
  try {
    const res = await fetch(
      `${pdsUrl}/_internal/account-by-email?email=${encodeURIComponent(email)}`,
      {
        headers: { 'x-internal-secret': internalSecret },
        signal: AbortSignal.timeout(3000),
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { did: string | null }
    return { did: data.did }
  } catch (err) {
    logger.warn({ err, email }, 'Failed to look up DID by email from PDS')
    return null
  }
}
