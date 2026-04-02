import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      conversationId,
      contactName,
      contactEmail,
      contactPhone,
      propertyName,
      issueSummary,
    } = body as {
      conversationId: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      propertyName?: string;
      issueSummary?: string;
    };

    if (!conversationId || !contactName) {
      return NextResponse.json(
        { error: 'conversationId and contactName are required' },
        { status: 400 }
      );
    }

    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Insert escalation record
    const { data: escalation, error: escError } = await supabase
      .from('escalations')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        contact_name: contactName,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
        property_name: propertyName || null,
        issue_summary: issueSummary || null,
      })
      .select()
      .single();

    if (escError || !escalation) {
      console.error('Escalation insert error:', escError);
      return NextResponse.json(
        { error: 'Failed to create escalation' },
        { status: 500 }
      );
    }

    // Update conversation status
    await supabase
      .from('conversations')
      .update({ status: 'escalated' })
      .eq('id', conversationId);

    return NextResponse.json({
      success: true,
      escalationId: escalation.id,
    });
  } catch (err) {
    console.error('Escalate API error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
