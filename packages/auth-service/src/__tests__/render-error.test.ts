/**
 * Tests for shared HTML error page renderers.
 *
 * renderError and renderNoAccountPage are pure functions with no external
 * dependencies, making them straightforward to test in isolation.
 */
import { describe, it, expect } from 'vitest'
import { renderError, renderNoAccountPage } from '../lib/render-error.js'

describe('renderError', () => {
  it('returns a valid HTML document', () => {
    const html = renderError('Something went wrong')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes the message in the output', () => {
    const html = renderError(
      'Service temporarily unavailable. Please try again.',
    )
    expect(html).toContain('Service temporarily unavailable. Please try again.')
  })

  it('escapes HTML special characters in the message', () => {
    const html = renderError('<script>alert("xss")</script>')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes ampersands in the message', () => {
    const html = renderError('Foo & Bar')
    expect(html).not.toContain('Foo & Bar')
    expect(html).toContain('Foo &amp; Bar')
  })

  it('escapes double quotes in the message', () => {
    const html = renderError('Error: "bad input"')
    expect(html).toContain('&quot;bad input&quot;')
  })
})

describe('renderNoAccountPage', () => {
  it('returns a valid HTML document', () => {
    const html = renderNoAccountPage()
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes the "No account found" heading', () => {
    const html = renderNoAccountPage()
    expect(html).toContain('No account found')
  })

  it('includes a link back to the login page', () => {
    const html = renderNoAccountPage()
    expect(html).toContain('href="/account/login"')
  })

  it('includes guidance to sign in via an app first', () => {
    const html = renderNoAccountPage()
    expect(html).toContain('sign in to an app')
  })
})
