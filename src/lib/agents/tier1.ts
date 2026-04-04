import { openai } from '../openai';
import { TIER1_SYSTEM_PROMPT } from './prompts';

const TIER1_WORKFLOW_ID = process.env.WORKFLOW_ID || process.env.TIER1_WORKFLOW_ID || '';
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID || '';

// Strip OpenAI file_search citation annotations like 【8:2†filename.pdf】
function stripCitations(text: string): string {
  return text.replace(/【[^】]*】/g, '');
}

/**
 * Process streamed events from the Responses API.
 * Handles text deltas, function calls (escalate_to_tier2, escalate_to_human),
 * and captures the response ID for conversation continuity.
 */
async function* processStream(
  stream: AsyncIterable<any>
): AsyncGenerator<string, void, unknown> {
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

/**
 * Run the Tier 1 agent using the Responses API with a workflow brain.
 * Tries the Agent Builder workflow ID first. If the workflow ID isn't yet
 * callable via API, falls back to gpt-4o + system prompt + file_search
 * (matching the same brain/instructions configured in the workflow).
 * Uses previous_response_id for conversation continuity instead of threads.
 */
export async function* runTier1(
  previousResponseId: string | null,
  userMessage: string
): AsyncGenerator<string, void, unknown> {
  // --- Attempt 1: Use the Agent Builder workflow as model ---
  if (TIER1_WORKFLOW_ID) {
    try {
      const createParams: Record<string, unknown> = {
        model: TIER1_WORKFLOW_ID,
        input: userMessage,
        stream: true,
      };
      if (previousResponseId) {
        createParams.previous_response_id = previousResponseId;
      }

      const stream = await openai.responses.create(createParams as any);
      yield* processStream(stream as any);
      return; // Workflow succeeded — done
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      // Only fall through if the workflow ID isn't recognized as a model
      if (!msg.includes('model') && !msg.includes('not found') && !msg.includes('invalid')) {
        throw err; // Re-throw non-model errors
      }
      console.warn('[Tier1] Workflow ID not yet callable via API, falling back to gpt-4o + file_search');
    }
  }

  // --- Fallback: gpt-4o + system prompt + file_search (mirrors the workflow brain) ---
  const fallbackParams: Record<string, unknown> = {
    model: 'gpt-4o',
    instructions: TIER1_SYSTEM_PROMPT,
    input: userMessage,
    stream: true,
    tools: [
      ...(VECTOR_STORE_ID
        ? [{ type: 'file_search', vector_store_ids: [VECTOR_STORE_ID] }]
        : []),
      {
        type: 'function',
        name: 'escalate_to_tier2',
        description: 'Escalate this issue to Tier 2 advanced support when it requires deeper technical troubleshooting beyond basic Tier 1 resolution steps.',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Brief summary of the issue and what was already tried' },
            reason: { type: 'string', description: 'Why this needs Tier 2 support' },
          },
          required: ['summary'],
        },
      },
      {
        type: 'function',
        name: 'escalate_to_human',
        description: 'Escalate to a human support agent when the issue cannot be resolved through automated support.',
        parameters: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Brief summary of the issue' },
            reason: { type: 'string', description: 'Why human support is needed' },
          },
          required: ['summary'],
        },
      },
    ],
  };

  if (previousResponseId) {
    fallbackParams.previous_response_id = previousResponseId;
  }

  const fallbackStream: any = await openai.responses.create(fallbackParams as any);
  yield* processStream(fallbackStream as any);
}
