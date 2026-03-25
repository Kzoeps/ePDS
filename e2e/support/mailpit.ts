/**
 * Shared Mailpit API helpers used by both step definitions and scenario setup flows.
 *
 * All functions require Mailpit credentials to be configured in testEnv.
 * Callers are responsible for checking testEnv.mailpitPass before invoking these.
 */

import { testEnv } from './env.js'

export interface MailpitMessage {
  ID: string
  Subject: string
}

interface MailpitSearchResponse {
  messages?: MailpitMessage[]
}

export function mailpitAuthHeader(): string {
  return `Basic ${Buffer.from(`${testEnv.mailpitUser}:${testEnv.mailpitPass}`).toString('base64')}`
}

/**
 * Poll Mailpit search until a message matching the query arrives, or timeout.
 * Returns the first matching message.
 */
export async function waitForEmail(
  query: string,
  timeoutMs = 15_000,
): Promise<MailpitMessage> {
  const interval = 500
  const attempts = Math.ceil(timeoutMs / interval)
  const headers = { Authorization: mailpitAuthHeader() }

  for (let i = 0; i < attempts; i++) {
    const res = await fetch(
      `${testEnv.mailpitUrl}/api/v1/search?query=${encodeURIComponent(query)}&limit=1`,
      { headers },
    )
    const data = (await res.json()) as MailpitSearchResponse
    if (data.messages?.length) {
      return data.messages[0]
    }
    await new Promise<void>((r) => setTimeout(r, interval))
  }

  throw new Error(`No email matching "${query}" arrived within ${timeoutMs}ms`)
}

/**
 * Extract the OTP code from an email subject line.
 *
 * Both subject templates start with the formatted OTP (via formatOtpPlain),
 * followed by a known delimiter:
 *   "1234 5678 is your sign-in code for <pdsName>"
 *   "1234 5678 — Welcome to <pdsName>"
 *
 * Strips the spaces inserted by formatOtpPlain to return the raw code,
 * e.g. "12345678" for an 8-digit numeric OTP.
 */
export function extractOtp(subject: string): string {
  // Match everything before " is your" or " —" — that prefix is the formatted OTP
  const match = /^([A-Z0-9 ]+?)(?:\s+(?:is your|—))/i.exec(subject)
  if (!match) {
    throw new Error(`Could not extract OTP from subject: "${subject}"`)
  }
  return match[1].replace(/\s+/g, '')
}

/**
 * Delete all messages in Mailpit. Used to clear the inbox between
 * setup steps and the actual scenario to prevent cross-contamination.
 */
export async function clearMailpit(): Promise<void> {
  const res = await fetch(`${testEnv.mailpitUrl}/api/v1/messages`, {
    method: 'DELETE',
    headers: { Authorization: mailpitAuthHeader() },
  })
  if (!res.ok) {
    throw new Error(`Mailpit DELETE /api/v1/messages failed: ${res.status}`)
  }
}
