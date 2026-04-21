'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

// ─── Topic suggestion cards ───
const SUGGESTION_CARDS = [
  { emoji: '\u{1F510}', title: 'Kiosk Mode', description: 'Locked out of Kiosk Mode on terminal', message: 'I am locked out of Kiosk Mode on my SALTO terminal. How do I exit or recover from it?', tier: 'tier1' as const },
  { emoji: '\u{1F4F3}', title: 'Online NCoder', description: "NCoder won't encode keycards", message: 'My Online NCoder is not encoding keycards. What should I do?', tier: 'tier1' as const },
  { emoji: '\u{1F511}', title: 'Guest Keys', description: "Can't make guest keys with SALTO Server", message: 'I am unable to make guest keys using the SALTO Server. Can you help?', tier: 'tier1' as const },
  { emoji: '\u{1F464}', title: 'Staff Key Updater', description: "Updater won't update staff keys", message: 'The Updater device is not updating my staff keycards. How do I fix this?', tier: 'tier1' as const },
  { emoji: '\u{1F50B}', title: 'PPD Power Lock', description: 'Use PPD when batteries die', message: 'My lock batteries are dead. How do I use the PPD to power the lock and open the door?', tier: 'tier1' as const },
  { emoji: '\u{1F50C}', title: 'Battery Change', description: 'Replace batteries on XS4 Original+', message: 'How do I change the batteries on my XS4 Original+ guest room lock?', tier: 'tier1' as const },
  { emoji: '\u{2B06}\u{FE0F}', title: 'PPD Lock Update', description: 'Update lock firmware with PPD', message: 'I need to update my lock using the PPD. Can you walk me through it?', tier: 'tier1' as const },
  { emoji: '\u{1F4CB}', title: 'PPD Audit Trail', description: 'Pull lock access history with PPD', message: 'How do I pull a lock audit trail using the PPD?', tier: 'tier1' as const },
  { emoji: '\u{1F527}', title: 'Other Issue', description: 'Advanced technical support', message: '', tier: 'tier2' as const },
];

const RESPONSIVE_CSS = `
@keyframes onlinePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

@media (max-width: 768px) {
  .els-layout { grid-template-columns: 1fr !important; }
  .els-sidebar { display: none !important; }
  .els-mobile-header { display: flex !important; }
}
@media (min-width: 769px) {
  .els-mobile-header { display: none !important; }
}
`;

export default function Tier2ChatPage() {
  const router = useRouter();
  const [hoveredSidebar, setHoveredSidebar] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'error'>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatkit = useChatKit({
    api: {
      getClientSecret: async (currentSecret: string | null) => {
        const user = getUserId();
        const conversation = getConversationId();

        // Only use cache on the initial fetch. When ChatKit passes a
        // currentSecret, it's requesting a refresh — must mint a new one.
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
    onReady: () => setStatus('idle'),
    onError: () => {
      resetConversation();
      setStatus('error');
    },
  });

  const { control, ref } = chatkit as any;

  const startNewChat = useCallback(() => {
    resetConversation();
    window.location.reload();
  }, []);

  const handleSidebarClick = useCallback((card: typeof SUGGESTION_CARDS[0]) => {
    if (card.tier === 'tier1') {
      router.push('/tier1');
      return;
    }
    // "Other Issue" on tier2 = already here
    if (!card.message) return;
    resetConversation();
    window.location.reload();
  }, [router]);

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
          background: 'linear-gradient(160deg, #eef2ff 0%, #e0e7ff 35%, #f1f5f9 75%, #ede9fe 100%)',
        }}
      >
        {/* ─── Left Sidebar ─── */}
        <aside
          className="els-sidebar"
          style={{
            background: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 100%)',
            borderRight: '1px solid rgba(67,56,202,0.3)',
            color: '#e0e7ff',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {/* Brand */}
          <div style={{ padding: '20px 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/el-logo.png" alt="Electronic Locksmith" style={{ width: 60, height: 'auto', objectFit: 'contain', flexShrink: 0, filter: 'brightness(0) invert(1)' }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', lineHeight: 1.2 }}>Electronic Locksmith</div>
                <div style={{ fontSize: 11, color: '#c7d2fe', marginTop: 2 }}>Advanced Tech Support</div>
              </div>
            </div>
            <div style={{
              marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#ffffff',
              textTransform: 'uppercase', boxShadow: '0 2px 8px rgba(67,56,202,0.4)',
            }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Tier 2 · Advanced
            </div>
          </div>

          {/* New Chat */}
          <div style={{ padding: '0 12px 12px' }}>
            <button
              onClick={startNewChat}
              style={{
                width: '100%', border: '1.5px solid rgba(199,210,254,0.2)', background: 'rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#e0e7ff',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          <div style={{ height: 1, background: 'rgba(199,210,254,0.12)', margin: '0 12px 12px' }} />
          <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 600, color: '#a5b4fc', letterSpacing: '0.05em', textTransform: 'uppercase' }}>TOPICS</div>

          {/* Sidebar topic items */}
          <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {SUGGESTION_CARDS.map((card, i) => {
              const isOther = card.tier === 'tier2';
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
                    background: isOther ? 'rgba(139,92,246,0.18)' : isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s ease',
                    fontWeight: isOther ? 600 : undefined,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{card.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isOther ? '#c4b5fd' : '#e0e7ff', lineHeight: 1.3 }}>{card.title}</div>
                    <div style={{ fontSize: 11, color: '#a5b4fc', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.description}</div>
                  </div>
                  {card.tier === 'tier1' && (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a5b4fc" strokeWidth={2} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Online indicator */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(199,210,254,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status === 'error' ? '#f87171' : '#34d399',
              animation: status === 'error' ? 'none' : 'onlinePulse 2s infinite',
            }} />
            <span style={{ fontSize: 12, color: '#c7d2fe' }}>
              {status === 'error' ? 'Connection error' : 'Specialist Online'}
            </span>
          </div>
        </aside>

        {/* ─── Main Chat Area (ChatKit) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
          {/* Mobile header */}
          <header
            className="els-mobile-header"
            style={{
              height: 56, minHeight: 56,
              background: 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)',
              borderBottom: '1px solid rgba(67,56,202,0.12)',
              display: 'flex', alignItems: 'center', padding: '0 16px',
              boxShadow: '0 1px 8px rgba(67,56,202,0.06)', zIndex: 20,
            }}
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', marginRight: 8 }}
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#334155" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src="/el-logo.png" alt="EL" style={{ width: 40, height: 'auto', marginRight: 8 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>Tier 2 · Advanced Support</span>
            <div style={{ flex: 1 }} />
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status === 'error' ? '#ef4444' : '#16a34a',
              animation: status === 'error' ? 'none' : 'onlinePulse 2s infinite',
            }} />
          </header>

          {/* ChatKit widget container */}
          <div style={{ padding: 18, flex: 1, minHeight: 0 }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(67,56,202,0.12)',
                borderRadius: 12,
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(67,56,202,0.08)',
              }}
            >
              {/* Header bar */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(67,56,202,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)',
                }}
              >
                <img src="/el-logo.png" alt="EL" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e1b4b' }}>Advanced Tech Support</div>
                  <div style={{ fontSize: 11, color: '#6366f1' }}>Tier 2 · Specialist SALTO Troubleshooting</div>
                </div>
                <div style={{
                  padding: '4px 10px', borderRadius: 999,
                  background: 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#ffffff',
                  textTransform: 'uppercase',
                }}>
                  Tier 2
                </div>
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
