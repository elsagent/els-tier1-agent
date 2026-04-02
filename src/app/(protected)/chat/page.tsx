'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ChatWindow from '@/components/ChatWindow';
import EscalationForm from '@/components/EscalationForm';

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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [escalationSummary, setEscalationSummary] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/session');
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load a previous conversation's messages
  const loadConversation = async (conv: Conversation) => {
    setConversationId(conv.id);
    setIsEscalated(conv.status === 'escalated');
    setShowEscalationForm(false);
    setMessages([]);
    setInput('');

    // We don't have a messages endpoint yet, so just set the conversation
    // In production, you'd fetch messages from /api/messages?conversationId=...
    // For now, show a placeholder
    setMessages([
      {
        role: 'assistant',
        content: `Continuing conversation: "${conv.title}"\n\nPlease send a message to continue.`,
      },
    ]);
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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || isEscalated) return;

    // Add user message
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

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

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
        // Keep the last incomplete line in the buffer
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
                // Refresh conversation list
                fetchConversations();
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, something went wrong. Please try again.',
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

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-0'
        } transition-all duration-200 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden`}
      >
        <div className="p-3 border-b border-gray-200">
          <button
            onClick={startNewChat}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
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
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv)}
              className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-100 transition-colors ${
                conversationId === conv.id ? 'bg-blue-50' : ''
              }`}
            >
              <p className="text-sm font-medium text-gray-900 truncate">
                {conv.title || 'Untitled'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    conv.status === 'escalated'
                      ? 'bg-amber-500'
                      : conv.status === 'resolved'
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                />
                <span className="text-xs text-gray-500">
                  {conv.status === 'escalated'
                    ? 'Escalated'
                    : conv.status === 'resolved'
                    ? 'Resolved'
                    : conv.tier === 'tier1'
                    ? 'In Progress'
                    : 'Triaging'}
                </span>
              </div>
            </button>
          ))}

          {conversations.length === 0 && (
            <p className="px-4 py-8 text-sm text-gray-400 text-center">
              No conversations yet
            </p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-gray-700 transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h1 className="text-lg font-semibold tracking-wide">
              SALTO Support
            </h1>
          </div>

          {isEscalated && (
            <span className="ml-auto text-xs bg-amber-500 text-white px-2.5 py-1 rounded-full font-medium">
              Escalated
            </span>
          )}
        </header>

        {/* Messages */}
        <ChatWindow messages={messages} isLoading={isLoading} />

        {/* Escalation Form */}
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

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-4 shrink-0">
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-3 max-w-4xl mx-auto"
          >
            <div className="flex-1 relative">
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
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 placeholder:text-gray-400"
                style={{ maxHeight: '120px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading || isEscalated}
              className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              aria-label="Send message"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-2">
            SALTO Electronic Lock Support - Powered by AI
          </p>
        </div>
      </div>
    </div>
  );
}
