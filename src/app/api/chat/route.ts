import { createClient } from '@/lib/supabase/server';
import { openai } from '@/lib/openai';

export const runtime = 'nodejs';
export const maxDuration = 120;

const WORKFLOW_ID = process.env.WORKFLOW_ID || 'wf_69ceed146fa48190940573b1a7a5692b0dad21fe73446d36';

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
    let previousResponseId: string | null = null;

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

      convId = conversation.id;
      previousResponseId = conversation.thread_id; // reusing thread_id column for response_id

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
      // Create a new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          thread_id: '', // will be updated with response_id
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
          send({ type: 'meta', conversationId: convId });

          // Call the Agent Builder workflow via Responses API
          const responseParams: Record<string, unknown> = {
            workflow: { id: WORKFLOW_ID },
            input: message,
            stream: true,
          };

          if (previousResponseId) {
            responseParams.previous_response_id = previousResponseId;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const responseStream = await openai.responses.create(
            responseParams as any
          ) as unknown as AsyncIterable<any>;

          let fullAssistantMessage = '';
          let responseId = '';
          let isEscalated = false;

          for await (const event of responseStream) {
            // Capture the response ID for multi-turn
            if ('response' in event && event.response?.id) {
              responseId = event.response.id;
            }

            // Handle text deltas
            if (event.type === 'response.output_text.delta') {
              const delta = (event as { delta?: string }).delta || '';
              if (delta) {
                fullAssistantMessage += delta;
                send({ type: 'text', content: delta });
              }
            }

            // Handle completed response
            if (event.type === 'response.completed' && event.response) {
              responseId = event.response.id;

              // Check if the workflow ended (escalate branch hit the End node)
              const output = event.response.output;
              if (Array.isArray(output)) {
                for (const item of output) {
                  if (item.type === 'message' && item.content) {
                    // If we haven't streamed text yet, collect it
                    for (const block of item.content) {
                      if (block.type === 'output_text' && block.text && !fullAssistantMessage) {
                        fullAssistantMessage = block.text;
                        send({ type: 'text', content: block.text });
                      }
                    }
                  }
                }
              }

              // Detect escalation: if the workflow ended via the End node (escalate branch),
              // the response status will be 'completed' with no substantive output
              // or the Tier 1 agent's output will contain escalation signals
              const outputText = fullAssistantMessage.toLowerCase();
              if (
                outputText.includes('escalat') &&
                (outputText.includes('human') || outputText.includes('support team') || outputText.includes('contact'))
              ) {
                isEscalated = true;
              }
            }
          }

          // Store the response ID for multi-turn continuity
          if (responseId) {
            await supabase
              .from('conversations')
              .update({ thread_id: responseId })
              .eq('id', convId);
          }

          if (isEscalated) {
            await supabase
              .from('conversations')
              .update({ status: 'escalated', tier: 'escalate' })
              .eq('id', convId);
            send({ type: 'escalate', content: fullAssistantMessage || 'This issue requires human support. Please provide your contact information.' });
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
