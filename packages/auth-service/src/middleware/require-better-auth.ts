/**
 * Middleware that validates a better-auth session and injects it into res.locals.
 *
 * Checks that:
 * 1. A valid better-auth session exists for the request (cookie-based).
 * 2. The PDS still recognises the session email — detects email drift caused
 *    by email changes via XRPC outside of /account.
 *
 * Outcomes:
 * - No session or unexpected error → redirect 303 /account/login
 * - PDS unavailable (getDidByEmail returns null) → 503 error page
 * - PDS has no account for this email → sign out session + 403 error page
 * - Valid session + known PDS account → injects session + DID into res.locals, calls next()
 */
import type { Request, Response, NextFunction } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { createLogger } from '@certified-app/shared'
import type { BetterAuthInstance } from '../better-auth.js'
import { getDidByEmail } from '../lib/get-did-by-email.js'
import { renderError, renderNoAccountPage } from '../lib/render-error.js'

const logger = createLogger('auth:require-better-auth')

export function requireBetterAuth(
  auth: BetterAuthInstance,
  pdsUrl: string,
  internalSecret: string,
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })
      if (!session?.user.email) {
        res.redirect(303, '/account/login')
        return
      }

      // Check whether the PDS still recognises this email.
      // Detects drift caused by email changes via XRPC outside of /account.
      const result = await getDidByEmail(
        session.user.email,
        pdsUrl,
        internalSecret,
      )

      if (result === null) {
        // PDS unavailable — do not touch the session, just show 503
        res
          .status(503)
          .type('html')
          .send(
            renderError('Service temporarily unavailable. Please try again.'),
          )
        return
      }

      if (result.did === null) {
        // No PDS account found for this email — either a genuinely new user who
        // has never registered via an app, or email drift (email changed on the
        // PDS out-of-band). We cannot distinguish the two cases without a local
        // DID mirror, so we treat both the same: sign out the dangling session
        // and show a clear error page rather than silently redirecting to login.
        logger.debug(
          { userId: session.user.id, sessionId: session.session.id },
          'No PDS account found for session',
        )
        try {
          await auth.api.signOut({ headers: fromNodeHeaders(req.headers) })
        } catch (err) {
          logger.error({ err }, 'Failed to sign out on no-account error')
        }
        res.status(403).type('html').send(renderNoAccountPage())
        return
      }

      // Email is valid and PDS recognises it.
      res.locals.betterAuthSession = session
      res.locals.did = result.did
      next()
    } catch (err) {
      logger.error(
        { err },
        'Unexpected error in requireBetterAuth — redirecting to login',
      )
      res.redirect(303, '/account/login')
    }
  }
}
