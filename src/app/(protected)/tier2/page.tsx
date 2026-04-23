'use client';

import { useState, useCallback } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

// ─── Workflow ID (from env or hardcoded) ───
const WORKFLOW_ID =
  process.env.NEXT_PUBLIC_TIER2_WORKFLOW_ID ||
  'wf_69d0a542e3848190959b44b86655a8160771e444045c7538';

// ─── Session helpers (localStorage/sessionStorage) ───
const USER_KEY = 'els_tier2_user';
const CONVO_KEY = 'els_tier2_conversation';
const SECRET_KEY = 'els_tier2_client_secret';

function getOrCreate(storage: Storage, key: string) {
  let v = storage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    storage.setItem(key, v);
  }
  return v;
}
function getUserId() {
  try { return getOrCreate(localStorage, USER_KEY); } catch { return crypto.randomUUID(); }
}
function getConversationId() {
  try { return getOrCreate(sessionStorage, CONVO_KEY); } catch { return crypto.randomUUID(); }
}
function resetConversation() {
  try {
    sessionStorage.setItem(CONVO_KEY, crypto.randomUUID());
    sessionStorage.removeItem(SECRET_KEY);
  } catch { /* ignore */ }
}
function getCachedSecret() {
  try { return sessionStorage.getItem(SECRET_KEY); } catch { return null; }
}
function setCachedSecret(secret: string) {
  try { sessionStorage.setItem(SECRET_KEY, secret); } catch { /* ignore */ }
}

// ─── Topic suggestion cards (Tier 2 — advanced SALTO issues) ───
const SUGGESTION_CARDS = [
  { emoji: '\u{1F5DD}', title: 'Access Plans', description: 'Configure groups, zones, or time windows', message: 'I need help configuring an access plan in SALTO SPACE.', tier: 'tier2' as const },
  { emoji: '\u{1F310}', title: 'Network Issues', description: 'Lock offline or connectivity problems', message: 'My SALTO locks are showing offline and basic rebooting has not helped. Can you walk me through network troubleshooting?', tier: 'tier2' as const },
  { emoji: '\u{1F4DF}', title: 'Encoder Diagnostics', description: 'Encoder errors beyond a reboot', message: 'Our encoder keeps throwing errors and I have already tried rebooting it. What should I check next?', tier: 'tier2' as const },
  { emoji: '\u{1F504}', title: 'PMS Integration', description: 'Property management system sync', message: 'Our PMS integration with SALTO is not pushing keys correctly to the encoder. How do I troubleshoot it?', tier: 'tier2' as const },
  { emoji: '\u{1F5C4}', title: 'Database & Backup', description: 'SPACE database or backup / restore', message: 'I need help with SALTO SPACE database connectivity or restoring from a backup.', tier: 'tier2' as const },
  { emoji: '\u{1F3E2}', title: 'Multi-Property', description: 'Multi-site or multi-property setup', message: 'I need to configure SALTO across multiple properties. Where do I start?', tier: 'tier2' as const },
  { emoji: '\u{1F527}', title: 'Hardware Compatibility', description: 'Lock / reader / controller compatibility', message: 'I have a hardware compatibility question about SALTO locks, readers, or controllers.', tier: 'tier2' as const },
  { emoji: '\u{1F5A5}', title: 'Server / License', description: 'Service restart, license update', message: 'I need help with the SALTO server, services, or license update.', tier: 'tier2' as const },
  { emoji: '\u{2B05}', title: 'Back to Quick Support', description: 'Return to basic Tier 1 help', message: '', tier: 'tier1' as const },
];

const RESPONSIVE_CSS = `
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

@media (max-width: 768px) {
  .els-layout { grid-template-columns: 1fr !important; }
  .els-sidebar-desktop { display: none !important; }
  .els-mobile-header { display: flex !important; }
  .els-chat-panel { padding: 8px !important; }
}
@media (min-width: 769px) {
  .els-mobile-header { display: none !important; }
  .els-sidebar-drawer { display: none !important; }
  .els-drawer-overlay { display: none !important; }
}
`;

