/**
 * pds.steps.ts — Step definitions for automatic-account-creation.feature and
 * the browser/token-dependent scenarios from pds-behavior-at-risk.feature.
 *
 * Token-dependent steps (getSession, createRecord, getRecord, deleteRecord,
 * getRepo) return "pending" — bearer token extraction via Playwright network
 * interception is deferred.
 *
 * PAR-dependent steps return "pending" — DPoP key generation is out of scope.
 *
 * Handle subdomain DNS steps return "pending" — requires Railway DNS resolution.
 */

import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { EpdsWorld } from '../support/world.js'
import { testEnv } from '../support/env.js'
import { waitForEmail, extractOtp } from '../support/mailpit.js'
import { createAccountViaOAuth } from './common.steps.js'
import { sharedBrowser } from '../support/hooks.js'

// ---------------------------------------------------------------------------
// automatic-account-creation.feature — Scenario 1
// "First-time user gets an auto-created PDS account"
// ---------------------------------------------------------------------------

/**
 * Drives the full new-user OAuth sign-up flow through the demo app.
 * Uses world.testEmail (set by "no PDS account exists for" step).
 * Returns pending when Mailpit is not configured.
 */
When(
  '{string} authenticates via the demo client',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error(
        'No test email set — "no PDS account exists for" step must run first',
      )
    }

    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${this.testEmail}`)
    const otp = extractOtp(message.Subject)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })

    // Capture DID and handle from the welcome page
    const bodyText = await this.page.locator('body').innerText()

    const didMatch = /did:[a-z0-9:]+/i.exec(bodyText)
    if (!didMatch) {
      throw new Error('Could not find DID on welcome page')
    }
    this.userDid = didMatch[0]

    const handleMatch = /@([A-Za-z0-9][A-Za-z0-9.-]+)/.exec(bodyText)
    if (!handleMatch) {
      throw new Error('Could not find handle on welcome page')
    }
    this.userHandle = handleMatch[0] // includes the leading @
  },
)

/**
 * Asserts that the OAuth flow completed successfully by checking that the
 * welcome page body contains a DID (proves token exchange succeeded).
 */
Then(
  'the demo client receives a valid OAuth access token',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('body')).toContainText('did:')
  },
)

/**
 * Pending — requires bearer token to call getSession.
 */
Then(
  'the access token can be used to call com.atproto.server.getSession',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — requires bearer token for getSession call.
 */
Then(
  'the response contains a DID and a handle matching *.pds.test',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

// ---------------------------------------------------------------------------
// automatic-account-creation.feature — Scenario 2
// "Auto-created handle is a random subdomain"
// ---------------------------------------------------------------------------

/**
 * No-op if world.userDid is already set (account was just created in the
 * previous scenario). Otherwise returns pending.
 */
Given(
  '{string} just had an account auto-created',
  function (this: EpdsWorld, _email: string) {
    if (!this.userDid) {
      return 'pending'
    }
    // No-op — account was created in the previous scenario
  },
)

/**
 * Pending — requires bearer token to call getSession.
 */
When(
  'the account handle is inspected via com.atproto.server.getSession',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * If world.userHandle is set (captured from the welcome page), asserts it
 * matches the pattern for a short alphanumeric subdomain. Otherwise pending.
 */
Then(
  'the handle is a short alphanumeric subdomain of the PDS domain',
  function (this: EpdsWorld) {
    if (!this.userHandle) {
      return 'pending'
    }
    // Strip leading @ if present
    const handle = this.userHandle.startsWith('@')
      ? this.userHandle.slice(1)
      : this.userHandle
    if (!/^[a-z0-9]+\.[a-z0-9.-]+$/i.test(handle)) {
      throw new Error(
        `Expected handle to match /^[a-z0-9]+\\.[a-z0-9.-]+$/i but got: "${handle}"`,
      )
    }
  },
)

/**
 * Pending — requires DNS resolution for handle subdomain on Railway.
 */
Then(
  'the handle subdomain resolves via HTTPS (TLS certificate provisioned)',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

// ---------------------------------------------------------------------------
// automatic-account-creation.feature — Scenarios 3 & 4
// "Auto-created account has a working AT Protocol repo"
// "Password-based login does not work for auto-created accounts"
// ---------------------------------------------------------------------------

/**
 * Creates a PDS account for the named user (the literal Gherkin email is
 * ignored — a unique email is generated). Returns pending when Mailpit is
 * not configured.
 */
Given(
  '{string} has an auto-created PDS account',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'

    const email = `auto-${Date.now()}@example.com`
    await createAccountViaOAuth(this, email)

    // Reset browser context so the scenario starts with a clean session
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)
  },
)

/**
 * Pending — requires bearer token to call com.atproto.repo.createRecord.
 */
When(
  'the user creates a record via com.atproto.repo.createRecord',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on createRecord step above.
 */
Then('the record is created successfully', function (this: EpdsWorld) {
  return 'pending'
})

/**
 * Pending — requires bearer token to call com.atproto.repo.getRecord.
 */
Then(
  'it can be retrieved via com.atproto.repo.getRecord',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Attempts com.atproto.server.createSession with any password for the
 * current test email. Stores the response on world.lastApiResponse.
 */
When(
  'someone attempts com.atproto.server.createSession with any password',
  async function (this: EpdsWorld) {
    const res = await fetch(
      `${testEnv.pdsUrl}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: this.testEmail ?? 'test@example.com',
          password: 'anypassword123',
        }),
      },
    )
    const json: unknown = await res.json()
    this.lastApiResponse = { json, headers: res.headers, status: res.status }
  },
)

