import { FlowLoginPage } from '../components/FlowLoginPage'

export default function Flow3Page() {
  return (
    <FlowLoginPage
      subtitle="Flow 3 — random handle (server assigns, no picker)"
      handleMode="random"
      navLinks={[
        { href: '/', label: 'Switch to Flow 1 (email form)' },
        { href: '/flow2', label: 'Switch to Flow 2 (no email form)' },
        { href: '/flow4', label: 'Switch to Flow 4 (plain picker)' },
      ]}
    />
  )
}
