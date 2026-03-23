import { Given } from '@cucumber/cucumber'
import type { EpdsWorld } from '../support/world.js'
import { testEnv } from '../support/env.js'

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

Given(
  '{string} already has a PDS account',
  async function (this: EpdsWorld, _email: string) {
    return this.skipIfNoMailhog()
  },
)
