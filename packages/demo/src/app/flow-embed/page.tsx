import { EmbeddedLogin } from '../components/EmbeddedLogin'

export default function FlowEmbedPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: '#f8f9fa',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '24px', margin: 0 }}>
        Iframe-Embedded Login Demo
      </h1>
      <p style={{ color: '#6b7280', margin: 0 }}>
        This page demonstrates the iframe-embedded auth flow.
      </p>
      <EmbeddedLogin
        pdsOrigin={process.env.NEXT_PUBLIC_PDS_URL ?? 'https://localhost:3000'}
      />
    </main>
  )
}
