export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (local.length <= 2) return local[0] + '***@' + domain
  return local[0] + '***' + local[local.length - 1] + '@' + domain
}

/**
 * Returns the group size to use for OTP display, or null if no grouping applies.
 * Only groups codes of length 6 or more.
 * Tries groups of 4 first, then groups of 3.
 */
function otpGroupSize(length: number): number | null {
  if (length < 6) return null
  if (length % 4 === 0) return 4
  if (length % 3 === 0) return 3
  return null
}

function chunkString(s: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < s.length; i += size) chunks.push(s.slice(i, i + size))
  return chunks
}

/**
 * Format an OTP code for plain-text display (subject lines, plain-text email bodies).
 * Groups codes of length >= 6 with spaces where possible (groups of 4, then 3).
 * Lengths that don't divide evenly, or are under 6, are returned as-is.
 *
 * Examples: 6 → "123 456", 8 → "1234 5678", 9 → "123 456 789", 12 → "1234 5678 9012"
 */
export function formatOtpPlain(code: string): string {
  const groupSize = otpGroupSize(code.length)
  if (!groupSize) return code
  return chunkString(code, groupSize).join(' ')
}

/**
 * Format an OTP code for display inside an HTML email.
 * Groups codes of length >= 6 using <span> elements with a CSS gap between
 * them — no separator character exists in the DOM so copy-paste yields the
 * flat code. Lengths that don't divide evenly, or are under 6, are returned
 * as HTML-escaped flat strings.
 *
 * Examples: 6 → two spans "123"+"456", 8 → two spans "1234"+"5678", 9 → three spans "123"+"456"+"789"
 */
export function formatOtpHtmlGrouped(code: string): string {
  const groupSize = otpGroupSize(code.length)
  if (!groupSize) return escapeHtml(code)
  return chunkString(code, groupSize)
    .map((chunk, i) =>
      i === 0
        ? `<span>${escapeHtml(chunk)}</span>`
        : `<span style="padding-left:0.35em">${escapeHtml(chunk)}</span>`,
    )
    .join('')
}
