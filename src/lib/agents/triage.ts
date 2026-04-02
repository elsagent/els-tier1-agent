import { openai } from '../openai';

const TRIAGE_ASSISTANT_ID = process.env.TRIAGE_ASSISTANT_ID!;

export interface TriageResult {
  tier: 'tier1' | 'escalate';
  category: string;
  confidence: number;
  summary: string;
}

export async function runTriage(
  threadId: string,
  userMessage: string
): Promise<TriageResult> {
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: userMessage,
  });

  // First attempt
  let result = await attemptClassification(threadId);
  if (result) return result;

  // If the assistant responded with text instead of calling the function,
  // nudge it to classify
  await openai.beta.threads.messages.create(threadId, {
    role: 'user',
    content: 'Please classify my issue now using the classify_issue function.',
  });

  result = await attemptClassification(threadId);
  if (result) return result;

  // Final fallback
  return {
    tier: 'escalate',
    category: 'unknown',
    confidence: 0,
    summary: userMessage.slice(0, 200),
  };
}

async function attemptClassification(
  threadId: string
): Promise<TriageResult | null> {
  const run = await openai.beta.threads.runs.createAndPoll(threadId, {
    assistant_id: TRIAGE_ASSISTANT_ID,
  });

  if (
    run.status === 'requires_action' &&
    run.required_action?.type === 'submit_tool_outputs'
  ) {
    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
    const classifyCall = toolCalls.find(
      (tc) => tc.function.name === 'classify_issue'
    );

    if (classifyCall) {
      const args = JSON.parse(classifyCall.function.arguments) as {
        tier: 'tier1' | 'escalate';
        category: string;
        confidence: number;
        summary: string;
      };

      await openai.beta.threads.runs.submitToolOutputsAndPoll(run.id, {
        thread_id: threadId,
        tool_outputs: [
          {
            tool_call_id: classifyCall.id,
            output: 'Classification received',
          },
        ],
      });

      return {
        tier: args.confidence >= 0.7 ? args.tier : 'escalate',
        category: args.category,
        confidence: args.confidence,
        summary: args.summary,
      };
    }
  }

  return null;
}
