'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SupportLandingPage() {
  const router = useRouter();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoverLogout, setHoverLogout] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#fafaf9',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          height: 56,
          background: '#ffffff',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            ELS Support
          </span>
        </div>
        <button
          onClick={handleLogout}
          onMouseEnter={() => setHoverLogout(true)}
          onMouseLeave={() => setHoverLogout(false)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(15,23,42,0.08)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            ...(hoverLogout
              ? { borderColor: 'rgba(15,23,42,0.15)', color: '#0f172a' }
              : {}),
          }}
        >
          Sign out
        </button>
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: 0.5,
            marginBottom: 24,
            boxShadow: '0 8px 32px rgba(176,18,44,0.2)',
          }}
        >
          ELS
        </div>

        <h1
          style={{
            margin: '0 0 8px 0',
            fontSize: 28,
            fontWeight: 700,
            color: '#0f172a',
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}
        >
          Welcome to ELS Support
        </h1>
        <p
          style={{
            margin: '0 0 40px 0',
            fontSize: 16,
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          Choose your support level
        </p>

        {/* Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
            maxWidth: 680,
            width: '100%',
          }}
        >
          {/* Tier 1 Card */}
          <button
            onClick={() => router.push('/tier1')}
            onMouseEnter={() => setHoveredCard('tier1')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: '#ffffff',
              border: hoveredCard === 'tier1' ? '2px solid #B0122C' : '2px solid rgba(15,23,42,0.06)',
              borderRadius: 16,
              padding: '32px 28px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.25s ease',
              boxShadow:
                hoveredCard === 'tier1'
                  ? '0 8px 32px rgba(176,18,44,0.12), 0 2px 8px rgba(15,23,42,0.06)'
                  : '0 1px 3px rgba(15,23,42,0.06)',
              transform: hoveredCard === 'tier1' ? 'translateY(-2px)' : 'translateY(0)',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth={1.8}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V7a4 4 0 118 0v4" />
              </svg>
            </div>

            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: 19,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Quick Support
            </h2>
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: 14,
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              Get help with common lock issues — battery changes, kiosk mode, key programming, and more
            </p>

            {/* Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 20,
                padding: '4px 12px',
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
              <span style={{ fontSize: 12, fontWeight: 600, color: '#065f46' }}>
                ~2 min response
              </span>
            </div>
          </button>

          {/* Tier 2 Card */}
          <button
            onClick={() => router.push('/tier2')}
            onMouseEnter={() => setHoveredCard('tier2')}
            onMouseLeave={() => setHoveredCard(null)}
            style={{
              background: '#ffffff',
              border: hoveredCard === 'tier2' ? '2px solid #B0122C' : '2px solid rgba(15,23,42,0.06)',
              borderRadius: 16,
              padding: '32px 28px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.25s ease',
              boxShadow:
                hoveredCard === 'tier2'
                  ? '0 8px 32px rgba(176,18,44,0.12), 0 2px 8px rgba(15,23,42,0.06)'
                  : '0 1px 3px rgba(15,23,42,0.06)',
              transform: hoveredCard === 'tier2' ? 'translateY(-2px)' : 'translateY(0)',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #B0122C 0%, #D4365C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#ffffff" strokeWidth={1.8}>
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
            </div>

            <h2
              style={{
                margin: '0 0 8px 0',
                fontSize: 19,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Technical Support
            </h2>
            <p
              style={{
                margin: '0 0 16px 0',
                fontSize: 14,
                color: '#64748b',
                lineHeight: 1.6,
              }}
            >
              Advanced troubleshooting for network, integration, and complex system issues
            </p>

            {/* Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 20,
                padding: '4px 12px',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#f59e0b',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                ~5 min response
              </span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: 48,
            fontSize: 13,
            color: '#94a3b8',
            textAlign: 'center',
          }}
        >
          Powered by ELS AI &bull; Available 24/7
        </p>
      </main>
    </div>
  );
}
