import { createClient } from '@/lib/supabase/server';
import { openai } from '@/lib/openai';
import { runTier1 } from '@/lib/agents/tier1';
import { runTier2 } from '@/lib/agents/tier2';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Anonymous user ID for unauthenticated sessions
const ANON_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Try to get user but don't require auth
    let userId = ANON_USER_ID;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    } catch {
      // continue as anonymous
    }

    const body = await request.json();
    const { message, conversationId, tier } = body as {
      message: string;
      conversationId?: string;
      tier?: 'tier1' | 'tier2';
    };

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!tier || (tier !== 'tier1' && tier !== 'tier2')) {
      return new Response(
        JSON.stringify({ error: 'Valid tier (tier1 or tier2) is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let convId: string;
    let threadId: string;
    let currentTier: string = tier;

    if (conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();

      if (error || !conversation) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      convId = conversation.id;
      threadId = conversation.thread_id;
      currentTier = conversation.tier || tier;

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
          user_id: userId,
          thread_id: threadId,
          tier: tier,
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
          let isEscalatedToTier2 = false;

          // Determine which agent to run based on current tier
          const agentRunner = currentTier === 'tier2' ? runTier2 : runTier1;

          for await (const chunk of agentRunner(threadId, message)) {
            // Handle Tier 1 -> Tier 2 escalation
            if (chunk === '[ESCALATE_TO_TIER2]') {
              isEscalatedToTier2 = true;

              // Update conversation tier in Supabase
              await supabase
                .from('conversations')
                .update({ tier: 'tier2' })
                .eq('id', convId);

              // Send escalation event to client
              send({
                type: 'tier2_escalation',
                content: 'This issue needs our technical team. Transferring you now...',
              });

              continue;
            }

            // If we just got the escalation signal, next chunk is the summary JSON
            if (isEscalatedToTier2 && chunk.startsWith('{')) {
              try {
                const escalationData = JSON.parse(chunk);
                // Now run Tier 2 agent with context
                const tier2Message = `[Escalated from Quick Support] Previous conversation context: ${escalationData.summary}. Please continue helping this customer with their issue.`;

                let tier2FullMessage = '';
                for await (const t2chunk of runTier2(threadId, tier2Message)) {
                  if (t2chunk === '[ESCALATE]') {
                    isEscalated = true;
                    await supabase
                      .from('conversations')
                      .update({ status: 'escalated', tier: 'escalate' })
                      .eq('id', convId);
                    continue;
                  }

                  if (isEscalated) {
                    tier2FullMessage += t2chunk;
                    send({ type: 'escalate', content: t2chunk, summary: t2chunk });
                  } else {
                    tier2FullMessage += t2chunk;
                    send({ type: 'text', content: t2chunk });
                  }
                }

                fullAssistantMessage += tier2FullMessage;
              } catch {
                // Not JSON, treat as regular text
                fullAssistantMessage += chunk;
                send({ type: 'text', content: chunk });
              }
              continue;
            }

            // Handle human escalation
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
              send({ type: 'escalate', content: chunk, summary: chunk });
            } else {
              fullAssistantMessage += chunk;
              send({ type: 'text', content: chunk });
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
