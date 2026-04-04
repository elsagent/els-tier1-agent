import { openai } from '../openai';
import { TRIAGE_SYSTEM_PROMPT } from './prompts';

const TRIAGE_WORKFLOW_ID = process.env.WORKFLOW_ID || process.env.TRIAGE_WORKFLOW_ID || '';

export interface TriageResult {
  tier: 'tier1' | 'tier2' | 'escalate';
  category: string;
  confidence: number;
  summary: string;
}

/**
 * Run the triage classification using the Responses API.
 * Currently not used in the chat route (users select tier from UI),
 * but available for future use.
 */
export async function runTriage(
  userMessage: string
): Promise<TriageResult> {
  try {
    const response = await (openai.responses as any).create({
      model: TRIAGE_WORKFLOW_ID || 'gpt-4o',
      instructions: TRIAGE_SYSTEM_PROMPT,
      input: userMessage,
      tools: [
        {
          type: 'function',
          name: 'classify_issue',
          description: 'Classify the customer issue into a support tier and category',
          parameters: {
            type: 'object',
            properties: {
              tier: {
                type: 'string',
                enum: ['tier1', 'tier2', 'escalate'],
                description: 'The support tier for this issue',
              },
              category: {
                type: 'string',
                description: 'The issue category',
              },
              confidence: {
                type: 'number',
                description: 'Confidence score from 0 to 1',
              },
              summary: {
                type: 'string',
                description: 'Brief summary of the issue',
              },
            },
            required: ['tier', 'category', 'confidence', 'summary'],
          },
        },
      ],
    });

    // Check for function call in the response output
    const output = response.output || [];
    for (const item of output) {
      if (item.type === 'function_call' && item.name === 'classify_issue') {
        const args = JSON.parse(item.arguments) as {
          tier: 'tier1' | 'tier2' | 'escalate';
          category: string;
          confidence: number;
          summary: string;
        };

        return {
          tier: args.confidence >= 0.7 ? args.tier : 'escalate',
          category: args.category,
          confidence: args.confidence,
          summary: args.summary,
        };
      }
    }
  } catch (err) {
    console.error('Triage classification error:', err);
  }

  // Fallback
  return {
    tier: 'escalate',
    category: 'unknown',
    confidence: 0,
    summary: userMessage.slice(0, 200),
  };
}
