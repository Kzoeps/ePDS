# E2E Step Definitions Plan — Batch 2

> Epic: ePDS-geiz · 7 feature files · ~35 scenarios

## Overview

Expand E2E test coverage from 1 feature file (passwordless-authentication, 5
scenarios) to 8 feature files (~35+ active scenarios). All tests run against
live Railway services via `pnpm test:e2e`.

This plan builds on the existing E2E infrastructure (ePDS-nr36): cucumber-js +
Playwright + Mailpit, with step definitions in `e2e/step-definitions/` and
support files in `e2e/support/`.

## Current State

### What exists

- `e2e/cucumber.mjs` — runs only `passwordless-authentication.feature`
- `e2e/step-definitions/auth.steps.ts` — browser interactions for OAuth login
- `e2e/step-definitions/common.steps.ts` — Background steps (health check,
  account creation via full OAuth flow)
- `e2e/step-definitions/email.steps.ts` — Mailpit email polling + OTP extraction
- `e2e/support/world.ts` — `EpdsWorld` with `page`, `otpCode`, `testEmail`,
  `lastEmailSubject`
- `e2e/support/hooks.ts` — Playwright lifecycle, screenshot on failure
- `e2e/support/env.ts` — Railway service URLs, Mailpit credentials
- `e2e/support/mailpit.ts` — `waitForEmail()`, `extractOtp()`, `clearMailpit()`

### What's missing

14 feature files have Gherkin specs but no step definitions and are excluded
from `cucumber.mjs paths`.

## Feature Files In Scope

| # | Feature file | Scenarios | Active | Pending | Step file |
|---|---|---|---|---|---|
| 1 | `oauth-metadata-override.feature` | 3 | 2 | 1 (full browser flow) | `api.steps.ts` (new) |
| 2 | `email-delivery.feature` | 3 | 3 | 0 | `email.steps.ts` (extend) |
| 3 | `consent-screen.feature` | 5 | 4 | 1 (CSS branding) | `auth.steps.ts` (extend) |
| 4 | `login-hint-resolution.feature` | 5 | 2 | 3 (DID hint, PAR body) | `auth.steps.ts` (extend) |
| 5 | `account-settings.feature` | 6 | 5-6 | 0-1 (subdomain DNS) | `account.steps.ts` (new) |
| 6 | `automatic-account-creation.feature` | 4 | 2 | 2 (token-dependent) | `pds.steps.ts` (new) |
| 7 | `pds-behavior-at-risk.feature` | 8 | 2-3 | 5-6 (token/DNS) | `pds.steps.ts` + `api.steps.ts` |

## Feature Files Out of Scope

| Feature file | Reason |
|---|---|
| `security.feature` | Rate limiting, CSRF, headers — intentionally deferred |
| `tls-certificate-management.feature` | Docker-only infrastructure |
| `client-branding.feature` | CSS injection feature branch not merged |
| `social-login.feature` | Stays `@manual` (needs real Google/GitHub OAuth) |
| `account-recovery.feature` | Complex orchestration (backup email + recovery flow), next batch |
| `epds-callback.feature` | HMAC tamper/expiry scenarios need crafted raw HTTP requests, lower value |
| `internal-api.feature` | `/_internal/*` endpoints need Docker network access |

## Key Technical Decisions

### 1. Token-dependent scenarios → `@pending`

The demo welcome page shows DID and handle but no access token. Extracting
the bearer token via Playwright network interception (`page.on('response')`)
is deferred. Scenarios that need a token for XRPC calls (repo CRUD,
`getSession`, `getRepo`) return `'pending'` at runtime.

### 2. Consent deny → assert `auth_failed`

The demo app's OAuth callback converts ALL errors to `/?error=auth_failed`.
When the user clicks "Deny" on the consent screen, the PDS sends
`error=access_denied`, but the demo swallows it. Step definitions assert
for `auth_failed` in the URL or "Authentication failed" in the page text.

### 3. Login hint Background → capture real handle + DID

The `login-hint-resolution.feature` Background says:
```
Given "alice@example.com" has a PDS account with handle "alice.pds.test"
```
But handles are randomly generated. The step implementation creates an
account, captures the real handle and DID from the welcome page, and stores
them on `EpdsWorld`. Subsequent steps use `this.testEmail`, `this.userHandle`,
`this.userDid` instead of the literal Gherkin strings.

### 4. Mailpit body fetching

The existing `mailpit.ts` only returns message subjects from the search API.
For `email-delivery.feature` ("email body contains a numeric OTP code",
"email contains a verification link"), we need `getMessageBody(messageId)`
that fetches the full message from `GET /api/v1/message/{id}`.

### 5. Consent flow for existing users

New accounts created via `createAccountViaOAuth` do NOT get a
`client_logins` record (the consent POST handler is the only place
`recordClientLogin` is called). So the second login for the same email
via the demo client WILL show the consent screen. This is exactly what
the consent-screen tests need — no special setup required.

### 6. Account settings login ≠ OAuth login

The account settings page (`/account`) uses a separate server-rendered
login flow:
- `POST /account/send-otp` → `POST /account/verify-otp`
- OTP input is `#otp` (NOT `#code` like the OAuth flow)
- No OAuth redirect chain, no demo app involvement

### 7. `@pending` tag vs runtime pending

- **`@pending` tag**: Used when the ENTIRE scenario cannot run (missing
  infrastructure, unmerged feature). Cucumber excludes it from the run.
- **Runtime `'pending'` return**: Used when individual steps within an
  otherwise-runnable scenario need deferral (e.g., token-dependent steps).
  `strict: false` in cucumber.mjs treats these as skipped, not failed.

