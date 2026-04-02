'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import EscalationForm from '@/components/EscalationForm';

/* ─── types ─── */
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  tier: string;
  status: string;
  category: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── LeftSidebar ─── */
function LeftSidebar({
  conversations,
  conversationId,
  onNewChat,
  onSelectConversation,
  onLogout,
}: {
  conversations: Conversation[];
  conversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (c: Conversation) => void;
  onLogout: () => void;
}) {
  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: 16,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Brand header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: '#991b1b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          ELS
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1.2,
            }}
          >
            Electronic Locksmith
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            Customer Support
          </div>
        </div>
      </div>

      {/* Customer badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          borderRadius: 8,
          padding: '4px 10px',
          alignSelf: 'flex-start',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#16a34a',
          }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#065f46' }}>
          Customer
        </span>
      </div>

      {/* New chat button */}
      <button
        onClick={onNewChat}
        style={{
          width: '100%',
          padding: '8px 0',
          fontSize: 13,
          fontWeight: 600,
          color: '#ffffff',
          background: '#991b1b',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <svg
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        New Chat
      </button>

      {/* Conversations list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 10px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              background:
                conversationId === conv.id ? '#fee2e2' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: '#0f172a',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {conv.title || 'Untitled'}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 3,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background:
                    conv.status === 'escalated'
                      ? '#f59e0b'
                      : conv.status === 'resolved'
                      ? '#16a34a'
                      : '#3b82f6',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {conv.status === 'escalated'
                  ? 'Escalated'
                  : conv.status === 'resolved'
                  ? 'Resolved'
                  : 'In Progress'}
              </span>
            </div>
          </button>
        ))}

        {conversations.length === 0 && (
          <p
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: '#94a3b8',
              padding: '32px 0',
            }}
          >
            No conversations yet
          </p>
        )}
      </div>

      {/* Usage guidelines */}
      <div
        style={{
          background: '#f8fafc',
          borderRadius: 10,
          padding: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#0f172a',
            marginBottom: 6,
          }}
        >
          Support Guidelines
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 14,
            fontSize: 11,
            color: '#64748b',
            lineHeight: 1.5,
          }}
        >
          <li>Describe your lock issue clearly</li>
          <li>Include model/serial numbers if known</li>
          <li>Note any error codes or lights</li>
        </ul>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        style={{
          width: '100%',
          padding: '8px 0',
          fontSize: 12,
          fontWeight: 500,
          color: '#64748b',
          background: 'transparent',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        Sign out
      </button>
    </div>
  );
}

/* ─── ChatPage (main) ─── */
export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [escalationSummary, setEscalationSummary] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  /* fetch conversations */
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* load a conversation */
  const loadConversation = (conv: Conversation) => {
    setConversationId(conv.id);
    setIsEscalated(conv.status === 'escalated');
    setShowEscalationForm(false);
    setMessages([
      {
        role: 'assistant',
        content: `Continuing conversation: "${conv.title}"\n\nPlease send a message to continue.`,
      },
    ]);
    setInput('');
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setIsEscalated(false);
    setShowEscalationForm(false);
    setEscalationSummary('');
    setInput('');
    inputRef.current?.focus();
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  /* send message via SSE */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
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
                fetchConversations();
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

  /* ─── render ─── */
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        height: '100vh',
        background: '#f8fafc',
      }}
    >
      {/* Left sidebar */}
      <LeftSidebar
        conversations={conversations}
        conversationId={conversationId}
        onNewChat={startNewChat}
        onSelectConversation={loadConversation}
        onLogout={handleLogout}
      />

      {/* Right panel */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: 1,
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Chat header */}
          <div
            style={{
              padding: '12px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              ELS
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                SALTO Customer Support
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                ELS Customer Care Agent
              </div>
            </div>
            {/* Status indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isEscalated ? '#ef4444' : '#16a34a',
                }}
              />
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {isEscalated ? 'Escalated' : 'Online'}
              </span>
            </div>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Welcome / status text when empty */}
            {messages.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 16,
                  }}
                >
                  ELS
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                >
                  SALTO Customer Support
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#64748b',
                    textAlign: 'center',
                    maxWidth: 340,
                    lineHeight: 1.5,
                  }}
                >
                  Online. Describe your lock issue and we&apos;ll help resolve
                  it.
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent:
                    msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    borderRadius:
                      msg.role === 'user'
                        ? '14px 14px 4px 14px'
                        : '14px 14px 14px 4px',
                    background:
                      msg.role === 'user' ? '#991b1b' : '#f1f5f9',
                    color:
                      msg.role === 'user' ? '#ffffff' : '#0f172a',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '14px 14px 14px 4px',
                    background: '#f1f5f9',
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  {[0, 1, 2].map((dot) => (
                    <span
                      key={dot}
                      style={{
                        width: 6,
                        height: 6,
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

          {/* Escalation form */}
          {showEscalationForm && conversationId && (
            <EscalationForm
              conversationId={conversationId}
              issueSummary={escalationSummary}
              onSubmit={() => {
                setShowEscalationForm(false);
                fetchConversations();
              }}
            />
          )}

          {/* Input area */}
          <div
            style={{
              padding: '12px 14px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isEscalated
                  ? 'This conversation has been escalated'
                  : 'Describe your SALTO lock issue...'
              }
              disabled={isLoading || isEscalated}
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '8px 12px',
                fontSize: 13,
                outline: 'none',
                color: '#0f172a',
                background: isEscalated ? '#f8fafc' : '#ffffff',
                maxHeight: 120,
                lineHeight: 1.5,
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isLoading || isEscalated}
              style={{
                background:
                  !input.trim() || isLoading || isEscalated
                    ? '#d1d5db'
                    : '#991b1b',
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: 600,
                cursor:
                  !input.trim() || isLoading || isEscalated
                    ? 'not-allowed'
                    : 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