export default function Tier2ChatPage() {
  const [hoveredSidebar, setHoveredSidebar] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const chatkit = useChatKit({
    api: {
      getClientSecret: async (currentSecret: string | null) => {
        const user = getUserId();
        const conversation = getConversationId();

        if (!currentSecret) {
          const cached = getCachedSecret();
          if (cached) return cached;
        }

        const res = await fetch('/api/chatkit/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow: { id: WORKFLOW_ID },
            user,
            conversation,
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Session creation failed: HTTP ${res.status} - ${text}`);
        }

        const data = await res.json();
        setCachedSecret(data.client_secret);
        return data.client_secret;
      },
    },
    theme: { colorScheme: 'light' },
    onReady: () => { setStatus('idle'); setIsReady(true); },
    onError: () => {
      resetConversation();
      setStatus('error');
    },
  });

  const { control, ref, setComposerValue, focusComposer } = chatkit as any;

  const startNewChat = useCallback(() => {
    resetConversation();
    window.location.reload();
  }, []);

  const handleSidebarClick = useCallback(async (card: typeof SUGGESTION_CARDS[0]) => {
    if (card.tier === 'tier1') {
      window.location.href = '/tier1';
      return;
    }
    if (!card.message) return;
    if (!isReady) {
      console.warn('[ELS] ChatKit not ready yet, ignoring topic click');
      return;
    }
    try {
      await setComposerValue({ text: card.message });
      focusComposer?.();
    } catch (e) {
      console.error('[ELS] setComposerValue failed', e);
    }
  }, [isReady, setComposerValue, focusComposer]);

  // Sidebar content — rendered in desktop column AND mobile drawer.
  // Brand-consistent red palette, differentiated from Tier 1 by:
  //   (a) dark-red "ADVANCED" badge in the brand header
  //   (b) darker, denser sidebar background
  //   (c) "Back to Quick Support" as the escape hatch
  const sidebarContent = (
    <>
      {/* Brand header with ADVANCED badge */}
      <div style={{ padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <img src="/el-logo.png" alt="Electronic Locksmith" style={{ width: 60, height: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>Electronic Locksmith</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Advanced Support</div>
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #C8102E 0%, #A00C24 100%)',
            color: '#ffffff',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase' as const,
            boxShadow: '0 2px 8px rgba(200,16,46,0.25)',
          }}
        >
          ⚡ Advanced Tier
        </span>
      </div>

      {/* New Chat */}
      <div style={{ padding: '0 12px 12px' }}>
        <button
          onClick={startNewChat}
          style={{
            width: '100%', border: '1.5px solid rgba(15,23,42,0.08)', background: '#ffffff',
            borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#334155',
            transition: 'all 0.15s ease',
          }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      <div style={{ height: 1, background: 'rgba(15,23,42,0.06)', margin: '0 12px 12px' }} />

      {/* Section label */}
      <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
        Advanced Topics
      </div>

      {/* Sidebar topic items */}
      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {SUGGESTION_CARDS.map((card, i) => {
          const isBack = card.tier === 'tier1';
          const isHovered = hoveredSidebar === i;
          return (
            <button
              key={i}
              onClick={() => handleSidebarClick(card)}
              onMouseEnter={() => setHoveredSidebar(i)}
              onMouseLeave={() => setHoveredSidebar(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 10, border: 'none',
                background: isHovered ? (isBack ? 'rgba(100,116,139,0.08)' : 'rgba(200,16,46,0.06)') : 'transparent',
                cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s ease',
                marginTop: isBack ? 12 : 0,
                borderTop: isBack ? '1px solid rgba(15,23,42,0.06)' : 'none',
                paddingTop: isBack ? 14 : 10,
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{card.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isBack ? '#64748b' : '#0f172a', lineHeight: 1.3 }}>{card.title}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.description}</div>
              </div>
              {isBack && (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Connection status — error only */}
      {status === 'error' && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>Connection error</span>
        </div>
      )}
    </>
  );

  const sidebarStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #ffffff 0%, #fdf2f4 100%)',
    borderRight: '1px solid rgba(200,16,46,0.1)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflowY: 'auto',
  };

  return (
    <>
      <style>{RESPONSIVE_CSS}</style>
      <div
        className="els-layout"
        style={{
          height: '100vh',
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          background: 'linear-gradient(160deg, #fef2f4 0%, #fafaf9 50%, #f8fafc 100%)',
        }}
      >
        {/* ─── Left Sidebar (desktop) ─── */}
        <aside className="els-sidebar-desktop" style={sidebarStyle}>
          {sidebarContent}
        </aside>

        {/* ─── Mobile drawer overlay ─── */}
        {sidebarOpen && (
          <div
            className="els-drawer-overlay"
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 40 }}
          />
        )}

        {/* ─── Mobile drawer ─── */}
        <aside
          className="els-sidebar-drawer"
          style={{
            ...sidebarStyle,
            position: 'fixed',
            top: 0, left: 0, bottom: 0,
            width: 280,
            zIndex: 41,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.2s ease',
            boxShadow: sidebarOpen ? '0 10px 30px rgba(0,0,0,0.18)' : 'none',
          }}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button')) setSidebarOpen(false);
          }}
        >
          {sidebarContent}
        </aside>

        {/* ─── Main Chat Area (ChatKit) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
          {/* Mobile header */}
          <header
            className="els-mobile-header"
            style={{
              height: 56, minHeight: 56,
              background: 'linear-gradient(135deg, #ffffff 0%, #fef2f4 100%)',
              borderBottom: '1px solid rgba(200,16,46,0.1)',
              display: 'flex', alignItems: 'center', padding: '0 16px',
              boxShadow: '0 1px 8px rgba(200,16,46,0.06)', zIndex: 20,
            }}
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', marginRight: 8 }}
              aria-label="Open menu"
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#334155" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src="/el-logo.png" alt="EL" style={{ width: 40, height: 'auto', marginRight: 8 }} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>Advanced Support</span>
              <span style={{
                fontSize: 9, fontWeight: 800, color: '#C8102E',
                letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginTop: 2,
              }}>⚡ Advanced Tier</span>
            </div>
            <div style={{ flex: 1 }} />
            {status === 'error' && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            )}
          </header>

          {/* ChatKit widget container */}
          <div className="els-chat-panel" style={{ padding: 18, flex: 1, minHeight: 0 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(200,16,46,0.1)',
                borderRadius: 12,
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              {/* Header bar */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(200,16,46,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'linear-gradient(135deg, #ffffff 0%, #fef2f4 100%)',
                }}
              >
                <img src="/el-logo.png" alt="EL" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>Advanced Support</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Specialist SALTO Troubleshooting</div>
                </div>
                <div style={{ flex: 1 }} />
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 9999,
                    background: 'linear-gradient(135deg, #C8102E 0%, #A00C24 100%)',
                    color: '#ffffff',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    boxShadow: '0 2px 8px rgba(200,16,46,0.25)',
                  }}
                >⚡ Advanced</span>
              </div>

              {/* ChatKit component */}
              <div style={{ flex: 1, minHeight: 0 }}>
                <ChatKit control={control} ref={ref} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
