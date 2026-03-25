/**
 * api.steps.ts — Pure HTTP step definitions (no browser required).
 *
 * Covers:
 *   - oauth-metadata-override.feature (Scenarios 1 & 2)
 *   - pds-behavior-at-risk.feature (describeServer + createSession scenarios)
 *
 * Scenario 3 of oauth-metadata-override (full PAR client flow) is tagged
 * @pending in the feature file and the matching steps here return "pending".
 */

import { When, Then, Given } from '@cucumber/cucumber'
import type { EpdsWorld } from '../support/world.js'
import { testEnv } from '../support/env.js'

// ---------------------------------------------------------------------------
// oauth-metadata-override.feature — Scenario 1
// "Authorization endpoint points to external auth service"
// ---------------------------------------------------------------------------

When(
  /^GET \/\.well-known\/oauth-authorization-server is fetched from the PDS$/,
  async function (this: EpdsWorld) {
    const res = await fetch(
      `${testEnv.pdsUrl}/.well-known/oauth-authorization-server`,
    )
    const json: unknown = await res.json()
    this.lastApiResponse = { json, headers: res.headers, status: res.status }
  },
)

Then(
  'the response JSON includes authorization_endpoint pointing to the auth service',
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const { json } = this.lastApiResponse
    if (
      typeof json !== 'object' ||
      json === null ||
      !('authorization_endpoint' in json)
    ) {
      throw new Error(
        'Response JSON does not contain authorization_endpoint field',
      )
    }
    const endpoint = (json as Record<string, unknown>)['authorization_endpoint']
    if (typeof endpoint !== 'string' || !endpoint.startsWith(testEnv.authUrl)) {
      throw new Error(
        `Expected authorization_endpoint to start with "${testEnv.authUrl}" but got: "${String(endpoint)}"`,
      )
    }
  },
)

Then(
  /^all other standard OAuth metadata fields are present \(issuer, token_endpoint, etc\.\)$/,
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const json = this.lastApiResponse.json as Record<string, unknown>
    const requiredFields = [
      'issuer',
      'token_endpoint',
      'pushed_authorization_request_endpoint',
    ]
    for (const field of requiredFields) {
      const value = json[field]
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
          `Expected "${field}" to be a non-empty string but got: ${JSON.stringify(value)}`,
        )
      }
    }
  },
)

Then(
  'the response has Cache-Control: public, max-age=300',
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const cacheControl = this.lastApiResponse.headers.get('cache-control') ?? ''
    if (!cacheControl.includes('max-age=300')) {
      throw new Error(
        `Expected Cache-Control to contain "max-age=300" but got: "${cacheControl}"`,
      )
    }
  },
)

// ---------------------------------------------------------------------------
// oauth-metadata-override.feature — Scenario 2
// "Standard OAuth fields are preserved"
// ---------------------------------------------------------------------------

When(
  /^GET \/\.well-known\/oauth-authorization-server is fetched$/,
  async function (this: EpdsWorld) {
    const res = await fetch(
      `${testEnv.pdsUrl}/.well-known/oauth-authorization-server`,
    )
    const json: unknown = await res.json()
    this.lastApiResponse = { json, headers: res.headers, status: res.status }
  },
)

Then(
  /^the response includes token_endpoint pointing to the PDS's \/oauth\/token$/,
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const json = this.lastApiResponse.json as Record<string, unknown>
    const endpoint = json['token_endpoint']
    if (typeof endpoint !== 'string' || !endpoint.includes('/oauth/token')) {
      throw new Error(
        `Expected token_endpoint to contain "/oauth/token" but got: "${String(endpoint)}"`,
      )
    }
  },
)

Then(
  /^the response includes pushed_authorization_request_endpoint pointing to \/oauth\/par$/,
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const json = this.lastApiResponse.json as Record<string, unknown>
    const endpoint = json['pushed_authorization_request_endpoint']
    if (typeof endpoint !== 'string' || !endpoint.includes('/oauth/par')) {
      throw new Error(
        `Expected pushed_authorization_request_endpoint to contain "/oauth/par" but got: "${String(endpoint)}"`,
      )
    }
  },
)

Then(
  'response_types_supported, grant_types_supported, and dpop_signing_alg_values_supported are present',
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const json = this.lastApiResponse.json as Record<string, unknown>
    const arrayFields = [
      'response_types_supported',
      'grant_types_supported',
      'dpop_signing_alg_values_supported',
    ]
    for (const field of arrayFields) {
      const value = json[field]
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(
          `Expected "${field}" to be a non-empty array but got: ${JSON.stringify(value)}`,
        )
      }
    }
  },
)

// ---------------------------------------------------------------------------
// oauth-metadata-override.feature — Scenario 3 (pending — needs PAR client)
// ---------------------------------------------------------------------------

Given('a standard AT Protocol OAuth client', function (this: EpdsWorld) {
  return 'pending'
})

When(
  /^the client discovers the authorization server via \/\.well-known\/oauth-authorization-server$/,
  function (this: EpdsWorld) {
    return 'pending'
  },
)

When('the client initiates a PAR request', function (this: EpdsWorld) {
  return 'pending'
})

When(
  'the client redirects the user to the authorization_endpoint',
  function (this: EpdsWorld) {
    return 'pending'
  },
)

Then(
  /^the user arrives at the ePDS auth service \(not the stock PDS login\)$/,
  function (this: EpdsWorld) {
    return 'pending'
  },
)

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — "describeServer returns valid PDS metadata"
// ---------------------------------------------------------------------------

When(
  /^a client calls GET \/xrpc\/com\.atproto\.server\.describeServer$/,
  async function (this: EpdsWorld) {
    const res = await fetch(
      `${testEnv.pdsUrl}/xrpc/com.atproto.server.describeServer`,
    )
    const json: unknown = await res.json()
    this.lastApiResponse = { json, headers: res.headers, status: res.status }
  },
)

Then(
  'the response includes availableUserDomains and links',
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const json = this.lastApiResponse.json as Record<string, unknown>
    if (!Array.isArray(json['availableUserDomains'])) {
      throw new Error(
        `Expected availableUserDomains to be an array but got: ${JSON.stringify(json['availableUserDomains'])}`,
      )
    }
    if (typeof json['links'] !== 'object' || json['links'] === null) {
      throw new Error(
        `Expected links to be an object but got: ${JSON.stringify(json['links'])}`,
      )
    }
  },
)

// ---------------------------------------------------------------------------
// pds-behavior-at-risk.feature — "Password-based createSession is not possible"
// ---------------------------------------------------------------------------

When(
  'someone calls com.atproto.server.createSession with a guessed password',
  async function (this: EpdsWorld) {
    const res = await fetch(
      `${testEnv.pdsUrl}/xrpc/com.atproto.server.createSession`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: this.testEmail ?? 'test@example.com',
          password: 'wrongpassword123',
        }),
      },
    )
    const json: unknown = await res.json()
    this.lastApiResponse = { json, headers: res.headers, status: res.status }
  },
)

Then(
  'the request fails with an authentication error',
  function (this: EpdsWorld) {
    if (!this.lastApiResponse) {
      throw new Error('No API response stored — fetch step must run first')
    }
    const { status, json } = this.lastApiResponse
    if (status !== 401 && status !== 400) {
      throw new Error(`Expected status 401 or 400 but got: ${status}`)
    }
    const body = json as Record<string, unknown>
    if (!('error' in body)) {
      throw new Error(
        `Expected response JSON to contain "error" field but got: ${JSON.stringify(json)}`,
      )
    }
  },
)