## Architecture

### New files

```
e2e/step-definitions/
  api.steps.ts      # Pure HTTP fetch — oauth-metadata, describeServer, createSession
  account.steps.ts   # Account settings login + dashboard interactions
  pds.steps.ts       # Auto-account-creation, pds-behavior (mostly @pending stubs)
```

### Modified files

```
e2e/support/world.ts      # Add userDid, userHandle, lastEmailBody, lastApiResponse
e2e/support/mailpit.ts    # Add getMessageBody(messageId)
e2e/step-definitions/
  common.steps.ts          # Add createAccountViaOAuth helper + new Background steps
  auth.steps.ts            # Add consent-screen + login-hint steps
  email.steps.ts           # Add email-delivery steps (body assertions, backup email)
e2e/cucumber.mjs           # Expand paths, add "not @pending" to tags
features/
  consent-screen.feature          # Tag scenario 5 @pending
  login-hint-resolution.feature   # Tag scenarios 3, 4 @pending
  oauth-metadata-override.feature # Tag scenario 3 @pending
```

### Step file ownership

| Step file | Owns these features | Shared helpers |
|---|---|---|
| `common.steps.ts` | Background steps for all features | `createAccountViaOAuth(world, email)` |
| `api.steps.ts` | oauth-metadata-override, pds-behavior HTTP-only | — |
| `auth.steps.ts` | consent-screen, login-hint-resolution | — |
| `account.steps.ts` | account-settings | `loginToAccountSettings(world, email)` |
| `email.steps.ts` | email-delivery | — |
| `pds.steps.ts` | automatic-account-creation, pds-behavior token-dependent | — |

### EpdsWorld additions

```ts
export class EpdsWorld extends World {
  // Existing
  declare browser: Browser
  declare context: BrowserContext
  declare page: Page
  otpCode?: string
  lastEmailSubject?: string
  testEmail?: string

  // New (this plan)
  userDid?: string
  userHandle?: string
  lastEmailBody?: string
  lastApiResponse?: { json: any; headers: Headers; status: number }
}
```

## Dependency Graph

```
ePDS-geiz.1  World + common helpers (foundation)
  ├── ePDS-geiz.2  api.steps.ts (oauth-metadata + pds-behavior HTTP-only)
  │     └── ePDS-geiz.7  pds.steps.ts (auto-account-creation + pds-behavior token)
  ├── ePDS-geiz.3  auth.steps.ts — consent-screen
  ├── ePDS-geiz.4  auth.steps.ts — login-hint-resolution
  ├── ePDS-geiz.5  account.steps.ts — account-settings
  │     └── ePDS-geiz.6  email.steps.ts — email-delivery
  └── ePDS-geiz.8  cucumber.mjs + @pending tags (no deps, can run anytime)
```

### Parallelism

- **Wave 1**: `.1` (foundation) + `.8` (cucumber.mjs)
- **Wave 2** (after .1): `.2`, `.3`, `.4`, `.5` — all independent
- **Wave 3** (after .2+.5): `.6`, `.7`

## Key Selectors Reference

### OAuth login page (auth service)
- `#email` — email input
- `#step-email` — email form container
- `#step-otp` — OTP form container (gets `.active` class when shown)
- `#code` — OTP code input
- `#form-verify-otp` — OTP verify form
- `.btn-primary` — submit buttons
- `#error-msg` — error message
- `#btn-resend` — resend OTP button

### Consent page (auth service)
- `.btn-approve` — approve button (value="approve")
- `.btn-deny` — deny button (value="deny")
- `.subtitle` — client name text
- `.permissions li` — permission list items

### Account settings login (/account/login)
- `#email` — email input
- `#otp` — OTP input (NOT #code!)
- `.btn-primary` — submit buttons

### Account settings dashboard (/account)
- `<code>` — DID display
- `[name=handle]` — handle input
- `.handle-suffix` — domain suffix display
- `[name=email]` (in backup section) — backup email input
- `[name=confirm]` — delete confirmation input
- `<details>` / `<summary>` — delete account expandable

### Demo welcome page
- Body text contains `did:plc:...` (DID)
- Body text contains `@<handle>` (handle)
- No access token in DOM

### Demo error page
- URL contains `?error=auth_failed`
- Body text contains "Authentication failed. Please try again."

## Estimated Effort

| Task | Est. | Description |
|---|---|---|
| `.1` | 45m | World fields + createAccountViaOAuth + Background steps |
| `.2` | 40m | api.steps.ts — pure HTTP fetch scenarios |
| `.3` | 55m | consent-screen steps (multi-pass login) |
| `.4` | 40m | login-hint steps |
| `.5` | 55m | account-settings steps (separate login flow) |
| `.6` | 35m | email-delivery steps (extends existing) |
| `.7` | 45m | pds.steps.ts (mostly @pending stubs) |
| `.8` | 20m | cucumber.mjs paths + @pending tags |
| **Total** | **~5.5h** | |

## Future Work (not in this batch)

1. **Bearer token extraction** — Playwright `page.on('response')` to capture
   access tokens during OAuth flow, enabling repo CRUD and getSession tests
2. **account-recovery.feature** — backup email setup + recovery flow
3. **security.feature** — CSRF, rate limiting, security headers
4. **epds-callback.feature** — HMAC tamper/expiry with crafted HTTP requests
5. **internal-api.feature** — Docker-only `/_internal/*` endpoint tests
6. **client-branding.feature** — after CSS injection feature branch merges
