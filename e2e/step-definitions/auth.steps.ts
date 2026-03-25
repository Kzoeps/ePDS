import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { EpdsWorld } from '../support/world.js'
import { testEnv } from '../support/env.js'
import { waitForEmail, extractOtp } from '../support/mailpit.js'
When(
  'the demo client initiates an OAuth login',
  async function (this: EpdsWorld) {
    await this.page.goto(testEnv.demoUrl)
  },
)

Then(
  'the browser is redirected to the auth service login page',
  async function (this: EpdsWorld) {
    const loginForm = this.page.locator('#email')
    await expect(loginForm).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the login page displays an email input form',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('#email')).toBeVisible()
  },
)

When(
  'the user enters {string} and submits',
  async function (this: EpdsWorld, email: string) {
    await this.page.fill('#email', email)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
  },
)

When(
  'the user enters a unique test email and submits',
  async function (this: EpdsWorld) {
    this.testEmail = `test-${Date.now()}@example.com`
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
  },
)

When(
  'the user enters {string} on the login page',
  async function (this: EpdsWorld, email: string) {
    await this.page.fill('#email', email)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
  },
)

When(
  'the user enters the test email on the login page',
  async function (this: EpdsWorld) {
    if (!this.testEmail) {
      throw new Error(
        'No test email set — "a returning user has a PDS account" step must run first',
      )
    }
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
  },
)

Then(
  'the login page shows an OTP verification form',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })
  },
)

When(
  'the user enters the OTP code from the email',
  async function (this: EpdsWorld) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.otpCode)
      throw new Error('No OTP code available — email step must run first')
    await this.page.fill('#code', this.otpCode)
    await this.page.click('#form-verify-otp .btn-primary')
  },
)

When('the user enters the OTP code', async function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'
  if (!this.otpCode)
    throw new Error('No OTP code available — email step must run first')
  await this.page.fill('#code', this.otpCode)
  await this.page.click('#form-verify-otp .btn-primary')
})

Then(
  'the browser is redirected back to the demo client',
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })
  },
)

Then(
  'the browser is redirected back to the demo client with a valid session',
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })
  },
)

Then(
  'the demo client has a valid OAuth access token',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('body')).toContainText('did:')
  },
)

// --- OTP verification scenarios ---

When(
  'the user requests an OTP for {string}',
  async function (this: EpdsWorld, email: string) {
    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', email)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })
  },
)

When(
  'the user requests an OTP for a unique test email',
  async function (this: EpdsWorld) {
    this.testEmail = `test-${Date.now()}@example.com`
    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await this.page.waitForLoadState('networkidle')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })
  },
)

When('enters an incorrect OTP code', async function (this: EpdsWorld) {
  await this.page.fill('#code', '00000000')
  await this.page.click('#form-verify-otp .btn-primary')
})

When(
  'enters an incorrect OTP code {int} times',
  async function (this: EpdsWorld, times: number) {
    for (let i = 0; i < times; i++) {
      await this.page.fill('#code', '00000000')
      await this.page.click('#form-verify-otp .btn-primary')
      await this.page.waitForTimeout(500)
    }
  },
)

Then(
  'the verification form shows an error message',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('#error-msg')).toBeVisible()
  },
)

Then('the user can try again', async function (this: EpdsWorld) {
  await expect(this.page.locator('#code')).toBeEnabled()
})

Then('further attempts are rejected', async function (this: EpdsWorld) {
  await expect(this.page.locator('#error-msg')).toBeVisible()
})

Then('the user must request a new OTP', async function (this: EpdsWorld) {
  await expect(this.page.locator('#btn-resend')).toBeVisible()
})

// --- Refresh scenario ---

When(
  'the demo client redirects to the auth service login page',
  async function (this: EpdsWorld) {
    await this.page.goto(testEnv.demoUrl)
  },
)

When(
  'the user refreshes the page \\(duplicate GET \\/oauth\\/authorize\\)',
  async function (this: EpdsWorld) {
    await this.page.reload()
  },
)

Then('the login page renders normally', async function (this: EpdsWorld) {
  await expect(this.page.locator('#email')).toBeVisible()
})

Then('the OTP flow still works to completion', function (this: EpdsWorld) {
  return this.skipIfNoMailpit()
})

// --- Login hint resolution scenarios ---

/**
 * Initiates OAuth via the demo app's login API route with a login_hint.
 *
 * The Gherkin hint value is used only to determine the hint type:
 *   - email (contains @): navigates to /api/oauth/login?email=<world.testEmail>
 *   - handle (contains . but no @): navigates to /api/oauth/login?handle=<world.userHandle>
 *   - DID (starts with "did:"): not supported by the demo — return pending
 *
 * The REAL values from world (testEmail, userHandle) are used, not the
 * literal Gherkin strings.
 */
