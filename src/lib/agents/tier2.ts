import { openai } from '../openai';

const TIER2_ASSISTANT_ID = process.env.TIER2_ASSISTANT_ID!;

// Strip OpenAI file_search citation annotations like 【8:2†filename.pdf】
function stripCitations(text: string): string {
  return text.replace(/【[^】]*】/g, '');
}

export async function* runTier2(
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
    assistant_id: TIER2_ASSISTANT_ID,
  });

  for await (const event of stream) {
    if (event.event === 'thread.message.delta') {
      const delta = event.data.delta;
      if (delta.content) {
        for (const block of delta.content) {
          if (block.type === 'text' && block.text?.value) {
            const cleaned = stripCitations(block.text.value);
            if (cleaned) yield cleaned;
          }
        }
      }
    }

    if (event.event === 'thread.run.requires_action') {
      const requiredAction = event.data.required_action;
      if (requiredAction?.type === 'submit_tool_outputs') {
        const toolCalls = requiredAction.submit_tool_outputs.tool_calls;
        const escalateCall = toolCalls.find(
          (tc) => tc.function.name === 'escalate_to_human'
        );

        if (escalateCall) {
          const args = JSON.parse(escalateCall.function.arguments) as {
            summary: string;
            reason: string;
          };

          await openai.beta.threads.runs.submitToolOutputsAndPoll(
            event.data.id,
            {
              thread_id: threadId,
              tool_outputs: [
                {
                  tool_call_id: escalateCall.id,
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
