import OpenAI from 'openai';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Set OPENAI_API_KEY env var');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

const TRIAGE_SYSTEM_PROMPT = `You are SALTO Support Triage — a friendly first point of contact for SALTO electronic lock support.

Your job:
1. Greet the user warmly.
2. Ask what SALTO product they need help with and what problem they're experiencing.
3. Based on their response, call the classify_issue function.

You MUST always call classify_issue. Never try to resolve the issue yourself.

Top 10 Tier 1 categories (these can be resolved by the AI agent):
- battery_replacement: Low battery warnings, replacing lock batteries
- door_not_locking: Door won't lock or latch properly
- keycard_not_working: Keycard not recognized, access denied
- software_password_reset: Forgotten SALTO software password
- lock_offline: Lock showing offline in management software
- guest_card_programming: Creating or programming guest keycards
- clock_sync: Lock clock out of sync with server
- firmware_update: How to update lock firmware
- audit_trail: Viewing or exporting lock access history
- basic_software_navigation: General SALTO software how-to questions

If the issue does NOT match any of the above categories, set tier to "escalate".
If you're unsure, set tier to "escalate" and confidence below 0.7.`;

const TIER1_SYSTEM_PROMPT = `You are SALTO Tier 1 Support Agent. You help non-technical hotel staff (night auditors, front desk operators) resolve common electronic lock issues.

CRITICAL RULES:
- Use PLAIN, SIMPLE language. Never use technical jargon.
- Give ONE step at a time. Wait for the user to confirm before continuing.
- After each step ask: "Did that work?" or "What do you see now?"
- Always search the knowledge base first using file_search before answering.
- If the knowledge base has no answer, call escalate_to_human immediately.
- If you've tried all steps and the issue persists, call escalate_to_human.
- NEVER guess or make up steps. If unsure, escalate.
- Be patient, encouraging, and supportive.
- Do NOT discuss topics outside SALTO lock support.

Example of good language:
- "Press the small button on the bottom of the lock" (NOT "actuate the manual override mechanism")
- "Open the SALTO program on your computer" (NOT "launch the ProAccess SPACE client application")`;

async function main() {
  console.log('Creating vector store for Tier 1 KB...');
  const vectorStore = await openai.vectorStores.create({
    name: 'ELS Tier 1 Knowledge Base',
  });
  console.log(`Vector store created: ${vectorStore.id}`);

  // Upload KB files if any exist
  const kbDir = join(process.cwd(), 'kb');
  if (existsSync(kbDir)) {
    const files = readdirSync(kbDir).filter(f => f.endsWith('.txt') || f.endsWith('.md') || f.endsWith('.pdf'));
    for (const file of files) {
      console.log(`Uploading KB file: ${file}`);
      const uploaded = await openai.files.create({
        file: new File([readFileSync(join(kbDir, file))], file),
        purpose: 'assistants',
      });
      await openai.vectorStores.files.create(vectorStore.id, {
        file_id: uploaded.id,
      });
      console.log(`  Uploaded: ${uploaded.id}`);
    }
  }

  console.log('\nCreating Triage Assistant...');
  const triageAssistant = await openai.beta.assistants.create({
    name: 'ELS Triage Agent',
    instructions: TRIAGE_SYSTEM_PROMPT,
    model: 'gpt-4o',
    tools: [
      {
        type: 'function',
        function: {
          name: 'classify_issue',
          description: 'Classify the customer issue into a support tier and category',
          parameters: {
            type: 'object',
            properties: {
              tier: {
                type: 'string',
                enum: ['tier1', 'escalate'],
                description: 'Which tier should handle this issue',
              },
              category: {
                type: 'string',
                enum: [
                  'battery_replacement',
                  'door_not_locking',
                  'keycard_not_working',
                  'software_password_reset',
                  'lock_offline',
                  'guest_card_programming',
                  'clock_sync',
                  'firmware_update',
                  'audit_trail',
                  'basic_software_navigation',
                  'unknown',
                ],
                description: 'The specific issue category',
              },
              confidence: {
                type: 'number',
                description: 'Confidence score from 0 to 1',
              },
              summary: {
                type: 'string',
                description: 'Brief summary of the customer issue',
              },
            },
            required: ['tier', 'category', 'confidence', 'summary'],
          },
        },
      },
    ],
  });
  console.log(`Triage Assistant created: ${triageAssistant.id}`);

  console.log('\nCreating Tier 1 Assistant...');
  const tier1Assistant = await openai.beta.assistants.create({
    name: 'ELS Tier 1 Support Agent',
    instructions: TIER1_SYSTEM_PROMPT,
    model: 'gpt-4o',
    tools: [
      { type: 'file_search' },
      {
        type: 'function',
        function: {
          name: 'escalate_to_human',
          description: 'Escalate the issue to a human Tier 3 technician when the AI cannot resolve it',
          parameters: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'Summary of what was tried and why escalation is needed',
              },
              reason: {
                type: 'string',
                enum: ['out_of_scope', 'all_steps_failed', 'uncertain', 'customer_request'],
                description: 'Reason for escalation',
              },
            },
            required: ['summary', 'reason'],
          },
        },
      },
    ],
    tool_resources: {
      file_search: {
        vector_store_ids: [vectorStore.id],
      },
    },
  });
  console.log(`Tier 1 Assistant created: ${tier1Assistant.id}`);

  console.log('\n========================================');
  console.log('Setup complete! Add these to your .env.local:');
  console.log('========================================');
  console.log(`TRIAGE_ASSISTANT_ID=${triageAssistant.id}`);
  console.log(`TIER1_ASSISTANT_ID=${tier1Assistant.id}`);
  console.log(`VECTOR_STORE_ID=${vectorStore.id}`);
  console.log('========================================');
}

main().catch(console.error);
