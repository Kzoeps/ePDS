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
 *   7. Capture DID from page body text
 *   8. Store testEmail and userDid on the world
 *   9. Clear Mailpit inbox
 *
 * Callers must check testEnv.mailpitPass before calling this function.
 */
export async function createAccountViaOAuth(
  world: EpdsWorld,
  email: string,
): Promise<{ did: string }> {
  await world.page.goto(testEnv.demoUrl)
  await world.page.fill('#email', email)
  await world.page.click('button[type=submit]')
  await expect(world.page.locator('#step-otp.active')).toBeVisible({
    timeout: 30_000,
  })

  const message = await waitForEmail(`to:${email}`)
  const otp = await extractOtp(message.ID)
  await world.page.fill('#code', otp)
  await world.page.click('#form-verify-otp .btn-primary')
  await world.page.waitForURL('**/welcome', { timeout: 30_000 })

  const bodyText = await world.page.locator('body').innerText()
  const didMatch = /did:[a-z0-9:]+/i.exec(bodyText)
  if (!didMatch) {
    throw new Error('Could not find DID on welcome page')
  }

  world.testEmail = email
  world.userDid = didMatch[0]

  await clearMailpit()

  return { did: didMatch[0] }
}

/**
 * Creates a fresh PDS account for the returning-user scenario.
 *
 * Drives the browser through the full new-user sign-up flow, then resets
 * the browser context so the returning-user login starts with a clean
 * session (no cookies from the sign-up). The generated email is stored on
 * world.testEmail for use by subsequent steps.
 *
 * Note: the first login to the demo client always shows the consent screen
 * for a returning user (account exists but no client_logins record yet).
 * The scenario is expected to handle that with "the user approves the consent screen".
 */
Given('a returning user has a PDS account', async function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'

  // Use a unique email per run so re-runs on live envs never collide
  const email = `returning-${Date.now()}@example.com`
  await createAccountViaOAuth(this, email)

  // Reset browser context to eliminate session cookies from the sign-up
  // flow — the returning-user login must start as a fresh OAuth session
  await this.context.close()
  this.context = await sharedBrowser.newContext()
  this.page = await this.context.newPage()
  this.page.setDefaultNavigationTimeout(30_000)
  this.page.setDefaultTimeout(15_000)
})

/**
 * Creates a PDS account AND completes a first login (including approving the
 * consent screen), so that the demo client is already recorded in client_logins.
 * Resets the browser context afterwards so the actual test login starts fresh.
 *
 * After this step, the next login for world.testEmail will skip consent entirely
 * and land directly on /welcome.
 */
Given(
  'a returning user has already approved the demo client',
  async function (this: EpdsWorld) {
    if (!testEnv.mailpitPass) return 'pending'

    const email = `approved-${Date.now()}@example.com`

    // Step 1: Create the account via the new-user sign-up flow
    await createAccountViaOAuth(this, email)

    // Reset context between sign-up and first returning login
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)

    // Step 2: First returning-user login — consent screen will appear, approve it
    await this.page.goto(testEnv.demoUrl)
    await this.page.fill('#email', email)
    await this.page.click('button[type=submit]')
    await expect(this.page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })

    const message = await waitForEmail(`to:${email}`)
    const otp = await extractOtp(message.ID)
    await this.page.fill('#code', otp)
    await this.page.click('#form-verify-otp .btn-primary')

    // Approve consent — this records the client_logins entry
    await expect(this.page.locator('.btn-approve')).toBeVisible({
      timeout: 30_000,
    })
    await this.page.click('.btn-approve')
    await this.page.waitForURL('**/welcome', { timeout: 30_000 })

    await clearMailpit()

    // Reset context again so the actual test scenario starts with a clean session
    await this.context.close()
    this.context = await sharedBrowser.newContext()
    this.page = await this.context.newPage()
    this.page.setDefaultNavigationTimeout(30_000)
    this.page.setDefaultTimeout(15_000)
  },
)
