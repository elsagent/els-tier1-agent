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
          background: 'linear-gradient(160deg, #f0f4ff 0%, #f8fafc 40%, #fef7f0 70%, #fdf2f4 100%)',
        }}
      >
        {/* ─── Left Sidebar ─── */}
        <aside
          className="els-sidebar"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)',
            borderRight: '1px solid rgba(176,18,44,0.06)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {/* Brand */}
          <div style={{ padding: '20px 16px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/el-logo.png" alt="Electronic Locksmith" style={{ width: 60, height: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>Electronic Locksmith</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Technical Support</div>
              </div>
            </div>
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
          <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>TOPICS</div>

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
                    background: isOther ? 'rgba(176,18,44,0.06)' : isHovered ? 'rgba(15,23,42,0.04)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s ease',
                    fontWeight: isOther ? 600 : undefined,
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{card.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isOther ? '#B0122C' : '#0f172a', lineHeight: 1.3 }}>{card.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.description}</div>
                  </div>
                  {card.tier === 'tier1' && (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={2} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Online indicator */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status === 'error' ? '#ef4444' : '#16a34a',
              animation: status === 'error' ? 'none' : 'onlinePulse 2s infinite',
            }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {status === 'error' ? 'Connection error' : 'Online 24/7'}
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
              background: 'linear-gradient(135deg, #ffffff 0%, #f8f5ff 100%)',
              borderBottom: '1px solid rgba(176,18,44,0.06)',
              display: 'flex', alignItems: 'center', padding: '0 16px',
              boxShadow: '0 1px 8px rgba(176,18,44,0.04)', zIndex: 20,
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
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Technical Support</span>
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
                border: '1px solid rgba(176,18,44,0.06)',
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
                  borderBottom: '1px solid rgba(176,18,44,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8f5ff 100%)',
                }}
              >
                <img src="/el-logo.png" alt="EL" style={{ width: 28, height: 28, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Technical Support</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Advanced SALTO Troubleshooting</div>
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
