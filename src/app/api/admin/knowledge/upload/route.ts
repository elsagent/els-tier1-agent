import { NextRequest, NextResponse } from 'next/server';
import { getOpenAI } from '@/lib/openai';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'els_super_secret_admin_key_2026';

const VECTOR_STORES: Record<string, string> = {
  tier1: process.env.TIER1_VECTOR_STORE_ID || 'vs_69a605906b4c8191ae6a923869abb4c8',
  tier2: process.env.TIER2_VECTOR_STORE_ID || 'vs_695e9b3d06c481919e8733f807588df3',
};

export const runtime = 'nodejs';

// POST /api/admin/knowledge/upload
// Multipart form: secret, tier, file(s)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const secret = formData.get('secret') as string;

    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tier = (formData.get('tier') as string) || 'tier1';
    const storeId = VECTOR_STORES[tier];
    if (!storeId) {
      return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
    }

    const files = formData.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const openai = getOpenAI();
    const results = [];

    for (const file of files) {
      // Upload file to OpenAI
      const uploaded = await openai.files.create({
        file,
        purpose: 'assistants',
      });

      // Attach to vector store
      await openai.vectorStores.files.create(storeId, {
        file_id: uploaded.id,
      });

      results.push({
        id: uploaded.id,
        filename: uploaded.filename,
        bytes: uploaded.bytes,
      });
    }

    return NextResponse.json({ success: true, uploaded: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
