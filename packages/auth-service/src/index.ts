import { createLogger } from '@certified-app/shared'
import express from 'express'
import cookieParser from 'cookie-parser'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { toNodeHandler } from 'better-auth/node'
import { AuthServiceContext, type AuthServiceConfig } from './context.js'
import { createBetterAuth, runBetterAuthMigrations } from './better-auth.js'
import { csrfProtection } from './middleware/csrf.js'
import { requestRateLimit } from './middleware/rate-limit.js'
import { createLoginPageRouter } from './routes/login-page.js'
import { createConsentRouter } from './routes/consent.js'
import { createRecoveryRouter } from './routes/recovery.js'
import { createAccountLoginRouter } from './routes/account-login.js'
import { createAccountSettingsRouter } from './routes/account-settings.js'
import { createCompleteRouter } from './routes/complete.js'
import { createChooseHandleRouter } from './routes/choose-handle.js'
import { AUTH_FLOW_COOKIE } from './constants.js'
import { getCachedClientMetadata } from './lib/client-metadata.js'

const logger = createLogger('auth-service')

export function createAuthService(config: AuthServiceConfig): {
  app: express.Express
  ctx: AuthServiceContext
} {
  const ctx = new AuthServiceContext(config)
  const app = express()

  // Mount better-auth BEFORE express.json() so it can parse its own request bodies.
  // All better-auth endpoints live under /api/auth/*.
  const betterAuthInstance = createBetterAuth(
    ctx.emailSender,
    ctx.db,
    config.otpLength,
    config.otpCharset,
  )
  app.all('/api/auth/*', toNodeHandler(betterAuthInstance))

  // Middleware
  app.set('trust proxy', 1)
  app.use(express.urlencoded({ extended: true }))
  app.use(express.json())
  app.use(cookieParser())
  app.use('/static', express.static(path.resolve(__dirname, '..', 'public')))
  app.use(csrfProtection(config.csrfSecret))
  app.use(requestRateLimit({ windowMs: 60_000, maxRequests: 60 }))

  // Security headers — applied to all routes
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
    next()
  })

  // Dynamic CSP for auth/oauth pages only — builds img-src to allow the OAuth
  // client's logo. Scoped to /oauth/* and /auth/* to avoid a DB lookup on every
  // static asset, metrics, or better-auth API request.
  app.use(['/oauth', '/auth'], (req, res, next) => {
    // Resolve clientId from three sources in priority order:
    //   1. req.query.client_id — present on the initial /oauth/authorize redirect
    //   2. req.body.client_id  — present in legacy POST bodies (transitional)
    //   3. auth_flow DB lookup via cookie — used on recovery routes and any page
    //      that no longer carries client_id in query/body after the refactor.
    //
    // Trust note: clientId stored in auth_flow originates from the OAuth
    // authorization request (set by the OAuth client, not by the user). The
    // cookie is httpOnly so it cannot be forged by page scripts. The worst-case
    // from cookie injection is an attacker adding an arbitrary origin to img-src,
    // which is the same exposure as the existing req.query.client_id path.
    let clientId: string | undefined =
      (req.query.client_id as string | undefined) || req.body?.client_id
    if (!clientId) {
      const flowId = req.cookies?.[AUTH_FLOW_COOKIE] as string | undefined
      if (flowId) {
        clientId = ctx.db.getAuthFlow(flowId)?.clientId ?? undefined
      }
    }

    // Build img-src: allow the client's origin and logo_uri origin (may differ,
    // e.g. when the logo is served from a CDN separate from the client metadata URL).
    let imgSrc = "'self' data:"
    const allowedOrigins = new Set<string>()

    if (clientId && typeof clientId === 'string') {
      try {
        const o = new URL(clientId).origin
        if (o && o !== 'null') allowedOrigins.add(o)
      } catch {
        /* not a valid URL */
      }
    }

    // Also allow the logo_uri origin if it differs from the client_id origin.
    // Uses the synchronous in-memory cache — populated when the login/recovery
    // page resolves branding. If the cache is cold on the very first request,
    // the logo may be blocked until the next page load warms the cache.
    if (clientId && ctx.config.trustedClients.includes(clientId)) {
      const cached = getCachedClientMetadata(clientId)
      if (cached?.logo_uri) {
        try {
          const o = new URL(cached.logo_uri).origin
          if (o && o !== 'null') allowedOrigins.add(o)
        } catch {
          /* not a valid URL */
        }
      }
    }

    if (allowedOrigins.size > 0) {
      imgSrc += ' ' + [...allowedOrigins].join(' ')
    }

    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src ${imgSrc}; connect-src 'self'`,
    )
    next()
  })

  // Routes
  app.use(createLoginPageRouter(ctx))
  app.use(createConsentRouter(ctx))
  app.use(createRecoveryRouter(ctx, betterAuthInstance))
  app.use(createAccountLoginRouter(betterAuthInstance, ctx))
  app.use(createAccountSettingsRouter(ctx, betterAuthInstance))
  app.use(createCompleteRouter(ctx, betterAuthInstance))
  app.use(createChooseHandleRouter(ctx, betterAuthInstance))

  // Metrics endpoint (protect with admin auth in production)
  app.get('/metrics', (req, res) => {
    const adminPassword = process.env.PDS_ADMIN_PASSWORD
    if (adminPassword) {
      const authHeader = req.headers.authorization
      if (
        !authHeader ||
        authHeader !==
          'Basic ' + Buffer.from('admin:' + adminPassword).toString('base64')
      ) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
    }
    const metrics = ctx.db.getMetrics()
    res.json({
      ...metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().rss,
      timestamp: Date.now(),
    })
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth' })
  })

  return { app, ctx }
}

// Entry point when run directly
async function main() {
  const config: AuthServiceConfig = {
    hostname: process.env.AUTH_HOSTNAME || 'auth.localhost',
    port: parseInt(process.env.AUTH_PORT || '3001', 10),
    sessionSecret:
      process.env.AUTH_SESSION_SECRET || 'dev-session-secret-change-me',
    csrfSecret: process.env.AUTH_CSRF_SECRET || 'dev-csrf-secret-change-me',
    epdsCallbackSecret:
      process.env.EPDS_CALLBACK_SECRET || 'dev-callback-secret-change-me',
    pdsHostname: process.env.PDS_HOSTNAME || 'localhost',
    pdsPublicUrl: process.env.PDS_PUBLIC_URL || 'http://localhost:3000',
    email: {
      provider: (process.env.EMAIL_PROVIDER || 'smtp') as 'smtp',
      smtpHost: process.env.SMTP_HOST || 'localhost',
      smtpPort: parseInt(process.env.SMTP_PORT || '1025', 10),
      smtpUser: process.env.SMTP_USER || undefined,
      smtpPass: process.env.SMTP_PASS || undefined,
      from: process.env.SMTP_FROM || 'noreply@localhost',
      fromName: process.env.SMTP_FROM_NAME || 'ePDS',
    },
    dbLocation: process.env.DB_LOCATION || './data/epds.sqlite',
    otpLength: Number(process.env.OTP_LENGTH ?? '8'),
    otpCharset: (process.env.OTP_CHARSET || 'numeric') as
      | 'numeric'
      | 'alphanumeric',
    trustedClients: (process.env.PDS_OAUTH_TRUSTED_CLIENTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  }

  if (
    isNaN(config.otpLength) ||
    config.otpLength < 4 ||
    config.otpLength > 12
  ) {
    throw new Error(
      `Invalid OTP_LENGTH: must be between 4 and 12, got "${process.env.OTP_LENGTH}"`,
    )
  }

  const validCharsets = ['numeric', 'alphanumeric']
  if (!validCharsets.includes(config.otpCharset)) {
    throw new Error(
      `Invalid OTP_CHARSET: must be 'numeric' or 'alphanumeric', got "${process.env.OTP_CHARSET}"`,
    )
  }

  await runBetterAuthMigrations(
    config.dbLocation,
    config.hostname,
    config.otpLength,
    config.otpCharset,
  )

  const { app, ctx } = createAuthService(config)

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, hostname: config.hostname },
      'Auth service running',
    )
  })

  const shutdown = () => {
    logger.info('Auth service shutting down')
    server.close()
    ctx.destroy()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

void main()
