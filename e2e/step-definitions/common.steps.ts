import { Given } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import type { EpdsWorld } from '../support/world.js'
import { sharedBrowser } from '../support/hooks.js'
import { testEnv } from '../support/env.js'
import { waitForEmail, extractOtp, clearMailpit } from '../support/mailpit.js'

Given('the ePDS test environment is running', async function (this: EpdsWorld) {
  const res = await fetch(`${testEnv.pdsUrl}/xrpc/_health`)
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

  // --- Sign up as a new user ---
  await this.page.goto(testEnv.demoUrl)
  await this.page.fill('#email', this.testEmail)
  await this.page.click('button[type=submit]')
  await this.page.waitForLoadState('networkidle')
  await expect(this.page.locator('#step-otp.active')).toBeVisible({
    timeout: 30_000,
  })

  // Fetch the sign-up OTP and complete verification
  const signUpMessage = await waitForEmail(`to:${this.testEmail}`)
  const signUpOtp = extractOtp(signUpMessage.Subject)
  await this.page.fill('#code', signUpOtp)
  await this.page.click('#form-verify-otp .btn-primary')
  await this.page.waitForURL('**/welcome', { timeout: 30_000 })

  // Clear the inbox so the sign-up OTP email doesn't match when the
  // scenario later polls for the sign-in OTP
  await clearMailpit()

  // Reset browser context to eliminate session cookies/storage from
  // the sign-up flow — the returning-user login must be a fresh OAuth flow
  await this.context.close()
  this.context = await sharedBrowser.newContext()
  this.page = await this.context.newPage()
  this.page.setDefaultNavigationTimeout(30_000)
  this.page.setDefaultTimeout(15_000)
})
