/**
 * Step definitions for account-settings.feature.
 *
 * The account settings login flow is SEPARATE from the OAuth flow:
 *   /account/login → POST /account/send-otp → POST /account/verify-otp → /account
 *
 * Key differences from the OAuth flow:
 *   - OTP input uses #otp (NOT #code)
 *   - Submit button text is "Verify" (NOT the OAuth form button)
 *   - No SPA-style step transitions — server-rendered form redirects
 */

import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { EpdsWorld } from '../support/world.js'
import { testEnv } from '../support/env.js'
import { waitForEmail, extractOtp } from '../support/mailpit.js'
import { createAccountViaOAuth } from './common.steps.js'
import { sharedBrowser } from '../support/hooks.js'

/**
 * Drive the account settings login flow:
 *   1. Navigate to authUrl + "/account/login"
 *   2. Fill #email with email, submit form
 *   3. Wait for OTP form (#otp visible)
 *   4. Fetch OTP from Mailpit
 *   5. Fill #otp (NOT #code), submit form
 *   6. Wait for redirect to /account
 *   7. Assert h1 contains "Account Settings"
 */
export async function loginToAccountSettings(
  world: EpdsWorld,
  email: string,
): Promise<void> {
  await world.page.goto(testEnv.authUrl + '/account/login')
  await world.page.fill('#email', email)
  await world.page.click('button[type=submit]')
  await world.page.waitForLoadState('networkidle')

  // Wait for OTP form — account settings uses #otp, not #code
  await expect(world.page.locator('#otp')).toBeVisible({ timeout: 30_000 })

  const message = await waitForEmail(`to:${email}`)
  const otp = extractOtp(message.Subject)

  await world.page.fill('#otp', otp)
  await world.page.click('button[type=submit]')
  await world.page.waitForURL('**/account', { timeout: 30_000 })

  await expect(world.page.locator('h1')).toContainText('Account Settings')
}

// ---------------------------------------------------------------------------
// Background step
// ---------------------------------------------------------------------------

/**
 * "alice@example.com" has a PDS account — creates an account via OAuth
 * (ignores the literal Gherkin email, generates a unique one).
 * Returns pending when Mailpit is not configured.
 */
Given(
  '{string} has a PDS account',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'

    const email = `account-${Date.now()}@example.com`
    await createAccountViaOAuth(this, email)

    // Reset browser context so the scenario starts with a clean session
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)
  },
)

// ---------------------------------------------------------------------------
// Authentication steps
// ---------------------------------------------------------------------------

/**
 * Navigate to /account without a session — should redirect to /account/login.
 * The literal Gherkin URL (https://auth.pds.test/account) is ignored;
 * testEnv.authUrl is used instead.
 */
When(
  /^a user navigates to https:\/\/auth\.pds\.test\/account without a session$/,
  async function (this: EpdsWorld) {
    await this.page.goto(testEnv.authUrl + '/account')
  },
)

Then(
  /^the browser is redirected to \/account\/login$/,
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/account/login', { timeout: 10_000 })
    expect(this.page.url()).toMatch(/\/account\/login$/)
  },
)

When(
  /^the user navigates to \/account\/login$/,
  async function (this: EpdsWorld) {
    await this.page.goto(testEnv.authUrl + '/account/login')
  },
)

Then(
  /^a login form is displayed \(separate from the OAuth flow\)$/,
  async function (this: EpdsWorld) {
    await expect(this.page.locator('#email')).toBeVisible()
  },
)

/**
 * Fill email and verify OTP via the account settings login flow.
 * Uses this.testEmail (set by the Background step) rather than the literal
 * Gherkin email string.
 */
When(
  'the user enters {string} and verifies the OTP',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error('No test email set — Background step must run first')
    }
    await loginToAccountSettings(this, this.testEmail)
  },
)

Then(
  /^the browser is redirected to \/account$/,
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/account', { timeout: 10_000 })
    expect(this.page.url()).toMatch(/\/account$/)
  },
)

Then(
  'the account settings dashboard is displayed',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('h1')).toContainText('Account Settings')
  },
)

// ---------------------------------------------------------------------------
// Account information steps
// ---------------------------------------------------------------------------

/**
 * Log in to account settings as the named user.
 * The literal Gherkin email is ignored — this.testEmail (set by Background) is used.
 * Returns pending when Mailpit is not configured.
 */
Given(
  '{string} is logged into account settings',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error('No test email set — Background step must run first')
    }
    await loginToAccountSettings(this, this.testEmail)
  },
)

/** No-op — already on /account after loginToAccountSettings. */
When(/^they view the \/account page$/, async function (this: EpdsWorld) {
  // Already on /account from the login step — nothing to do
})

Then('the page displays their DID', async function (this: EpdsWorld) {
  await expect(this.page.locator('code')).toContainText('did:')
})

Then(
  /^the page displays their primary email \(masked\)$/,
  async function (this: EpdsWorld) {
    // Masked email looks like "t***@example.com" — check for the masking pattern
    const bodyText = await this.page.locator('body').innerText()
    expect(bodyText).toMatch(/[a-z0-9*]+\*+@[a-z0-9.-]+/)
  },
)

