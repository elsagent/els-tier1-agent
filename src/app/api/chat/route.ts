import { createClient } from '@/lib/supabase/server';
import { runTier1 } from '@/lib/agents/tier1';
import { runTier2 } from '@/lib/agents/tier2';
import { classify, cannedResponseFor, type SafetyClass } from '@/lib/agents/classifier';
import { checkRate } from '@/lib/rate_limit';

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

    // Rate limit per user. Uses Upstash if configured, in-memory fallback otherwise.
    const rl = await checkRate(userId);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({
          error: `rate limit exceeded (${rl.scope})`,
          limit: rl.limit,
          reset: rl.reset,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.max(1, rl.reset - Math.floor(Date.now() / 1000))),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rl.reset),
          },
        }
      );
    }

    let convId: string;
    // thread_id column now stores previous_response_id for Responses API continuity
    let previousResponseId: string | null = null;
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
      // thread_id now stores the previous_response_id
      previousResponseId = conversation.thread_id || null;
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
      // No thread creation needed — Responses API uses previous_response_id
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          thread_id: '', // Will be updated with first response_id
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

    // Safety + scope classification (pre-filter). Fails open to 'ok'.
    const safetyClass: SafetyClass = await classify(message);

    // Save the user message (with classification if the column exists).
    // Attempt with safety_class first; if the column doesn't exist yet,
    // retry without it so the pipeline still works before the migration lands.
    const userInsert = await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
      safety_class: safetyClass,
    });
    if (userInsert.error && /safety_class/i.test(userInsert.error.message)) {
      await supabase.from('messages').insert({
        conversation_id: convId,
        role: 'user',
        content: message,
      });
    }

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
          send({ type: 'meta', conversationId: convId, safetyClass });

          let fullAssistantMessage = '';
          let isEscalated = false;
          let isEscalatedToTier2 = false;
          let latestResponseId: string | null = previousResponseId;
          const retrievedSources = new Set<string>();
          let tokenUsage: Record<string, unknown> | null = null;

          // Short-circuit on non-ok classifications. Emergencies also escalate
          // the conversation to a human so the support team follows up.
          if (safetyClass !== 'ok') {
            const canned = cannedResponseFor(safetyClass) || '';
            fullAssistantMessage = canned;

            if (safetyClass === 'emergency') {
              isEscalated = true;
              await supabase
                .from('conversations')
                .update({ status: 'escalated', tier: 'escalate' })
                .eq('id', convId);
              send({ type: 'escalate', content: canned, summary: canned, safetyClass });
            } else {
              send({ type: 'text', content: canned, safetyClass });
            }

            const assistantInsert = await supabase.from('messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: canned,
              safety_class: safetyClass,
            });
            if (assistantInsert.error && /safety_class/i.test(assistantInsert.error.message)) {
              await supabase.from('messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: canned,
              });
            }

            send({ type: 'done', conversationId: convId });
            controller.close();
            return;
          }

          // Determine which agent to run based on current tier
          const agentRunner = currentTier === 'tier2' ? runTier2 : runTier1;

          for await (const chunk of agentRunner(previousResponseId, message)) {
            // Capture response ID for conversation continuity
            if (chunk.startsWith('[RESPONSE_ID:')) {
              const rid = chunk.slice('[RESPONSE_ID:'.length, -1);
              latestResponseId = rid;
              // Update conversation with the latest response ID (stored in thread_id column)
              await supabase
                .from('conversations')
                .update({ thread_id: rid })
                .eq('id', convId);
              continue;
            }

            // Capture cited source filenames from file_search annotations
            if (chunk.startsWith('[SOURCE:')) {
              retrievedSources.add(chunk.slice('[SOURCE:'.length, -1));
              continue;
            }

            // Capture OpenAI usage payload (input/output/cached tokens, model)
            if (chunk.startsWith('[USAGE:')) {
              try {
                tokenUsage = JSON.parse(chunk.slice('[USAGE:'.length, -1));
              } catch {
                // keep tokenUsage null — persistence will fall back gracefully
              }
              continue;
            }

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
                // Now run Tier 2 agent with context (fresh conversation, no previous_response_id from Tier 1)
                const tier2Message = `[Escalated from Quick Support] Previous conversation context: ${escalationData.summary}. Please continue helping this customer with their issue.`;

                let tier2FullMessage = '';
                for await (const t2chunk of runTier2(null, tier2Message)) {
                  // Capture Tier 2 response ID
                  if (t2chunk.startsWith('[RESPONSE_ID:')) {
                    const rid = t2chunk.slice('[RESPONSE_ID:'.length, -1);
                    latestResponseId = rid;
                    await supabase
                      .from('conversations')
                      .update({ thread_id: rid })
                      .eq('id', convId);
                    continue;
                  }

                  if (t2chunk.startsWith('[SOURCE:')) {
                    retrievedSources.add(t2chunk.slice('[SOURCE:'.length, -1));
                    continue;
                  }

                  if (t2chunk.startsWith('[USAGE:')) {
                    try {
                      tokenUsage = JSON.parse(t2chunk.slice('[USAGE:'.length, -1));
                    } catch {}
                    continue;
                  }

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

          // Save assistant message with per-turn metadata. Degrades gracefully
          // if the 20260422_add_turn_metadata migration hasn't been applied yet.
          if (fullAssistantMessage) {
            const sourcesArr = retrievedSources.size ? Array.from(retrievedSources) : null;
            const fullPayload = {
              conversation_id: convId,
              role: 'assistant' as const,
              content: fullAssistantMessage,
              safety_class: 'ok',
              retrieved_sources: sourcesArr,
              token_usage: tokenUsage,
              response_id: latestResponseId,
            };
            const r = await supabase.from('messages').insert(fullPayload);
            if (r.error && /(retrieved_sources|token_usage|response_id|safety_class)/i.test(r.error.message)) {
              // Retry without the columns that don't exist yet
              await supabase.from('messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: fullAssistantMessage,
              });
              console.warn('[chat] persisted assistant message without turn metadata — apply migration 20260422_add_turn_metadata');
            }
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
