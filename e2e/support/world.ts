import { World, setWorldConstructor } from '@cucumber/cucumber'
import type { Browser, BrowserContext, Page } from '@playwright/test'
import { testEnv } from './env.js'

export class EpdsWorld extends World {
  declare browser: Browser
  declare context: BrowserContext
  declare page: Page

  /** OTP code extracted from the most recent email — set by email steps, read by auth steps. */
  otpCode?: string

  /** Subject line of the most recent email — set by email steps. */
  lastEmailSubject?: string

  /** Generated unique email for the current scenario — set by "unique test email" steps. */
  testEmail?: string

  /** DID captured from the demo welcome page after successful login */
  userDid?: string

  /** Handle captured from the demo welcome page after successful login */
  userHandle?: string

  /** Body text of the most recent Mailpit email */
  lastEmailBody?: string

  /** Last raw HTTP API response — set by api.steps.ts fetch steps. */
  lastApiResponse?: { json: unknown; headers: Headers; status: number }

  /** Session count before a revoke action — used by session revoke steps. */
  lastSessionCount?: number

  get env() {
    return testEnv
  }

  /**
   * Call in any step that requires Mailpit. If E2E_MAILPIT_PASS is not set,
   * marks the step as pending and cucumber-js skips remaining steps in the scenario.
   * When Mailpit is available, this is a no-op and the step executes normally.
   */
  skipIfNoMailpit(): 'pending' | undefined {
    if (!testEnv.mailpitPass) {
      return 'pending'
    }
  }
}

setWorldConstructor(EpdsWorld)
