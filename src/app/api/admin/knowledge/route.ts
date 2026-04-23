import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'els_super_secret_admin_key_2026';

const VECTOR_STORES: Record<string, { id: string; label: string }> = {
  tier1: {
    id: process.env.TIER1_VECTOR_STORE_ID || 'vs_69a605906b4c8191ae6a923869abb4c8',
    label: 'Tier 1 — Customer Support (Top 8 Topics)',
  },
  tier2: {
    id: process.env.TIER2_VECTOR_STORE_ID || 'vs_695e9b3d06c481919e8733f807588df3',
    label: 'Tier 2 — Technical Support (Full SALTO KB)',
  },
};

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function checkAuth(req: NextRequest): boolean {
  const secret =
    req.headers.get('x-admin-secret') ||
    req.nextUrl.searchParams.get('secret');
  return secret === ADMIN_SECRET;
}

// GET /api/admin/knowledge?tier=tier1|tier2
// Returns vector store info + file list
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const tier = req.nextUrl.searchParams.get('tier') || 'tier1';
  const store = VECTOR_STORES[tier];
  if (!store) {
    return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
  }

  try {
    const openai = getOpenAI();

    // Fetch vector store metadata
    const vs = await openai.vectorStores.retrieve(store.id);

    // Fetch files in the vector store
    const filesResponse = await openai.vectorStores.files.list(store.id, { limit: 100 });
    const vsFiles = filesResponse.data;

    // Fetch full file details for each
    const files = await Promise.all(
      vsFiles.map(async (vsFile) => {
        try {
          const file = await openai.files.retrieve(vsFile.id);
          return {
            id: file.id,
            filename: file.filename,
            bytes: file.bytes,
            created_at: file.created_at,
            status: vsFile.status,
          };
        } catch {
          return {
            id: vsFile.id,
            filename: '(unable to retrieve)',
            bytes: 0,
            created_at: vsFile.created_at,
            status: vsFile.status,
          };
        }
      })
    );

    return NextResponse.json({
      tier,
      label: store.label,
      vector_store: {
        id: vs.id,
        name: vs.name,
        status: vs.status,
        file_counts: vs.file_counts,
        usage_bytes: vs.usage_bytes,
        created_at: vs.created_at,
      },
      files: files.sort((a, b) => a.filename.localeCompare(b.filename)),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/admin/knowledge?tier=tier1&fileId=file-xxx
// Removes a file from the vector store
export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return unauthorized();

  const tier = req.nextUrl.searchParams.get('tier') || 'tier1';
  const fileId = req.nextUrl.searchParams.get('fileId');
  const store = VECTOR_STORES[tier];

  if (!store) {
    return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
  }
  if (!fileId) {
    return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
  }

  try {
    const openai = getOpenAI();
    // Remove from vector store
    await openai.vectorStores.files.delete(fileId, { vector_store_id: store.id });
    // Also delete the underlying file object
    try {
      await openai.files.delete(fileId);
    } catch {
      // File may already be deleted or shared — ignore
    }
    return NextResponse.json({ success: true, deleted: fileId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
