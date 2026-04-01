/**
 * Step definitions for account-settings.feature authentication scenarios.
 */

import { Then, When } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { testEnv } from '../support/env.js'
import type { EpdsWorld } from '../support/world.js'
import { getPage } from '../support/utils.js'

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

When(
  'a user navigates to /account without a session',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await page.goto(`${testEnv.authUrl}/account`)
  },
)

Then(
  'the browser is redirected to /account/login',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    const authBase = escapeForRegex(testEnv.authUrl)
    await expect(page).toHaveURL(
      new RegExp(`^${authBase}/account/login(\\?.*)?$`),
    )
  },
)

When('the user navigates to /account/login', async function (this: EpdsWorld) {
  const page = getPage(this)
  await page.goto(`${testEnv.authUrl}/account/login`)
})

Then(
  'a login form is displayed (separate from the OAuth flow)',
  async function (this: EpdsWorld) {
    const page = getPage(this)
    await expect(
      page.getByRole('heading', { name: 'Account Settings' }),
    ).toBeVisible()
    await expect(
      page.getByText('Sign in to manage your account', { exact: true }),
    ).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Continue with email' }),
    ).toBeVisible()
  },
)