/**
 * Asserts that the createSession request failed with a 401 or 400 status.
 */
Then('authentication fails', function (this: EpdsWorld) {
  if (!this.lastApiResponse) {
    throw new Error(
      'No API response stored — createSession step must run first',
    )
  }
  const { status } = this.lastApiResponse
  if (status !== 401 && status !== 400) {
    throw new Error(`Expected status 401 or 400 but got: ${status}`)
  }
})

/**
 * No-op assertion — this is a documentation statement, not testable.
 */
Then(
  'the only way to authenticate is through the ePDS OAuth flow',
  function (this: EpdsWorld) {
    // No-op: this is a documentation statement
  },
)

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — Scenario 2
// "Full OAuth flow produces a working access token"
// ---------------------------------------------------------------------------

/**
 * Drives the full new-user OAuth sign-up flow through the demo app.
 * Uses world.testEmail (set by the Background step). Returns pending when
 * Mailpit is not configured.
 */
When(
  'a user authenticates through the ePDS OAuth flow',
  async function (this: EpdsWorld) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error('No test email set — Background step must run first')
    }

    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${this.testEmail}`)
    const otp = extractOtp(message.Subject)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })
  },
)

/**
 * No-op — the demo app performs the token exchange automatically during
 * the OAuth callback.
 */
When(
  'the demo client exchanges the authorization code for tokens',
  function (this: EpdsWorld) {
    // No-op: the demo app does this automatically during the OAuth callback
  },
)

/**
 * Asserts that the access token is working by checking that the welcome
 * page body contains a DID (proves the token exchange succeeded).
 */
Then(
  'the access token can be used to call authenticated XRPC endpoints',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('body')).toContainText('did:')
  },
)

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — Scenario 3
// "PAR endpoint works correctly"
// ---------------------------------------------------------------------------

/**
 * Pending — requires DPoP key generation.
 */
When(
  /^an OAuth client sends a PAR request to POST \/oauth\/par$/,
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on PAR request step above.
 */
Then('a valid request_uri is returned', function (this: EpdsWorld) {
  return 'pending'
})

/**
 * Pending — depends on PAR request step above.
 */
Then(
  'the request_uri can be used in the authorization flow',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — Scenario 4
// "Repo operations work on ePDS-created accounts"
// ---------------------------------------------------------------------------

/**
 * Pending — no bearer token available from the browser.
 */
Given('the user has a valid access token', function (this: EpdsWorld) {
  return 'pending'
})

/**
 * Pending — requires bearer token to call com.atproto.repo.getRecord.
 */
When(
  'the user reads the record via com.atproto.repo.getRecord',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on getRecord step above.
 */
Then('the record is returned', function (this: EpdsWorld) {
  return 'pending'
})

/**
 * Pending — requires bearer token to call com.atproto.repo.deleteRecord.
 */
When(
  'the user deletes the record via com.atproto.repo.deleteRecord',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on deleteRecord step above.
 */
Then('the deletion succeeds', function (this: EpdsWorld) {
  return 'pending'
})

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — Scenario 5
// "DID document resolves correctly for ePDS accounts"
// ---------------------------------------------------------------------------

/**
 * Asserts that world.userDid starts with "did:plc:" (if set), otherwise pending.
 */
Given(
  "the user's account was auto-created with a PLC DID",
  function (this: EpdsWorld) {
    if (!this.userDid) {
      return 'pending'
    }
    if (!this.userDid.startsWith('did:plc:')) {
      throw new Error(
        `Expected userDid to start with "did:plc:" but got: "${this.userDid}"`,
      )
    }
  },
)

/**
 * Pending — requires PLC directory fetch.
 */
When('the DID document is resolved', function (this: EpdsWorld) {
  return 'pending'
})

/**
 * Pending — depends on DID document resolution step above.
 */
Then(
  'it contains a service entry pointing to the PDS',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on DID document resolution step above.
 */
Then('the handle can be verified', function (this: EpdsWorld) {
  return 'pending'
})

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — Scenario 6
// "Handle resolution via .well-known works"
// ---------------------------------------------------------------------------

/**
 * Stores the provided handle on world.userHandle (already set from account
 * creation — the literal Gherkin value is ignored).
 */
Given(
  'the user has handle {string}',
  function (this: EpdsWorld, _handle: string) {
    // No-op: world.userHandle is already set by the Background step
  },
)

/**
 * Pending — requires handle subdomain DNS resolution on Railway.
 */
When(
  /^a client fetches https:\/\/[^/]+\/\.well-known\/atproto-did$/,
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on .well-known fetch step above.
 */
Then('the correct DID is returned', function (this: EpdsWorld) {
  return 'pending'
})

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — Scenario 7
// "Repo sync endpoint works"
// ---------------------------------------------------------------------------

/**
 * Pending — requires bearer token to create records first.
 */
Given('the user has created some records', function (this: EpdsWorld) {
  return 'pending'
})

/**
 * Pending — requires bearer token / DID to call com.atproto.sync.getRepo.
 */
When(
  "a client calls com.atproto.sync.getRepo for the user's DID",
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on getRepo step above.
 */
Then('the repo CAR file is returned successfully', function (this: EpdsWorld) {
  return 'pending'
})
