'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import EscalationForm from '@/components/EscalationForm';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SUGGESTION_CARDS = [
  {
    emoji: '\u{1F510}',
    title: 'Kiosk Mode',
    description: 'Locked out of Kiosk Mode on terminal',
    message: 'I am locked out of Kiosk Mode on my SALTO terminal. How do I exit or recover from it?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F4F3}',
    title: 'Online NCoder',
    description: 'NCoder won\'t encode keycards',
    message: 'My Online NCoder is not encoding keycards. What should I do?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F511}',
    title: 'Guest Keys',
    description: 'Can\'t make guest keys with SALTO Server',
    message: 'I am unable to make guest keys using the SALTO Server. Can you help?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F464}',
    title: 'Staff Key Updater',
    description: 'Updater won\'t update staff keys',
    message: 'The Updater device is not updating my staff keycards. How do I fix this?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F50B}',
    title: 'PPD Power Lock',
    description: 'Use PPD when batteries die',
    message: 'My lock batteries are dead. How do I use the PPD to power the lock and open the door?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F50C}',
    title: 'Battery Change',
    description: 'Replace batteries on XS4 Original+',
    message: 'How do I change the batteries on my XS4 Original+ guest room lock?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{2B06}\u{FE0F}',
    title: 'PPD Lock Update',
    description: 'Update lock firmware with PPD',
    message: 'I need to update my lock using the PPD. Can you walk me through it?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F4CB}',
    title: 'PPD Audit Trail',
    description: 'Pull lock access history with PPD',
    message: 'How do I pull a lock audit trail using the PPD?',
    tier: 'tier1' as const,
  },
  {
    emoji: '\u{1F527}',
    title: 'Other Issue',
    description: 'Advanced technical support',
    message: '',
    tier: 'tier2' as const,
  },
];

const RESPONSIVE_CSS = `
@keyframes onlinePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes slideInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes dotPulse { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
@keyframes escalationSlideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

@media (max-width: 768px) {
  .els-layout { grid-template-columns: 1fr !important; }
  .els-sidebar { display: none !important; }
  .els-mobile-header { display: flex !important; }
}
@media (min-width: 769px) {
  .els-mobile-header { display: none !important; }
}
.els-layout.no-sidebar { grid-template-columns: 1fr !important; }
.els-layout.no-sidebar .els-sidebar { display: none !important; }
`;