When(
  'the demo client initiates OAuth with login_hint={string}',
  async function (this: EpdsWorld, hint: string) {
    if (hint.startsWith('did:')) {
      // Demo does not support DID login hints — requires custom PAR client
      return 'pending'
    }

    let url: string
    if (hint.includes('@')) {
      // Email hint — use the real test email from world
      if (!this.testEmail) {
        throw new Error(
          'No test email set — background account creation step must run first',
        )
      }
      url = `${testEnv.demoUrl}/api/oauth/login?email=${encodeURIComponent(this.testEmail)}`
    } else {
      // Handle hint — use the real handle from world
      if (!this.userHandle) {
        throw new Error(
          'No user handle set — background account creation step must run first',
        )
      }
      // Strip leading @ if present (userHandle may include it)
      const handle = this.userHandle.startsWith('@')
        ? this.userHandle.slice(1)
        : this.userHandle
      url = `${testEnv.demoUrl}/api/oauth/login?handle=${encodeURIComponent(handle)}`
    }

    await this.page.goto(url)
  },
)

/**
 * Asserts that the auth service rendered the OTP step directly,
 * skipping the email form (login_hint was resolved successfully).
 */
Then(
  'the login page renders directly at the OTP verification step',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })
    await expect(this.page.locator('#step-email')).not.toBeVisible()
  },
)

/**
 * Polls Mailpit for the OTP email that was auto-sent when the login_hint
 * was resolved. Uses world.testEmail (the real email), not the literal
 * Gherkin string. Stores the OTP code on world for subsequent steps.
 */
Then(
  'an OTP email is auto-sent to {string}',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error(
        'No test email set — background account creation step must run first',
      )
    }
    const message = await waitForEmail(`to:${this.testEmail}`)
    this.lastEmailSubject = message.Subject
    this.otpCode = extractOtp(message.Subject)
  },
)

/**
 * No-op — the real DID is already captured on world.userDid from the
 * Background step. The literal Gherkin DID value is ignored.
 */
Given("alice's DID is {string}", function (this: EpdsWorld, _did: string) {
  // No-op: world.userDid is already set by the Background step
})

/**
 * Pending — constructing a custom PAR request with DPoP is out of scope.
 */
When(
  'the demo client submits login_hint in the PAR request body (not the redirect URL)',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on PAR body hint step above.
 */
Then(
  'the auth service retrieves the hint from the stored PAR request',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Pending — depends on PAR body hint step above.
 */
Then(
  'the login page renders at the OTP step with the hint resolved',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

/**
 * Asserts that the auth service showed the email input form because the
 * login_hint could not be resolved (unknown handle/email).
 */
Then(
  'the login page shows the email input form (hint could not be resolved)',
  async function (this: EpdsWorld) {
    await expect(this.page.locator('#email')).toBeVisible({ timeout: 30_000 })
    await expect(this.page.locator('#step-otp')).not.toHaveClass(/active/)
  },
)

// --- Consent screen scenarios ---

/**
 * No-op. Each scenario uses a freshly created account (from the Background
 * step "{string} has an existing PDS account"), so consent is always first-time.
 */
Given(
  '{string} has never logged into the demo client',
  function (this: EpdsWorld, _email: string) {
    // No-op: account was just created, no client_login record exists yet
  },
)

/**
 * Drives the full OTP login flow through the demo client for an existing user.
 * Uses world.testEmail (set by the Background step) — ignores the literal
 * Gherkin email. Does NOT wait for /welcome because the flow may stop at
 * /auth/consent for existing users.
 */
When(
  '{string} authenticates via OTP through the demo client',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error(
        'No test email set — background account creation step must run first',
      )
    }

    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${this.testEmail}`)
    const otp = extractOtp(message.Subject)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')
    // Do NOT wait for /welcome — the flow may stop at /auth/consent
  },
)

/**
 * Asserts that the consent screen is displayed by waiting for the URL to
 * contain /auth/consent and checking that the approve button is visible.
 */
Then('a consent screen is displayed', async function (this: EpdsWorld) {
  await this.page.waitForURL('**/auth/consent', { timeout: 30_000 })
  await expect(this.page.locator('.btn-approve')).toBeVisible()
})

/**
 * Asserts that the consent screen shows the demo client's name and at least
 * one requested permission.
 */
Then(
  "it shows the demo client's name and requested permissions",
  async function (this: EpdsWorld) {
    const subtitle = this.page.locator('.subtitle')
    await expect(subtitle).not.toBeEmpty()
    const permissions = this.page.locator('.permissions li')
    const count = await permissions.count()
    expect(count).toBeGreaterThan(0)
  },
)

/**
 * Clicks the Approve or Deny button on the consent screen.
 */
When(
  'the user clicks {string}',
  async function (this: EpdsWorld, label: string) {
    if (label === 'Approve') {
      await this.page.click('.btn-approve')
    } else if (label === 'Deny') {
      await this.page.click('.btn-deny')
    } else {
      throw new Error(`Unknown consent button label: "${label}"`)
    }
  },
)

/**
 * Drives the full OTP login flow AND asserts the consent screen is shown.
 * Combines the "authenticates via OTP" and "a consent screen is displayed"
 * steps for use in scenarios that need to reach the consent screen in one step.
 */
When(
  '{string} authenticates and reaches the consent screen',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error(
        'No test email set — background account creation step must run first',
      )
    }

    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${this.testEmail}`)
    const otp = extractOtp(message.Subject)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')

    // Assert consent screen is shown
    await this.page.waitForURL('**/auth/consent', { timeout: 30_000 })
    await expect(this.page.locator('.btn-approve')).toBeVisible()
  },
)

