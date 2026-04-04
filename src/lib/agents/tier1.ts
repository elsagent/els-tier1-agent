import { openai } from '../openai';

const TIER1_WORKFLOW_ID = process.env.WORKFLOW_ID || process.env.TIER1_WORKFLOW_ID || '';

// Strip OpenAI file_search citation annotations like 【8:2†filename.pdf】
function stripCitations(text: string): string {
  return text.replace(/【[^】]*】/g, '');
}

/**
 * Run the Tier 1 agent using the Responses API with a workflow brain.
 * Uses previous_response_id for conversation continuity instead of threads.
 */
export async function* runTier1(
  previousResponseId: string | null,
  userMessage: string
): AsyncGenerator<string, void, unknown> {
  const createParams: Record<string, unknown> = {
    model: TIER1_WORKFLOW_ID,
    input: userMessage,
    stream: true,
  };

  if (previousResponseId) {
    createParams.previous_response_id = previousResponseId;
  }

  const stream = await openai.responses.create(createParams as any);

  let responseId: string | null = null;

  for await (const event of stream as any) {
    const eventType = event?.type || '';

    if (eventType === 'response.created') {
      responseId = event.response?.id || null;
    }

    if (eventType === 'response.output_text.delta') {
      const delta = event.delta || '';
      if (delta) {
        const cleaned = stripCitations(delta);
        if (cleaned) yield cleaned;
      }
    }

    // Handle function calls from the workflow
    if (eventType === 'response.function_call_arguments.done') {
      const fnName = event.name || '';
      const fnArgs = event.arguments || '{}';

      if (fnName === 'escalate_to_tier2') {
        try {
          const args = JSON.parse(fnArgs) as { summary?: string; reason?: string };
          yield '[ESCALATE_TO_TIER2]';
          yield JSON.stringify({
            summary: args.summary || args.reason || 'Issue requires advanced troubleshooting',
          });
        } catch {
          yield '[ESCALATE_TO_TIER2]';
          yield JSON.stringify({ summary: 'Issue requires advanced troubleshooting' });
        }
      } else if (fnName === 'escalate_to_human') {
        try {
          const args = JSON.parse(fnArgs) as { summary?: string; reason?: string };
          yield '[ESCALATE]';
          yield (args.summary || args.reason || 'Issue requires human support');
        } catch {
          yield '[ESCALATE]';
          yield 'Issue requires human support';
        }
      }
    }

    if (eventType === 'response.completed') {
      responseId = event.response?.id || responseId;
    }
  }

  // Yield the response ID so the caller can store it for conversation continuity
  if (responseId) {
    yield `[RESPONSE_ID:${responseId}]`;
  }
}