export default function Tier1ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [isEscalatedToTier2, setIsEscalatedToTier2] = useState(false);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [escalationSummary, setEscalationSummary] = useState('');
  const [hoveredSidebar, setHoveredSidebar] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setIsEscalated(false);
    setIsEscalatedToTier2(false);
    setShowEscalationForm(false);
    setEscalationSummary('');
    setInput('');
    inputRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent, overrideMessage?: string) => {
    e?.preventDefault();
    const trimmed = (overrideMessage || input).trim();
    if (!trimmed || isLoading || isEscalated) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationId: conversationId || undefined,
          tier: isEscalatedToTier2 ? 'tier2' : 'tier1',
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);

            switch (data.type) {
              case 'meta':
                if (data.conversationId) setConversationId(data.conversationId);
                break;
              case 'text':
                assistantContent += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = { ...lastMsg, content: assistantContent };
                  } else {
                    updated.push({ role: 'assistant', content: assistantContent });
                  }
                  return updated;
                });
                break;
              case 'tier2_escalation':
                setIsEscalatedToTier2(true);
                setMessages((prev) => [...prev, { role: 'system', content: data.content || 'Connecting you to our technical support team...' }]);
                assistantContent = '';
                break;
              case 'escalate':
                setIsEscalated(true);
                setShowEscalationForm(true);
                setEscalationSummary(data.summary || '');
                if (data.content) setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
                break;
              case 'error':
                setMessages((prev) => [...prev, { role: 'assistant', content: data.content || 'An error occurred. Please try again.' }]);
                break;
              case 'done':
                break;
            }
          } catch {
            // skip
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSidebarClick = (card: typeof SUGGESTION_CARDS[0]) => {
    if (card.tier === 'tier2') {
      router.push('/tier2');
      return;
    }
    // If already in chat (messages exist), add the question to current conversation
    if (messages.length > 0) {
      handleSubmit(undefined, card.message);
    } else {
      handleSubmit(undefined, card.message);
    }
  };

  const isInputDisabled = isLoading || isEscalated;
  const hasMessages = messages.length > 0 || isLoading;

  return (
    <>
      <style>{RESPONSIVE_CSS}</style>
      <div
        className={`els-layout${!hasMessages ? ' no-sidebar' : ''}`}
        style={{
          height: '100vh',
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          background: 'linear-gradient(160deg, #fdf2f4 0%, #fef7f0 30%, #f8fafc 70%, #f0f4ff 100%)',
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
              <img
                src="/el-logo.png"
                alt="Electronic Locksmith"
                style={{ width: 60, height: 'auto', objectFit: 'contain', flexShrink: 0 }}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', lineHeight: 1.2 }}>
                  Electronic Locksmith
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Quick Support
                </div>
              </div>
            </div>
          </div>

          {/* New Chat */}
          <div style={{ padding: '0 12px 12px' }}>
            <button
              onClick={startNewChat}
              style={{
                width: '100%',
                border: '1.5px solid rgba(15,23,42,0.08)',
                background: '#ffffff',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#334155',
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
          <div style={{ padding: '0 16px 8px', fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            TOPICS
          </div>

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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: isHovered
                      ? isOther ? 'rgba(176,18,44,0.08)' : 'rgba(15,23,42,0.04)'
                      : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{card.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: isOther ? '#B0122C' : '#0f172a', lineHeight: 1.3 }}>
                      {card.title}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.description}
                    </div>
                  </div>
                  {isOther && (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#B0122C" strokeWidth={2} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Online indicator */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'onlinePulse 2s infinite' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>Online 24/7</span>
          </div>
        </aside>

        {/* ─── Main Chat Area ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', minWidth: 0 }}>
          {/* Mobile header */}
          <header
            className="els-mobile-header"
            style={{
              height: 56,
              minHeight: 56,
              background: 'linear-gradient(135deg, #ffffff 0%, #fff8f8 100%)',
              borderBottom: '1px solid rgba(176,18,44,0.06)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              boxShadow: '0 1px 8px rgba(176,18,44,0.04)',
              zIndex: 20,
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
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Quick Support</span>
            <div style={{ flex: 1 }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'onlinePulse 2s infinite' }} />
          </header>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '20px 20px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Empty state with bigger cards */}
              {!hasMessages && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, animation: 'fadeIn 0.4s ease' }}>
                  <img
                    src="/el-logo.png"
                    alt="Electronic Locksmith"
                    style={{ width: 140, height: 'auto', objectFit: 'contain' }}
                  />
                  <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
                    How can we help?
                  </h2>
                  <p style={{ margin: 0, fontSize: 15, color: '#64748b', textAlign: 'center', maxWidth: 440, lineHeight: 1.6 }}>
                    Get quick help with common SALTO lock issues. Choose a topic or describe your problem.
                  </p>

                  {/* Bigger suggestion cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 14,
                      marginTop: 8,
                      width: '100%',
                      maxWidth: 680,
                    }}
                  >
                    {SUGGESTION_CARDS.map((card, i) => {
                      const isOther = card.tier === 'tier2';
                      return (
                        <button
                          key={i}
                          onClick={() => handleSidebarClick(card)}
                          onMouseEnter={() => setHoveredSidebar(100 + i)}
                          onMouseLeave={() => setHoveredSidebar(null)}
                          style={{
                            background: isOther
                              ? hoveredSidebar === 100 + i
                                ? 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)'
                                : 'linear-gradient(135deg, rgba(176,18,44,0.06) 0%, rgba(212,54,92,0.04) 100%)'
                              : hoveredSidebar === 100 + i
                                ? 'linear-gradient(135deg, #ffffff 0%, #fff8f8 100%)'
                                : 'rgba(255,255,255,0.85)',
                            backdropFilter: 'blur(8px)',
                            border: isOther
                              ? hoveredSidebar === 100 + i ? '1.5px solid #B0122C' : '1.5px solid rgba(176,18,44,0.12)'
                              : hoveredSidebar === 100 + i ? '1.5px solid rgba(176,18,44,0.3)' : '1.5px solid rgba(15,23,42,0.06)',
                            borderRadius: 16,
                            padding: '18px 16px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                            boxShadow: hoveredSidebar === 100 + i
                              ? '0 8px 24px rgba(176,18,44,0.12)'
                              : '0 1px 4px rgba(15,23,42,0.04)',
                            transform: hoveredSidebar === 100 + i ? 'translateY(-2px)' : 'translateY(0)',
                          }}
                        >
                          <div style={{ fontSize: 26, marginBottom: 8 }}>{card.emoji}</div>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 650,
                            color: isOther && hoveredSidebar === 100 + i ? '#ffffff' : isOther ? '#B0122C' : '#0f172a',
                            marginBottom: 4,
                          }}>
                            {card.title}
                          </div>
                          <div style={{
                            fontSize: 13,
                            color: isOther && hoveredSidebar === 100 + i ? 'rgba(255,255,255,0.8)' : '#94a3b8',
                            lineHeight: 1.5,
                          }}>
                            {card.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.map((msg, i) => {
                if (msg.role === 'system') {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '16px 0', animation: 'escalationSlideIn 0.4s ease' }}>
                      <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '1px solid #fbbf24', borderRadius: 12, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 480 }}>
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#92400e" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#78350f' }}>{msg.content}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12, animation: 'slideInUp 0.25s ease', alignItems: 'flex-end', gap: 8 }}>
                    {msg.role === 'assistant' && (
                      <img src="/el-logo.png" alt="EL" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', flexShrink: 0, background: '#fff', border: '1px solid rgba(15,23,42,0.06)' }} />
                    )}
                    <div style={{
                      maxWidth: '75%',
                      padding: '12px 16px',
                      fontSize: 14,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #B0122C 0%, #C41E3A 100%)' : 'rgba(255,255,255,0.9)',
                      backdropFilter: msg.role === 'assistant' ? 'blur(8px)' : undefined,
                      color: msg.role === 'user' ? '#ffffff' : '#1e293b',
                      border: msg.role === 'assistant' ? '1px solid rgba(176,18,44,0.06)' : 'none',
                      borderLeft: msg.role === 'assistant' ? '3px solid rgba(176,18,44,0.15)' : undefined,
                      boxShadow: msg.role === 'user' ? '0 4px 12px rgba(176,18,44,0.2)' : '0 2px 8px rgba(15,23,42,0.04)',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                );
              })}

              {/* Typing */}
              {isLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12, alignItems: 'flex-end', gap: 8 }}>
                  <img src="/el-logo.png" alt="EL" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain', flexShrink: 0, background: '#fff', border: '1px solid rgba(15,23,42,0.06)' }} />
                  <div style={{ padding: '12px 16px', borderRadius: '18px 18px 18px 4px', background: '#ffffff', border: '1px solid rgba(15,23,42,0.06)', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map((dot) => (
                      <span key={dot} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: 'dotPulse 1.4s infinite ease-in-out', animationDelay: `${dot * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Escalation form */}
          {showEscalationForm && conversationId && (
            <div style={{ maxWidth: 760, width: '100%', margin: '0 auto', padding: '0 20px' }}>
              <EscalationForm conversationId={conversationId} issueSummary={escalationSummary} onSubmit={() => setShowEscalationForm(false)} />
            </div>
          )}

          {/* Input */}
          <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.9) 0%, #ffffff 100%)', borderTop: '1px solid rgba(176,18,44,0.06)', padding: '14px 20px', boxShadow: '0 -2px 12px rgba(15,23,42,0.03)' }}>
            <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              {isEscalated ? (
                <div style={{ flex: 1, padding: '14px 16px', background: '#f5f5f0', borderRadius: 16, fontSize: 13, color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>
                  Transferred to human support — our team will reach out soon
                </div>
              ) : (
                <>
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your SALTO lock issue..."
                    disabled={isInputDisabled}
                    rows={1}
                    style={{
                      flex: 1, resize: 'none', border: '1px solid rgba(15,23,42,0.08)', borderRadius: 16, padding: '12px 16px',
                      fontSize: 14, outline: 'none', color: '#0f172a', background: '#fafaf9', minHeight: 48, maxHeight: 120,
                      lineHeight: 1.5, transition: 'border-color 0.15s ease', fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(176,18,44,0.3)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'rgba(15,23,42,0.08)'; }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                    }}
                  />
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!input.trim() || isInputDisabled}
                    style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: !input.trim() || isInputDisabled ? '#d1d5db' : 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)',
                      boxShadow: !input.trim() || isInputDisabled ? 'none' : '0 4px 12px rgba(176,18,44,0.3)',
                      color: '#ffffff', border: 'none', cursor: !input.trim() || isInputDisabled ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
