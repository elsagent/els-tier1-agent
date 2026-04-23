/**
 * Persistent chat disclaimer footer.
 *
 * Non-dismissible. Stays visible on every page that renders a chat UI.
 * Addresses the liability risk that someone uses the AI for an emergency
 * instead of calling 911 or the human support line.
 *
 * Wording matches the canned emergency response in lib/agents/classifier.ts.
 * Keep them in sync.
 */

export default function ChatDisclaimer() {
  return (
    <div
      role="note"
      aria-label="AI support disclaimer"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '8px 16px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(15, 23, 42, 0.08)',
        color: '#475569',
        fontSize: 12,
        lineHeight: 1.4,
        textAlign: 'center',
        pointerEvents: 'auto',
      }}
    >
      AI support agent for SALTO electronic locks. For an emergency or guest-safety issue, call{' '}
      <strong>911</strong> first. For other urgent lock issues during business hours, call{' '}
      <a
        href="tel:4078144974"
        style={{ color: '#C8102E', textDecoration: 'none', fontWeight: 600 }}
      >
        407-814-4974
      </a>{' '}
      (Mon-Fri 8am-4pm ET).
    </div>
  );
}
