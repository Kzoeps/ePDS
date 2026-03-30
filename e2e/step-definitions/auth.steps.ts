import { Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { testEnv } from '../support/env.js'
import type { EpdsWorld } from '../support/world.js'

function getPage(world: EpdsWorld) {
  const page = world.page
  if (!page) throw new Error('page is not initialised')
  return page
}

When(
  'the demo client initiates an OAuth login',
  async function (this: EpdsWorld) {
    await this.page?.goto(testEnv.demoUrl)
  },
)

Then(
  'the browser is redirected to the auth service login page',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await expect(page.locator('#email')).toBeVisible({ timeout: 10_000 })
  },
)

Then(
  'the login page displays an email input form',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await expect(page.locator('#email')).toBeVisible()
  },
)

When(
  'the user enters {string} and submits',
  async function (this: EpdsWorld, email: string) {
    await this.page?.fill('#email', email)
    await this.page?.click('button[type=submit]')
    await this.page?.waitForLoadState('networkidle')
  },
)

When(
  'the user enters a unique test email and submits',
  async function (this: EpdsWorld) {
    this.testEmail = `test-${Date.now()}@example.com`
    await this.page?.fill('#email', this.testEmail)
    await this.page?.click('button[type=submit]')
    await this.page?.waitForLoadState('networkidle')
  },
)

When('the user approves the consent screen', async function (this: EpdsWorld) {
  const page = getPage(this)
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Approve' }).click()
})

When(
  'the user enters the test email on the login page',
  async function (this: EpdsWorld) {
    if (!this.testEmail) {
      throw new Error(
        'No test email set — "a returning user has a PDS account" step must run first',
      )
    }
    await this.page?.fill('#email', this.testEmail)
    await this.page?.click('button[type=submit]')
    await this.page?.waitForLoadState('networkidle')
  },
)

Then(
  'the login page shows an OTP verification form',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await expect(page.locator('#step-otp.active')).toBeVisible({
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
    await this.page?.fill('#code', this.otpCode)
    await this.page?.click('#form-verify-otp .btn-primary')
  },
)

When('the user enters the OTP code', async function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'
  if (!this.otpCode)
    throw new Error('No OTP code available — email step must run first')
  await this.page?.fill('#code', this.otpCode)
  await this.page?.click('#form-verify-otp .btn-primary')
})

Then(
  'the browser is redirected back to the demo client',
  async function (this: EpdsWorld) {
    await this.page?.waitForURL('**/welcome', { timeout: 30_000 })
  },
)

Then(
  'the browser is redirected back to the demo client with a valid session',
  async function (this: EpdsWorld) {
    await this.page?.waitForURL('**/welcome', { timeout: 30_000 })
  },
)

Then(
  'the demo client has a valid OAuth access token',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await expect(page.locator('body')).toContainText('did:')
  },
)

// --- OTP verification scenarios ---

When(
  'the user requests an OTP for {string}',
  async function (this: EpdsWorld, email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    const page = getPage(this)
    await page.goto(testEnv.demoUrl)
    await page.fill('#email', email)
    await page.click('button[type=submit]')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })
  },
)

When(
  'the user requests an OTP for a unique test email',
  async function (this: EpdsWorld) {
    if (!testEnv.mailpitPass) return 'pending'
    const page = getPage(this)
    this.testEmail = `test-${Date.now()}@example.com`
    await page.goto(testEnv.demoUrl)
    await page.fill('#email', this.testEmail)
    await page.click('button[type=submit]')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#step-otp.active')).toBeVisible({
      timeout: 30_000,
    })
  },
)

When('enters an incorrect OTP code', async function (this: EpdsWorld) {
  await this.page?.fill('#code', '00000000')
  await this.page?.click('#form-verify-otp .btn-primary')
})

When(
  'enters an incorrect OTP code {int} times',
  async function (this: EpdsWorld, times: number) {
    for (let i = 0; i < times; i++) {
      await this.page?.fill('#code', '00000000')
      await this.page?.click('#form-verify-otp .btn-primary')
      await this.page?.waitForTimeout(500)
    }
  },
)

Then(
  'the verification form shows an error message',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await expect(page.locator('#error-msg')).toBeVisible()
  },
)

Then('the user can try again', async function (this: EpdsWorld) {
  const page = getPage(this)
  await expect(page.locator('#code')).toBeEnabled()
})

Then('further attempts are rejected', async function (this: EpdsWorld) {
  const page = getPage(this)
  await expect(page.locator('#error-msg')).toBeVisible()
})

Then('the user must request a new OTP', async function (this: EpdsWorld) {
  const page = getPage(this)
  await expect(page.locator('#btn-resend')).toBeVisible()
})

// --- Refresh scenario ---

When(
  'the demo client redirects to the auth service login page',
  async function (this: EpdsWorld) {
    await this.page?.goto(testEnv.demoUrl)
  },
)

When(
  'the user refreshes the page \\(duplicate GET \\/oauth\\/authorize\\)',
  async function (this: EpdsWorld) {
    await this.page?.reload()
  },
)

Then('the login page renders normally', async function (this: EpdsWorld) {
  const page = getPage(this)
  await expect(page.locator('#email')).toBeVisible()
})

Then('the OTP flow still works to completion', function (this: EpdsWorld) {
  return this.skipIfNoMailpit()
})
