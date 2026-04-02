import { createClient } from '@/lib/supabase/server';
import { openai } from '@/lib/openai';
import { runTriage } from '@/lib/agents/triage';
import { runTier1 } from '@/lib/agents/tier1';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { message, conversationId } = body as {
      message: string;
      conversationId?: string;
    };

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let threadId: string;
    let convId: string;
    let currentTier: string;

    if (conversationId) {
      // Fetch existing conversation
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single();

      if (error || !conversation) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      threadId = conversation.thread_id;
      convId = conversation.id;
      currentTier = conversation.tier;
    } else {
      // Create a new OpenAI thread and conversation
      const thread = await openai.beta.threads.create();
      threadId = thread.id;

      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          thread_id: threadId,
          tier: 'triage',
          status: 'active',
          title: message.slice(0, 80),
        })
        .select()
        .single();

      if (error || !newConv) {
        return new Response(
          JSON.stringify({ error: 'Failed to create conversation' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      convId = newConv.id;
      currentTier = 'triage';
    }

    // Save the user message
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);

    // Create the SSE stream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Send conversationId immediately so client can track it
          send({ type: 'meta', conversationId: convId });

          let fullAssistantMessage = '';

          if (currentTier === 'triage') {
            // --- TRIAGE PHASE ---
            const triageResult = await runTriage(threadId, message);

            if (triageResult.tier === 'tier1') {
              // Update conversation to tier1
              await supabase
                .from('conversations')
                .update({
                  tier: 'tier1',
                  category: triageResult.category,
                })
                .eq('id', convId);

              // Run tier1 to start resolution (pass null since triage already added the message)
              const tier1Stream = runTier1(threadId, null);

              for await (const chunk of tier1Stream) {
                if (chunk === '[ESCALATE]') {
                  // Tier1 decided to escalate
                  await supabase
                    .from('conversations')
                    .update({ status: 'escalated', tier: 'escalate' })
                    .eq('id', convId);
                  send({ type: 'escalate', content: 'This issue requires human support. Please provide your contact information.' });
                  break;
                }
                fullAssistantMessage += chunk;
                send({ type: 'text', content: chunk });
              }
            } else {
              // Escalate
              await supabase
                .from('conversations')
                .update({ status: 'escalated', tier: 'escalate' })
                .eq('id', convId);

              const escalateMsg =
                'This issue requires specialized support from our team. Please provide your contact details so we can follow up.';
              fullAssistantMessage = escalateMsg;
              send({
                type: 'escalate',
                content: escalateMsg,
                summary: triageResult.summary,
              });
            }
          } else if (currentTier === 'tier1') {
            // --- TIER 1 PHASE ---
            const tier1Stream = runTier1(threadId, message);

            for await (const chunk of tier1Stream) {
              if (chunk === '[ESCALATE]') {
                await supabase
                  .from('conversations')
                  .update({ status: 'escalated', tier: 'escalate' })
                  .eq('id', convId);
                send({ type: 'escalate', content: 'This issue requires human support. Please provide your contact information.' });
                break;
              }
              fullAssistantMessage += chunk;
              send({ type: 'text', content: chunk });
            }
          } else {
            // Already escalated or unknown tier
            const msg =
              'This conversation has been escalated to our support team. Please provide your contact information if you haven\'t already.';
            fullAssistantMessage = msg;
            send({ type: 'escalate', content: msg });
          }

          // Save assistant message if we have one
          if (fullAssistantMessage) {
            await supabase.from('messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: fullAssistantMessage,
            });
          }

          send({ type: 'done', conversationId: convId });
        } catch (err) {
          console.error('Chat stream error:', err);
          send({
            type: 'error',
            content: 'An error occurred while processing your message. Please try again.',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
