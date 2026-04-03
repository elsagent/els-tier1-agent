'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import EscalationForm from '@/components/EscalationForm';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SUGGESTION_CARDS = [
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#B0122C" strokeWidth={1.8}>
        <path d="M4 4h16v16H4z" />
        <path d="M9 9h6M9 13h4" />
      </svg>
    ),
    title: 'Battery Replacement',
    description: 'Lock showing low battery or not responding',
    message: 'My lock is showing a low battery warning. How do I replace the batteries?',
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#B0122C" strokeWidth={1.8}>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 118 0v4" />
      </svg>
    ),
    title: 'Door Not Locking',
    description: 'Lock fails to engage or latch properly',
    message: 'My door is not locking properly. The lock does not engage when I close the door.',
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#B0122C" strokeWidth={1.8}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M12 12h.01" />
      </svg>
    ),
    title: 'Keycard Not Working',
    description: 'Card not recognized or access denied',
    message: 'My keycard is not being recognized by the lock. It shows a red light when I present it.',
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#B0122C" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Clock Sync Issue',
    description: 'Lock time out of sync with system',
    message: 'The lock time appears to be out of sync with the system. How do I fix the clock?',
  },
];

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
  const [hoverNewChat, setHoverNewChat] = useState(false);
  const [hoveredSuggestion, setHoveredSuggestion] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

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
                if (data.conversationId) {
                  setConversationId(data.conversationId);
                }
                break;

              case 'text':
                assistantContent += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...lastMsg,
                      content: assistantContent,
                    };
                  } else {
                    updated.push({
                      role: 'assistant',
                      content: assistantContent,
                    });
                  }
                  return updated;
                });
                break;

              case 'tier2_escalation':
                setIsEscalatedToTier2(true);
                // Add system message for the transfer banner
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'system',
                    content: data.content || 'Connecting you to our technical support team...',
                  },
                ]);
                // Reset assistantContent for the Tier 2 response
                assistantContent = '';
                break;

              case 'escalate':
                setIsEscalated(true);
                setShowEscalationForm(true);
                setEscalationSummary(data.summary || '');
                if (data.content) {
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: data.content },
                  ]);
                }
                break;

              case 'error':
                setMessages((prev) => [
                  ...prev,
                  {
                    role: 'assistant',
                    content:
                      data.content || 'An error occurred. Please try again.',
                  },
                ]);
                break;

              case 'done':
                break;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ]);
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

  const headerTitle = isEscalatedToTier2 ? 'Connected to Technical Support' : 'ELS Quick Support';
  const isInputDisabled = isLoading || isEscalated;

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafaf9',
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 56,
          minHeight: 56,
          background: '#ffffff',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
          zIndex: 10,
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#B0122C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: 0.5,
              flexShrink: 0,
            }}
          >
            ELS
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em',
            }}
          >
            {headerTitle}
          </span>
        </div>

        {/* Center - Online indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#16a34a',
              animation: 'onlinePulse 2s infinite',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>
            Online
          </span>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
          <button
            onClick={startNewChat}
            onMouseEnter={() => setHoverNewChat(true)}
            onMouseLeave={() => setHoverNewChat(false)}
            style={{
              background: 'transparent',
              border: '1px solid rgba(15,23,42,0.08)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              color: hoverNewChat ? '#0f172a' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              padding: 6,
              cursor: 'pointer',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: '100%',
            margin: '0 auto',
            padding: '20px 20px 0 20px',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                animation: 'fadeIn 0.4s ease',
              }}
            >
              {/* Gradient icon */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 32px rgba(176,18,44,0.2)',
                }}
              >
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth={1.8}>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 118 0v4" />
                </svg>
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                How can we help?
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: '#64748b',
                  textAlign: 'center',
                  maxWidth: 400,
                  lineHeight: 1.6,
                }}
              >
                Get quick help with common SALTO lock issues. Choose a topic below or describe your problem.
              </p>

              {/* Suggestion cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginTop: 8,
                  width: '100%',
                  maxWidth: 520,
                }}
              >
                {SUGGESTION_CARDS.map((card, i) => (
                  <button
                    key={i}
                    onClick={() => handleSubmit(undefined, card.message)}
                    onMouseEnter={() => setHoveredSuggestion(i)}
                    onMouseLeave={() => setHoveredSuggestion(null)}
                    style={{
                      background: '#ffffff',
                      border: hoveredSuggestion === i ? '1.5px solid #B0122C' : '1.5px solid rgba(15,23,42,0.06)',
                      borderRadius: 12,
                      padding: '16px 14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow:
                        hoveredSuggestion === i
                          ? '0 4px 16px rgba(176,18,44,0.1)'
                          : '0 1px 3px rgba(15,23,42,0.04)',
                      transform: hoveredSuggestion === i ? 'translateY(-1px)' : 'translateY(0)',
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>{card.icon}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#0f172a',
                        marginBottom: 4,
                      }}
                    >
                      {card.title}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        lineHeight: 1.4,
                      }}
                    >
                      {card.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => {
            if (msg.role === 'system') {
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '16px 0',
                    animation: 'escalationSlideIn 0.4s ease',
                  }}
                >
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                      border: '1px solid #fbbf24',
                      borderRadius: 12,
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      maxWidth: 480,
                    }}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#92400e" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#78350f' }}>
                      {msg.content}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  marginBottom: 12,
                  animation: 'slideInUp 0.25s ease',
                  alignItems: 'flex-end',
                  gap: 8,
                }}
              >
                {/* Assistant avatar */}
                {msg.role === 'assistant' && (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: '#B0122C',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 8,
                      letterSpacing: 0.3,
                      flexShrink: 0,
                    }}
                  >
                    ELS
                  </div>
                )}

                <div
                  style={{
                    maxWidth: '75%',
                    padding: '12px 16px',
                    fontSize: 14,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    borderRadius:
                      msg.role === 'user'
                        ? '18px 18px 4px 18px'
                        : '18px 18px 18px 4px',
                    background:
                      msg.role === 'user' ? '#B0122C' : '#ffffff',
                    color:
                      msg.role === 'user' ? '#ffffff' : '#0f172a',
                    border:
                      msg.role === 'assistant'
                        ? '1px solid rgba(15,23,42,0.06)'
                        : 'none',
                    boxShadow:
                      msg.role === 'user'
                        ? '0 2px 8px rgba(176,18,44,0.15)'
                        : '0 1px 3px rgba(15,23,42,0.04)',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                marginBottom: 12,
                alignItems: 'flex-end',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: '#B0122C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 8,
                  flexShrink: 0,
                }}
              >
                ELS
              </div>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  background: '#ffffff',
                  border: '1px solid rgba(15,23,42,0.06)',
                  display: 'flex',
                  gap: 4,
                  alignItems: 'center',
                }}
              >
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#94a3b8',
                      animation: 'dotPulse 1.4s infinite ease-in-out',
                      animationDelay: `${dot * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Escalation form */}
      {showEscalationForm && conversationId && (
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '0 20px' }}>
          <EscalationForm
            conversationId={conversationId}
            issueSummary={escalationSummary}
            onSubmit={() => {
              setShowEscalationForm(false);
            }}
          />
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          background: '#ffffff',
          borderTop: '1px solid rgba(15,23,42,0.06)',
          padding: '14px 20px',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
          }}
        >
          {isEscalated ? (
            <div
              style={{
                flex: 1,
                padding: '14px 16px',
                background: '#f5f5f0',
                borderRadius: 16,
                fontSize: 13,
                color: '#94a3b8',
                fontWeight: 500,
                textAlign: 'center',
              }}
            >
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
                  flex: 1,
                  resize: 'none',
                  border: '1px solid rgba(15,23,42,0.08)',
                  borderRadius: 16,
                  padding: '12px 16px',
                  fontSize: 14,
                  outline: 'none',
                  color: '#0f172a',
                  background: '#fafaf9',
                  minHeight: 48,
                  maxHeight: 120,
                  lineHeight: 1.5,
                  transition: 'border-color 0.15s ease',
                  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(176,18,44,0.3)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(15,23,42,0.08)';
                }}
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
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background:
                    !input.trim() || isInputDisabled
                      ? '#d1d5db'
                      : '#B0122C',
                  color: '#ffffff',
                  border: 'none',
                  cursor:
                    !input.trim() || isInputDisabled
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                <svg
                  width="18"
                  height="18"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12h14M12 5l7 7-7 7"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