/**
 * Asserts that the demo client received an access_denied error.
 * The demo app converts access_denied → auth_failed in the redirect URL.
 */
Then(
  'the demo client receives an {string} error',
  async function (this: EpdsWorld, _errorCode: string) {
    // Wait for the demo to redirect with the error — it converts
    // access_denied → auth_failed in the callback URL
    await this.page.waitForURL(/error=auth_failed/, { timeout: 30_000 })
    await expect(this.page.locator('body')).toContainText('Authentication failed')
  },
)

/**
 * Drives the full OAuth flow twice for the named user:
 *   1. First login: creates the account (new user, no consent shown)
 *   2. Second login: consent screen appears → click Approve → consent recorded
 * Then resets the browser context so the next step starts with a clean session.
 *
 * After this step, world.testEmail is set and the demo client has a recorded
 * client_login for that email, so subsequent logins will skip consent.
 */
Given(
  '{string} has previously approved the demo client',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'

    // First login: creates the account (new user — consent is skipped)
    const email = `consent-${Date.now()}@example.com`
    await createAccountViaOAuth(this, email)

    // Reset context between the two logins
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)

    // Clear inbox so we get a fresh OTP for the second login
    await clearMailpit()

    // Second login: existing user → consent screen appears → click Approve
    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', email)
    await this.page.click('button[type=submit]')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${email}`)
    const otp = extractOtp(message.Subject)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')

    // Wait for consent screen and approve
    await this.page.waitForURL('**/auth/consent', { timeout: 30_000 })
    await this.page.click('.btn-approve')
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })

    // Reset context for the next step (the actual test login)
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)

    // Store the email for subsequent steps
    this.testEmail = email
    await clearMailpit()
  },
)

/**
 * Drives a second OTP login for an existing user who has already approved
 * the demo client. Consent should be skipped this time.
 */
When(
  '{string} authenticates again via the demo client',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error(
        'No test email set — "has previously approved the demo client" step must run first',
      )
    }

    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', this.testEmail)
    await this.page.click('button[type=submit]')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${this.testEmail}`)
    const otp = extractOtp(message.Subject)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')
    // Consent should be skipped — flow goes directly to /welcome
  },
)

/**
 * Asserts that no consent screen was shown by waiting for the /welcome URL.
 * If consent appeared, the flow would have stopped there and this wait would timeout.
 */
Then('no consent screen is shown', async function (this: EpdsWorld) {
  await this.page.waitForURL('**/welcome', { timeout: 30_000 })
})

/**
 * Asserts that the browser was redirected directly to the demo client with
 * a valid session (DID visible on the welcome page).
 */
Then(
  'the browser is redirected directly to the demo client with a valid session',
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })
    await expect(this.page.locator('body')).toContainText('did:')
  },
)

/**
 * Asserts that no consent screen was shown for a new user (account creation
 * implies consent). Same assertion as "no consent screen is shown".
 */
Then(
  'no consent screen is shown (account creation implies consent)',
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })
  },
)

/**
 * Asserts that a PDS account was created by checking for a DID on the
 * welcome page.
 */
Then('a PDS account is created', async function (this: EpdsWorld) {
  await expect(this.page.locator('body')).toContainText('did:')
})

/**
 * Asserts that the browser was redirected to the demo client with a valid
 * session (DID visible on the welcome page).
 */
Then(
  'the browser is redirected to the demo client with a valid session',
  async function (this: EpdsWorld) {
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })
    await expect(this.page.locator('body')).toContainText('did:')
  },
)
