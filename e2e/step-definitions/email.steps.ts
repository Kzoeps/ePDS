import { Given, When, Then } from '@cucumber/cucumber'
import type { EpdsWorld } from '../support/world.js'
import { testEnv } from '../support/env.js'
import { waitForEmail, extractOtp, getMessageBody } from '../support/mailpit.js'

Then(
  'an OTP email arrives in the mail trap for the test email',
  async function (this: EpdsWorld) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.testEmail) {
      throw new Error(
        'No test email set — "unique test email" step must run first',
      )
    }
    const message = await waitForEmail(`to:${this.testEmail}`)
    this.lastEmailSubject = message.Subject
    this.otpCode = extractOtp(message.Subject)
  },
)

Then(
  'an OTP email arrives in the mail trap for {string}',
  async function (this: EpdsWorld, email: string) {
    if (!testEnv.mailpitPass) return 'pending'
    const message = await waitForEmail(`to:${email}`)
    this.lastEmailSubject = message.Subject
    this.otpCode = extractOtp(message.Subject)
  },
)

Then('an OTP email arrives in the mail trap', async function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'
  if (!this.testEmail) {
    throw new Error(
      'No test email set — "a returning user has a PDS account" step must run first',
    )
  }
  const message = await waitForEmail(`to:${this.testEmail}`)
  this.lastEmailSubject = message.Subject
  this.otpCode = extractOtp(message.Subject)
})

Then(
  'the email subject contains {string} \\(new user\\)',
  function (this: EpdsWorld, expected: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.lastEmailSubject) {
      throw new Error(
        'No email subject available — email arrival step must run first',
      )
    }
    if (!this.lastEmailSubject.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(
        `Expected subject to contain "${expected}" but got: "${this.lastEmailSubject}"`,
      )
    }
  },
)

Then(
  'the email subject contains {string} \\(returning user\\)',
  function (this: EpdsWorld, expected: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.lastEmailSubject) {
      throw new Error(
        'No email subject available — email arrival step must run first',
      )
    }
    if (!this.lastEmailSubject.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(
        `Expected subject to contain "${expected}" but got: "${this.lastEmailSubject}"`,
      )
    }
  },
)

// ---------------------------------------------------------------------------
// email-delivery.feature steps
// ---------------------------------------------------------------------------

/**
 * Background step — gates all scenarios in email-delivery.feature.
 * Returns pending when Mailpit is not configured.
 */
Given('a mail trap is capturing outbound emails', function (this: EpdsWorld) {
  return this.skipIfNoMailpit()
})

/**
 * Poll Mailpit for an email addressed to the given address.
 * Stores subject, body, and OTP code on the world.
 * Uses this.testEmail when the Gherkin address is a placeholder.
 */
Then(
  'an email arrives in the mail trap addressed to {string}',
  async function (this: EpdsWorld, address: string) {
    if (!testEnv.mailpitPass) return 'pending'
    const email = this.testEmail ?? address
    const message = await waitForEmail(`to:${email}`)
    this.lastEmailSubject = message.Subject
    this.lastEmailBody = await getMessageBody(message.ID)
    this.otpCode = extractOtp(message.Subject)
  },
)

/**
 * Plain subject assertion — no parenthetical suffix.
 * Case-insensitive contains check.
 */
Then(
  'the email subject contains {string}',
  function (this: EpdsWorld, expected: string) {
    if (!testEnv.mailpitPass) return 'pending'
    if (!this.lastEmailSubject) {
      throw new Error(
        'No email subject available — email arrival step must run first',
      )
    }
    if (!this.lastEmailSubject.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(
        `Expected subject to contain "${expected}" but got: "${this.lastEmailSubject}"`,
      )
    }
  },
)

/**
 * Assert the email body contains a numeric OTP code (4–12 digits).
 */
Then('the email body contains a numeric OTP code', function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'
  if (!this.lastEmailBody) {
    throw new Error(
      'No email body available — email arrival step must run first',
    )
  }
  if (!/\d{4,12}/.test(this.lastEmailBody)) {
    throw new Error(
      `Expected email body to contain a numeric OTP code but got: "${this.lastEmailBody}"`,
    )
  }
})

/**
 * Poll Mailpit for a verification email addressed to the given address.
 * Stores subject and body on the world.
 * Uses this.testEmail when the Gherkin address is a placeholder.
 */
Then(
  'a verification email arrives in the mail trap for {string}',
  async function (this: EpdsWorld, address: string) {
    if (!testEnv.mailpitPass) return 'pending'
    const email = this.testEmail ?? address
    const message = await waitForEmail(`to:${email}`)
    this.lastEmailSubject = message.Subject
    this.lastEmailBody = await getMessageBody(message.ID)
  },
)

/**
 * Assert the email body contains a backup email verification link.
 */
Then('the email contains a verification link', function (this: EpdsWorld) {
  if (!testEnv.mailpitPass) return 'pending'
  if (!this.lastEmailBody) {
    throw new Error(
      'No email body available — email arrival step must run first',
    )
  }
  if (!this.lastEmailBody.includes('/account/backup-email/verify')) {
    throw new Error(
      `Expected email body to contain a verification link (/account/backup-email/verify) but got: "${this.lastEmailBody}"`,
    )
  }
})

/**
 * Fill the backup email input and submit the backup email form.
 */
When(
  'the user adds {string} as a backup email',
  async function (this: EpdsWorld, backupEmail: string) {
    // Fill the backup email input in the backup email section
    await this.page.fill('[name=email]', backupEmail)
    // Click the "Add backup email" button
    await this.page.getByRole('button', { name: /add backup email/i }).click()
    await this.page.waitForLoadState('networkidle')
  },
)
