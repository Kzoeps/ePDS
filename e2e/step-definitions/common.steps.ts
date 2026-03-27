import { Given } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { EpdsWorld } from '../support/world.js'
import { sharedBrowser } from '../support/hooks.js'
import { testEnv } from '../support/env.js'
import { waitForEmail, extractOtp, clearMailpit } from '../support/mailpit.js'

Given('the ePDS test environment is running', async function (this: EpdsWorld) {
  const res = await fetch(`${testEnv.pdsUrl}/health`)
  if (!res.ok) {
    throw new Error(
      `PDS health check failed: ${res.status} at ${testEnv.pdsUrl}/xrpc/_health`,
    )
  }
})

Given('a demo OAuth client is registered', async function (this: EpdsWorld) {
  // No-op: Railway demo app is always registered via /client-metadata.json
})

/**
 * Drive the full new-user OAuth sign-up flow through the demo app:
 *   1. Navigate to demoUrl
 *   2. Fill #email with the provided email, submit
 *   3. Wait for #step-otp.active (30 s)
 *   4. Fetch OTP from Mailpit via waitForEmail + extractOtp
 *   5. Fill #code with OTP, click #form-verify-otp .btn-primary
 *   6. Wait for URL matching "**\/welcome" (30 s)
 *   7. Capture DID from page body text (regex did:[a-z0-9:]+)
 *   8. Capture handle from page body text (text starting with @)
 *   9. Store testEmail, userDid, userHandle on the world
 *  10. Clear Mailpit inbox
 *  11. Return { did, handle }
 *
 * Callers must check testEnv.mailpitPass before calling this function.
 */
export async function createAccountViaOAuth(
  world: EpdsWorld,
  email: string,
): Promise<{ did: string; handle: string }> {
  await world.page.goto(testEnv.demoUrl)
  await world.page.fill('#email', email)
  await world.page.click('button[type=submit]')
  await world.page.waitForLoadState('networkidle')
  await expect(world.page.locator('#step-otp.active')).toBeVisible({
    timeout: 30_000,
  })

  const message = await waitForEmail(`to:${email}`)
  const otp = extractOtp(message.Subject)
  await world.page.fill('#code', otp)
  await world.page.click('#form-verify-otp .btn-primary')
  await world.page.waitForURL('**/welcome', { timeout: 30_000 })

  const bodyText = await world.page.locator('body').innerText()

  const didMatch = /did:[a-z0-9:]+/i.exec(bodyText)
  if (!didMatch) {
    throw new Error('Could not find DID on welcome page')
  }
  const did = didMatch[0]

  // Handle is displayed as "@<handle>" somewhere in the body
  const handleMatch = /@([A-Za-z0-9][A-Za-z0-9.-]+)/.exec(bodyText)
  if (!handleMatch) {
    throw new Error('Could not find handle on welcome page')
  }
  const handle = handleMatch[0] // includes the leading @

  world.testEmail = email
  world.userDid = did
  world.userHandle = handle

  await clearMailpit()

  return { did, handle }
}

/**
 * Creates a fresh PDS account for the returning-user scenario.
 *
 * Drives the browser through the full new-user sign-up flow (demo app →
 * email entry → OTP verification → welcome page), then resets the browser
 * context so the scenario starts with a clean session. The generated email
 * is stored on `this.testEmail` and used by subsequent steps instead of
 * the literal email in the Gherkin.
 */
Given('a returning user has a PDS account', async function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'

  // Use a unique email per run so re-runs on live envs never collide
  this.testEmail = `returning-${Date.now()}@example.com`

  await createAccountViaOAuth(this, this.testEmail)

  // Reset browser context to eliminate session cookies/storage from
  // the sign-up flow — the returning-user login must be a fresh OAuth flow
  await this.context.close()
  this.context = await sharedBrowser.newContext()
  this.page = await this.context.newPage()
  this.page.setDefaultNavigationTimeout(30_000)
  this.page.setDefaultTimeout(15_000)
})

/**
 * Creates a PDS account for the named user (the literal Gherkin email is
 * ignored — a unique email is generated and stored on world.testEmail).
 * Returns pending when Mailpit is not configured.
 */
Given(
  '{string} has an existing PDS account',
  async function (this: EpdsWorld, _email: string) {
    if (!testEnv.mailpitPass) return 'pending'

    const email = `user-${Date.now()}@example.com`
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
 * No-op step — each scenario uses unique emails so no account exists yet.
 * Stores a unique email on world.testEmail for use by subsequent steps.
 */
Given(
  'no PDS account exists for {string}',
  function (this: EpdsWorld, _email: string) {
    this.testEmail = `new-${Date.now()}@example.com`
  },
)

/**
 * Creates a PDS account via the full ePDS OAuth flow and stores the
 * resulting DID and handle on the world. Returns pending when Mailpit
 * is not configured.
 */
Given(
  'a user account has been auto-created via the ePDS OAuth flow',
  async function (this: EpdsWorld) {
    if (!testEnv.mailpitPass) return 'pending'

    const email = `auto-${Date.now()}@example.com`
    await createAccountViaOAuth(this, email)
  },
)

/**
 * Creates a PDS account for the named user (the literal Gherkin handle is
 * ignored — the real handle is captured from the welcome page and stored on
 * world.userHandle). Returns pending when Mailpit is not configured.
 */
Given(
  '{string} has a PDS account with handle {string}',
  async function (this: EpdsWorld, _email: string, _handle: string) {
    if (!testEnv.mailpitPass) return 'pending'

    const email = `user-${Date.now()}@example.com`
    await createAccountViaOAuth(this, email)

    // Reset browser context so the scenario starts with a clean session
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)
  },
)
