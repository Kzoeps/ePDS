/**
 * Dynamic OAuth client metadata endpoint.
 *
 * Served at /client-metadata.json so the client_id URL is self-referencing.
 * Adapts to PUBLIC_URL so it works in any deployment environment.
 */

import { NextResponse } from 'next/server'
import { getBaseUrl } from '@/lib/auth'

export const runtime = 'nodejs'

export function GET() {
  const baseUrl = getBaseUrl()

  const metadata = {
    client_id: `${baseUrl}/client-metadata.json`,
    client_name: 'ePDS Demo',
    client_uri: baseUrl,
    logo_uri: `${baseUrl}/certified-logo.png`,
    redirect_uris: [`${baseUrl}/api/oauth/callback`],
    scope: 'atproto transition:generic',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    dpop_bound_access_tokens: true,
    brand_color: '#2563eb',
    background_color: '#f8f9fa',
    branding: {
      css: [
        'body { background: #0f172a; color: #e2e8f0; }',
        'h1 { color: #f1f5f9; }',
        '.subtitle { color: #94a3b8; }',
        '.field label { color: #cbd5e1; }',
        '.field input { background: #1e293b; border-color: #334155; color: #f1f5f9; }',
        '.field input:focus { border-color: #7c3aed; }',
        '.otp-input:focus { border-color: #7c3aed !important; }',
        '.btn-primary { background: linear-gradient(135deg, #2563eb, #7c3aed); }',
        '.btn-primary:hover { opacity: 0.95; }',
        '.btn-secondary { color: #94a3b8; }',
        '.btn-social { background: #1e293b; border-color: #334155; color: #e2e8f0; }',
        '.btn-social:hover { background: #334155; }',
        '.divider { color: #64748b; }',
        '.divider::before, .divider::after { background: #334155; }',
        '.error { background: #450a0a; color: #fca5a5; }',
        '.recovery-link { color: #64748b; }',
        '.recovery-link:hover { color: #94a3b8; }',
      ].join(' '),
    },
  }

  return NextResponse.json(metadata, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
