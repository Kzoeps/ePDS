/**
 * Tests for getClientCss — CSS extraction, trust gating, size cap, and escaping.
 */
import { describe, it, expect } from 'vitest'
import { getClientCss } from '../client-metadata.js'

const TRUSTED = ['https://trusted.app/client-metadata.json']
const CLIENT_ID = 'https://trusted.app/client-metadata.json'

describe('getClientCss', () => {
  it('returns null for untrusted clients', () => {
    const result = getClientCss(
      'https://untrusted.app/client-metadata.json',
      { branding: { css: 'body { color: red; }' } },
      TRUSTED,
    )
    expect(result).toBeNull()
  })

  it('returns null when branding.css is absent', () => {
    expect(getClientCss(CLIENT_ID, {}, TRUSTED)).toBeNull()
    expect(getClientCss(CLIENT_ID, { branding: {} }, TRUSTED)).toBeNull()
  })

  it('returns escaped CSS for trusted client within size limit', () => {
    const result = getClientCss(
      CLIENT_ID,
      { branding: { css: 'body { color: red; }' } },
      TRUSTED,
    )
    expect(result).toBe('body { color: red; }')
  })

  it('escapes </style> sequences to prevent tag closure', () => {
    const result = getClientCss(
      CLIENT_ID,
      {
        branding: { css: 'body { content: "</style><script>bad</script>"; }' },
      },
      TRUSTED,
    )
    expect(result).not.toContain('</style>')
    expect(result).toContain('\\u003c/style>')
  })

  it('returns null when CSS exceeds 8 KB', () => {
    const oversized = 'a'.repeat(8_193)
    const result = getClientCss(
      CLIENT_ID,
      { branding: { css: oversized } },
      TRUSTED,
    )
    expect(result).toBeNull()
  })

  it('returns CSS exactly at the 8 KB limit', () => {
    const atLimit = 'a'.repeat(8_192)
    const result = getClientCss(
      CLIENT_ID,
      { branding: { css: atLimit } },
      TRUSTED,
    )
    expect(result).toBe(atLimit)
  })
})
