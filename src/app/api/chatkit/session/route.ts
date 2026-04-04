import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey: key });
}

interface SessionRequestBody {
  workflow: { id: string };
  user: string;
  conversation?: string;
}

/**
 * POST /api/chatkit/session
 * Creates a ChatKit session via OpenAI's beta chatkit API.
 * Returns { client_secret, session_id } for the frontend ChatKit widget.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SessionRequestBody;

    if (!body.workflow?.id || !body.user) {
      return NextResponse.json(
        { error: 'workflow.id and user are required' },
        { status: 400 }
      );
    }

    const client = getOpenAIClient();

    // Use the OpenAI beta chatkit sessions API
    const session = await (client.beta as any).chatkit.sessions.create({
      user: body.user,
      workflow: {
        id: body.workflow.id,
        ...(body.conversation
          ? { state_variables: { conversation: body.conversation } }
          : {}),
      },
    });

    return NextResponse.json({
      client_secret: session.client_secret,
      session_id: session.id,
    });
  } catch (err: any) {
    console.error('ChatKit session creation failed:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}
