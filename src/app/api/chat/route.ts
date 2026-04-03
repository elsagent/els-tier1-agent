import { createClient } from '@/lib/supabase/server';
import { openai } from '@/lib/openai';
import { runTriage } from '@/lib/agents/triage';
import { runTier1 } from '@/lib/agents/tier1';
import { runTier2 } from '@/lib/agents/tier2';

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

    let convId: string;
    let threadId: string;
    let currentTier: string = 'triage';

    if (conversationId) {
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

      convId = conversation.id;
      threadId = conversation.thread_id;
      currentTier = conversation.tier || 'triage';

      if (conversation.status === 'escalated') {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const send = (data: Record<string, unknown>) => {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };
            send({ type: 'meta', conversationId: convId });
            send({ type: 'escalate', content: 'This conversation has been escalated to our support team. Please provide your contact information if you haven\'t already.' });
            send({ type: 'done', conversationId: convId });
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        });
      }
    } else {
      // Create OpenAI thread
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
    }

    // Save the user message
    await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    });

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', convId);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          send({ type: 'meta', conversationId: convId });

          let fullAssistantMessage = '';
          let isEscalated = false;

          if (currentTier === 'triage') {
            // Run triage to classify the issue
            const triageResult = await runTriage(threadId, message);

            send({
              type: 'triage',
              tier: triageResult.tier,
              category: triageResult.category,
              confidence: triageResult.confidence,
            });

            if (triageResult.tier === 'escalate') {
              // Update conversation and prompt escalation
              await supabase
                .from('conversations')
                .update({ status: 'escalated', tier: 'escalate', category: triageResult.category })
                .eq('id', convId);

              isEscalated = true;
              fullAssistantMessage = `I understand you're experiencing an issue with: ${triageResult.summary}. This requires assistance from our specialized support team. Let me connect you with a human technician who can help.`;
              send({ type: 'text', content: fullAssistantMessage });
              send({ type: 'escalate', content: fullAssistantMessage });
            } else {
              // Route to tier1 or tier2 — run on the SAME thread for context continuity
              const tier = triageResult.tier; // 'tier1' or 'tier2'

              await supabase
                .from('conversations')
                .update({ tier, category: triageResult.category })
                .eq('id', convId);

              // The triage agent already consumed the user message on this thread,
              // so pass null to avoid duplicating it
              const agentRunner = tier === 'tier2' ? runTier2 : runTier1;

              for await (const chunk of agentRunner(threadId, null)) {
                if (chunk === '[ESCALATE]') {
                  isEscalated = true;
                  await supabase
                    .from('conversations')
                    .update({ status: 'escalated', tier: 'escalate' })
                    .eq('id', convId);
                  continue;
                }

                if (isEscalated) {
                  fullAssistantMessage += chunk;
                  send({ type: 'escalate', content: chunk });
                } else {
                  fullAssistantMessage += chunk;
                  send({ type: 'text', content: chunk });
                }
              }
            }
          } else if (currentTier === 'tier1' || currentTier === 'tier2') {
            // Continuing conversation in assigned tier
            const agentRunner = currentTier === 'tier2' ? runTier2 : runTier1;

            for await (const chunk of agentRunner(threadId, message)) {
              if (chunk === '[ESCALATE]') {
                isEscalated = true;
                await supabase
                  .from('conversations')
                  .update({ status: 'escalated', tier: 'escalate' })
                  .eq('id', convId);
                continue;
              }

              if (isEscalated) {
                fullAssistantMessage += chunk;
                send({ type: 'escalate', content: chunk });
              } else {
                fullAssistantMessage += chunk;
                send({ type: 'text', content: chunk });
              }
            }
          }

          // Save assistant message
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
