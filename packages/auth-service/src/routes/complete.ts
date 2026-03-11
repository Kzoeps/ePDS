/**
 * GET /auth/complete
 *
 * Bridge route: called by better-auth after successful authentication
 * (this is the `callbackURL` passed to better-auth sign-in methods).
 *
 * Translates a better-auth session into an HMAC-signed redirect to
 * pds-core's /oauth/epds-setup, threading the AT Protocol request_uri
 * through the flow via the auth_flow table.
 *
 * Flow:
 *   1. Read epds_auth_flow cookie → get flow_id
 *   2. Look up auth_flow row → get request_uri, client_id
 *   3. Get better-auth session → extract verified email
 *   4. Delete auth_flow row + clear cookie
 *   5. Build HMAC-signed redirect to pds-core /oauth/epds-setup
 */
import { Router, type Request, type Response } from 'express'
import type { AuthServiceContext } from '../context.js'
import { createLogger, signCallback } from '@certified-app/shared'
import { fromNodeHeaders } from 'better-auth/node'

const logger = createLogger('auth:complete')

const AUTH_FLOW_COOKIE = 'epds_auth_flow'

export function createCompleteRouter(
  ctx: AuthServiceContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- better-auth instance has no exported type
  auth: any,
): Router {
  const router = Router()

  router.get('/auth/complete', async (req: Request, res: Response) => {
    // Step 1: Get flow_id from cookie
    const flowId = req.cookies[AUTH_FLOW_COOKIE] as string | undefined
    if (!flowId) {
      logger.warn('No epds_auth_flow cookie found on /auth/complete')
      res
        .status(400)
        .send('<p>Authentication session expired. Please try again.</p>')
      return
    }

    // Step 2: Look up auth_flow row
    const flow = ctx.db.getAuthFlow(flowId)
    if (!flow) {
      logger.warn({ flowId }, 'auth_flow not found or expired')
      res.clearCookie(AUTH_FLOW_COOKIE)
      res
        .status(400)
        .send('<p>Authentication session expired. Please try again.</p>')
      return
    }

    // Step 3: Get better-auth session to extract verified email
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- better-auth session type not exported
    let session: any
    try {
      session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      })
    } catch (err) {
      logger.error({ err }, 'Failed to get better-auth session')
      res.status(500).send('<p>Authentication failed. Please try again.</p>')
      return
    }

    if (!session?.user?.email) {
      logger.warn(
        { flowId },
        'No authenticated session found on /auth/complete',
      )
      // Redirect back to auth flow with error — user needs to authenticate
      const authUrl =
        `/oauth/authorize?request_uri=${encodeURIComponent(flow.requestUri)}` +
        (flow.clientId ? `&client_id=${encodeURIComponent(flow.clientId)}` : '')
      res.redirect(303, authUrl)
      return
    }

    const email = session.user.email.toLowerCase()

    // Step 4: Cleanup auth_flow row and cookie
    ctx.db.deleteAuthFlow(flowId)
    res.clearCookie(AUTH_FLOW_COOKIE)

    // Step 5: Build HMAC-signed redirect to pds-core /oauth/epds-setup
    const callbackParams = {
      request_uri: flow.requestUri,
      email,
      approved: '1',
      new_account: '0',
    }
    const { sig, ts } = signCallback(
      callbackParams,
      ctx.config.epdsCallbackSecret,
    )
    const params = new URLSearchParams({ ...callbackParams, ts, sig })
    const redirectUrl = `${ctx.config.pdsPublicUrl}/oauth/epds-setup?${params.toString()}`

    logger.info({ email, flowId }, 'Bridge: redirecting to epds-setup')
    res.redirect(303, redirectUrl)
  })

  return router
}
