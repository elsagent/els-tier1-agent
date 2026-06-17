'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Legacy-URL shim. This Next.js app (els-customer = tier1, els-tech = tier2) keeps
 * its same Railway URL + `next build`/`next start` config, but now serves the
 * durable, provider-agnostic widget by framing the canonical widget host. This
 * guarantees exact brand parity with the rest of the durable stack (it *is* the
 * same widget) and avoids duplicating chat logic across repos.
 *
 * Resilience: if the primary widget host (Railway) doesn't post "els-widget-ready"
 * within READY_TIMEOUT_MS, we fail over to the backup host (Fly). The durable
 * backend itself fails over OpenAI -> Claude -> Groq server-side, so this covers
 * the remaining "front-end host is down" case.
 */
const PRIMARY_HOST =
  process.env.NEXT_PUBLIC_WIDGET_HOST ||
  'https://els-frontend-durable-production.up.railway.app';
const FALLBACK_HOST =
  process.env.NEXT_PUBLIC_WIDGET_FALLBACK_HOST || 'https://els-widget-fly.fly.dev';

const READY_TIMEOUT_MS = 6000;

function origin(u: string): string {
  try { return new URL(u).origin; } catch { return u.replace(/\/+$/, ''); }
}
function srcFor(host: string, tier: string): string {
  return origin(host) + '/?tier=' + encodeURIComponent(tier);
}

export default function DurableAgentFrame({ tier }: { tier: string }) {
  const hosts = [PRIMARY_HOST, FALLBACK_HOST].filter(Boolean);
  const [hostIdx, setHostIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  // Fail over to the next host if "ready" doesn't arrive in time.
  useEffect(() => {
    readyRef.current = false;
    setReady(false);
    if (hostIdx + 1 >= hosts.length) return;
    const t = setTimeout(() => {
      if (!readyRef.current) setHostIdx((i) => i + 1);
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [hostIdx, hosts.length]);

  // Listen for the framed widget's health ping (from any of our hosts).
  useEffect(() => {
    const allowed = hosts.map(origin);
    function onMsg(e: MessageEvent) {
      if (allowed.indexOf(e.origin) === -1 || !e.data) return;
      if (e.data.type === 'els-widget-ready') {
        readyRef.current = true;
        setReady(true);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hosts]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#ffffff',
        overflow: 'hidden',
      }}
    >
      {!ready && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              border: '3px solid rgba(200,16,46,.18)',
              borderTopColor: '#C8102E',
              borderRadius: '50%',
              animation: 'els-spin 0.8s linear infinite',
            }}
          />
          <style>{'@keyframes els-spin{to{transform:rotate(360deg)}}'}</style>
        </div>
      )}
      <iframe
        key={hostIdx}
        src={srcFor(hosts[hostIdx], tier)}
        title="Electronic Locksmith support chat"
        allow="clipboard-write"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}
