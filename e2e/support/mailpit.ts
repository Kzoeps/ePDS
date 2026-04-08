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

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'AbortError'
  }
  return err instanceof Error && err.name === 'AbortError'
}

async function searchMessages(
  query: string,
  limit: number,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<MailpitMessage[]> {
  const controller = new AbortController()
  const onAbort = (): void => {
    controller.abort()
  }

  if (opts?.signal?.aborted) {
    controller.abort()
  } else if (opts?.signal) {
    opts.signal.addEventListener('abort', onAbort, { once: true })
  }

  const timeoutId =
    opts?.timeoutMs !== undefined
      ? setTimeout(() => {
          controller.abort()
        }, opts.timeoutMs)
      : undefined

  try {
    const res = await fetch(
      `${testEnv.mailpitUrl}/api/v1/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        headers: { Authorization: mailpitAuthHeader() },
        signal: controller.signal,
      },
    )

    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) {
        throw new Error(
          `Mailpit search failed with client error: ${res.status}`,
        )
      }
      throw new Error(`Mailpit search failed with server error: ${res.status}`)
    }

    const data = (await res.json()) as MailpitSearchResponse
    return data.messages ?? []
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    if (opts?.signal) {
      opts.signal.removeEventListener('abort', onAbort)
    }
  }
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
  timeoutMs = 60_000,
): Promise<MailpitMessage> {
  const interval = 500
  const deadline = Date.now() + timeoutMs

  while (true) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) {
      break
    }

    try {
      const messages = await searchMessages(query, 1, {
        timeoutMs: remainingMs,
      })
      if (messages.length > 0) {
        return messages[0]
      }
    } catch (err) {
      if (
        !isAbortError(err) &&
        err instanceof Error &&
        err.message.includes('client error')
      ) {
        throw err
      }
    }

    const sleepMs = Math.min(interval, Math.max(0, deadline - Date.now()))
    if (sleepMs <= 0) {
      break
    }
    await new Promise<void>((r) => setTimeout(r, sleepMs))
  }

  throw new Error(`No email matching "${query}" arrived within ${timeoutMs}ms`)
}

/**
 * Extract the OTP from the plain-text body of a Mailpit message.
 *
 * Uses heuristic patterns instead of OTP_LENGTH / OTP_CHARSET so it works
 * even when e2e env vars don't match the deployed service config.
 *
 * Slightly flaky by nature — the only robust alternative is keeping OTP_LENGTH
 * and OTP_CHARSET in sync between the deployed service and e2e/.env, which
 * requires manual coordination on every config change.
 *
 * testEnv.otpLength / otpCharset are no longer used here but remain in env.ts
 * for buildIncorrectOtpCode in auth.steps.ts.
 */
export async function extractOtp(messageId: string): Promise<string> {
  const res = await fetch(`${testEnv.mailpitUrl}/view/${messageId}.txt`, {
    headers: { Authorization: mailpitAuthHeader() },
  })
  const body = await res.text()

  // Default templates: raw code on its own line
  const isolatedNumeric = /^(\d{4,12})$/m.exec(body)
  if (isolatedNumeric) return isolatedNumeric[1]

  const isolatedAlphanum = /^([A-Z0-9]{4,12})$/m.exec(body)
  if (isolatedAlphanum) return isolatedAlphanum[1]

  // Client-branded template fallback: "Your code for <AppName> is: <code>"
  const inlineNumeric = /\bis:\s*(\d{4,12})\s*$/m.exec(body)
  if (inlineNumeric) return inlineNumeric[1]

  const inlineAlphanum = /\bis:\s*([A-Z0-9]{4,12})\s*$/m.exec(body)
  if (inlineAlphanum) return inlineAlphanum[1]

  throw new Error(`Could not extract OTP from email body:\n${body}`)
}

/**
 * Delete all Mailpit messages addressed to a specific recipient.
 * Uses the search-based delete endpoint to avoid wiping the entire inbox,
 * which would cause race conditions when scenarios run in parallel workers.
 */
export async function clearMailpit(recipient: string): Promise<void> {
  const res = await fetch(
    `${testEnv.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`,
    { method: 'DELETE', headers: { Authorization: mailpitAuthHeader() } },
  )
  if (!res.ok) {
    throw new Error(`Mailpit DELETE /api/v1/search failed: ${res.status}`)
  }
}
