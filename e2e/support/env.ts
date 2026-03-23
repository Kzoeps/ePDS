import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve('e2e/.env') })

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `E2E configuration error: ${name} is not set.\n` +
        `Copy e2e/.env.example to e2e/.env and fill in the required values.`,
    )
  }
  return value
}

export const testEnv = {
  pdsUrl: required('E2E_PDS_URL'),
  authUrl: required('E2E_AUTH_URL'),
  demoUrl: required('E2E_DEMO_URL'),
  mailhogUrl: process.env.E2E_MAILHOG_URL ?? '',
  headless: process.env.E2E_HEADLESS === 'true',
}