Then(
  'the page displays their current handle',
  async function (this: EpdsWorld) {
    // Either the handle input is visible or the page contains a handle-like string
    const handleInput = this.page.locator('[name=handle]')
    await expect(handleInput).toBeVisible()
  },
)

// ---------------------------------------------------------------------------
// Handle management steps
// ---------------------------------------------------------------------------

/** No-op — handle was auto-generated; we just note this in the Gherkin. */
Given(
  'their current handle is a random subdomain like {string}',
  function (this: EpdsWorld, _handle: string) {
    // No-op — handle is auto-generated, captured from welcome page
  },
)

/**
 * Submit a new handle. The literal Gherkin handle is ignored — a unique
 * handle is generated to avoid collisions across test runs.
 */
When(
  'the user submits a new handle {string}',
  async function (this: EpdsWorld, _handle: string) {
    // Generate a unique handle to avoid collisions
    const uniqueHandle = `e2e-${Date.now()}`
    this.userHandle = uniqueHandle
    await this.page.fill('[name=handle]', uniqueHandle)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
  },
)

Then(
  'the handle is updated to {string}',
  async function (this: EpdsWorld, _handle: string) {
    // Assert the page contains the new handle we set (stored on world)
    if (this.userHandle) {
      const bodyText = await this.page.locator('body').innerText()
      expect(bodyText).toContain(this.userHandle)
    }
  },
)

Then(
  'the settings page reflects the new handle',
  async function (this: EpdsWorld) {
    if (this.userHandle) {
      const bodyText = await this.page.locator('body').innerText()
      expect(bodyText).toContain(this.userHandle)
    }
  },
)

/**
 * DNS-dependent check — return pending.
 * Requires handle subdomain DNS resolution on Railway.
 */
Then(
  /^https:\/\/[^/]+\/\.well-known\/atproto-did returns alice's DID$/,
  function (this: EpdsWorld) {
    return 'pending'
  },
)

// ---------------------------------------------------------------------------
// Session management steps
// ---------------------------------------------------------------------------

/** No-op — the OAuth login and account settings login each created a session. */
Given('has at least one other active session', function (this: EpdsWorld) {
  // No-op — createAccountViaOAuth + loginToAccountSettings created multiple sessions
})

When('the user views the sessions section', async function (this: EpdsWorld) {
  // Assert the sessions section heading is visible
  const sessionsHeading = this.page.getByText('Active Sessions')
  await expect(sessionsHeading).toBeVisible()
})

Then('active sessions are listed', async function (this: EpdsWorld) {
  // At least one session row should be visible
  const sessionRows = this.page.locator(
    "form[action='/account/session/revoke']",
  )
  await expect(sessionRows.first()).toBeVisible()
})

When('the user revokes another session', async function (this: EpdsWorld) {
  // Find all revoke buttons and click the first one (not the current session)
  const revokeButtons = this.page.locator('button[type=submit]').filter({
    hasText: 'Revoke',
  })
  const count = await revokeButtons.count()
  if (count === 0) {
    throw new Error(
      'No revoke buttons found — expected at least one session to revoke',
    )
  }
  // Store count before revoking so we can assert it decreased
  this.lastSessionCount = count
  await revokeButtons.first().click()
  await this.page.waitForLoadState('networkidle')
})

Then('that session is no longer listed', async function (this: EpdsWorld) {
  const revokeButtons = this.page.locator('button[type=submit]').filter({
    hasText: 'Revoke',
  })
  const newCount = await revokeButtons.count()
  const previousCount = this.lastSessionCount ?? 1
  expect(newCount).toBeLessThan(previousCount)
})

// ---------------------------------------------------------------------------
// Account deletion steps
// ---------------------------------------------------------------------------

When(
  'the user initiates account deletion and confirms',
  async function (this: EpdsWorld) {
    // Open the danger zone details element
    const dangerSummary = this.page.locator('details summary').filter({
      hasText: /delete account/i,
    })
    await dangerSummary.click()

    // Fill the confirmation input with "DELETE"
    await this.page.fill('[name=confirm]', 'DELETE')

    // Click the delete button inside the details
    const deleteButton = this.page
      .locator('details button[type=submit]')
      .filter({
        hasText: /delete/i,
      })
    await deleteButton.click()
    await this.page.waitForLoadState('networkidle')
  },
)

Then(
  /^the browser is redirected away from \/account \(signed out\)$/,
  function (this: EpdsWorld) {
    const url = this.page.url()
    // Should be on /account/login or some other page, not /account dashboard
    expect(url).not.toMatch(/\/account$/)
  },
)

/**
 * Would need internal API access to verify account deletion — return pending.
 */
Then(
  'the PDS account for {string} no longer exists',
  function (this: EpdsWorld, _email: string) {
    return 'pending'
  },
)

/**
 * Would need a bearer token to call getSession — return pending.
 */
Then(
  "com.atproto.server.getSession fails for alice's DID",
  function (this: EpdsWorld) {
    return 'pending'
  },
)
