import { openai } from '../openai';

const TIER1_ASSISTANT_ID = process.env.TIER1_ASSISTANT_ID!;

export async function* runTier1(
  threadId: string,
  userMessage: string | null
): AsyncGenerator<string, void, unknown> {
  if (userMessage) {
    await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: userMessage,
    });
  }

  const stream = openai.beta.threads.runs.stream(threadId, {
    assistant_id: TIER1_ASSISTANT_ID,
  });

  for await (const event of stream) {
    if (event.event === 'thread.message.delta') {
      const delta = event.data.delta;
      if (delta.content) {
        for (const block of delta.content) {
          if (block.type === 'text' && block.text?.value) {
            yield block.text.value;
          }
        }
      }
    }

    if (event.event === 'thread.run.requires_action') {
      const requiredAction = event.data.required_action;
      if (requiredAction?.type === 'submit_tool_outputs') {
        const toolCalls = requiredAction.submit_tool_outputs.tool_calls;

        // Check for escalate_to_tier2 (auto-escalation within the app)
        const escalateToTier2Call = toolCalls.find(
          (tc) => tc.function.name === 'escalate_to_tier2'
        );

        // Check for escalate_to_human (human handoff)
        const escalateToHumanCall = toolCalls.find(
          (tc) => tc.function.name === 'escalate_to_human'
        );

        if (escalateToTier2Call) {
          const args = JSON.parse(escalateToTier2Call.function.arguments) as {
            summary: string;
            reason: string;
          };

          await openai.beta.threads.runs.submitToolOutputsAndPoll(
            event.data.id,
            {
              thread_id: threadId,
              tool_outputs: [
                {
                  tool_call_id: escalateToTier2Call.id,
                  output: 'Escalation to Tier 2 registered. The conversation will now continue with the Tier 2 technical support agent.',
                },
              ],
            }
          );

          yield '[ESCALATE_TO_TIER2]';
          yield JSON.stringify({ summary: args.summary || args.reason || 'Issue requires advanced troubleshooting' });
        } else if (escalateToHumanCall) {
          const args = JSON.parse(escalateToHumanCall.function.arguments) as {
            summary: string;
            reason: string;
          };

          await openai.beta.threads.runs.submitToolOutputsAndPoll(
            event.data.id,
            {
              thread_id: threadId,
              tool_outputs: [
                {
                  tool_call_id: escalateToHumanCall.id,
                  output: 'Escalation registered',
                },
              ],
            }
          );

          yield '[ESCALATE]';
          yield args.summary || args.reason || 'Issue requires human support';
        } else {
          const toolOutputs = toolCalls.map((tc) => ({
            tool_call_id: tc.id,
            output: '',
          }));

          await openai.beta.threads.runs.submitToolOutputsAndPoll(
            event.data.id,
            {
              thread_id: threadId,
              tool_outputs: toolOutputs,
            }
          );
        }
      }
    }
  }
}
