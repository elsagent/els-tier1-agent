import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ANON_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    let userId = ANON_USER_ID;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    } catch {
      // continue as anonymous
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

    // Verify the conversation exists
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
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
        user_id: userId,
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
