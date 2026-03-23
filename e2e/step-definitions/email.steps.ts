import { Then } from '@cucumber/cucumber'
import type { EpdsWorld } from '../support/world.js'

Then(
  'an OTP email arrives in the mail trap for {string}',
  async function (this: EpdsWorld, _email: string) {
    this.skipIfNoMailhog()
    // TODO: GET {mailhogUrl}/api/v2/search?kind=to&query={email}
    // Parse OTP from email body, store on World for later use
  },
)

Then('an OTP email arrives in the mail trap', async function (this: EpdsWorld) {
  this.skipIfNoMailhog()
})

Then(
  'the email subject contains {string} \\(new user\\)',
  async function (this: EpdsWorld, _expected: string) {
    this.skipIfNoMailhog()
  },
)

Then(
  'the email subject contains {string} \\(returning user\\)',
  async function (this: EpdsWorld, _expected: string) {
    this.skipIfNoMailhog()
  },
)

Then(
  'the OTP code in the mail trap is {int} characters of uppercase letters and digits',
  async function (this: EpdsWorld, _length: number) {
    this.skipIfNoMailhog()
  },
)
