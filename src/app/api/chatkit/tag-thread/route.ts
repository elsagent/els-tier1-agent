import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/chatkit/tag-thread
// Body: { thread_id: string, tier: 'tier1'|'tier2'|'tier3', workflow_id?: string }
// Records which tier a ChatKit thread came from. Idempotent (PK on thread_id).
export async function POST(req: NextRequest) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Supabase env missing' }, { status: 500 });
    }

    const { thread_id, tier, workflow_id } = await req.json();
    if (!thread_id || !['tier1', 'tier2', 'tier3'].includes(tier)) {
      return NextResponse.json({ error: 'thread_id and valid tier required' }, { status: 400 });
    }

    const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/chatkit_thread_tiers`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify({ thread_id, tier, workflow_id: workflow_id ?? null }),
    });

    if (!r.ok && r.status !== 409) {
      const text = await r.text();
      return NextResponse.json({ error: 'Supabase insert failed', detail: text }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
