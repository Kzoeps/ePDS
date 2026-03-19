/**
 * Shared HTML error page renderers used across auth-service route handlers.
 *
 * These are pure functions with no dependencies on request/response context,
 * making them straightforward to unit test.
 */

import { escapeHtml } from '@certified-app/shared'

/**
 * Renders a minimal HTML error page with a red error message.
 * Used by route handlers to send simple error responses without a full
 * page layout (session expired, service unavailable, etc.).
 */
export function renderError(message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Error</title></head>
<body><p style="color:red;padding:20px">${escapeHtml(message)}</p></body>
</html>`
}

/**
 * Renders the "No account found" error page shown when a valid better-auth
 * session exists but the session email has no corresponding PDS account.
 * This can happen when email is changed out-of-band via XRPC.
 */
export function renderNoAccountPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>No Account Found</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 100%; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 24px; margin-bottom: 8px; color: #111; }
    .subtitle { color: #666; margin-bottom: 24px; font-size: 15px; line-height: 1.6; }
    .btn-secondary { display: inline-block; color: #0f1828; background: none; border: 1px solid #0f1828; border-radius: 8px; padding: 10px 20px; font-size: 14px; text-decoration: none; cursor: pointer; }
    .btn-secondary:hover { background: #f0f2f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>No account found</h1>
    <p class="subtitle">
      We couldn't find a PDS account for this email address.<br>
      To get started, sign in to an app that uses this server first.
    </p>
    <a href="/account/login" class="btn-secondary">Try a different email</a>
  </div>
</body>
</html>`
}
