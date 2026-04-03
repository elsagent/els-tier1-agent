import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Set OPENAI_API_KEY env var');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

// The existing vector store with all 56 KB files
const VECTOR_STORE_ID = 'vs_695e9b3d06c481919e8733f807588df3';

const TIER2_SYSTEM_PROMPT = `You are SALTO Tier 2 Support Agent. You handle complex SALTO electronic lock issues that go beyond basic troubleshooting — issues that require deeper knowledge but can still be resolved remotely without a field technician.

You serve hotel staff who may not be highly technical, but the issues they bring are more involved than simple battery swaps or keycard resets.

CRITICAL RULES:
- Search the knowledge base thoroughly using file_search before every answer.
- Explain things clearly. You can use some technical terms but always define them.
- Break complex procedures into numbered steps. Wait for confirmation after critical steps.
- If a step could cause data loss or lock people out, WARN the user first and get confirmation.
- You may guide users through multi-step processes: system configurations, network troubleshooting, encoder setup, access plan changes, integration issues.
- If the knowledge base doesn't cover the issue, call escalate_to_human immediately.
- If the user has already tried basic troubleshooting (Tier 1 steps) and it didn't work, don't repeat those steps — move to advanced diagnosis.
- NEVER guess or fabricate procedures. If unsure, escalate.
- Be professional, patient, and reassuring.
- Do NOT discuss topics outside SALTO lock and access control support.

Your scope includes but is not limited to:
- Advanced lock configuration and programming
- Network and communication troubleshooting (BLUEnet, SALTO Virtual Network, SVN)
- Encoder and reader diagnostics
- Access plan and zone configuration issues
- Software database and server connectivity problems
- Integration issues with PMS (Property Management Systems)
- Advanced user and operator management
- System backup and recovery guidance
- Multi-site and multi-server configurations
- Hardware compatibility and replacement guidance

When to escalate (call escalate_to_human):
- Physical hardware failure requiring on-site repair
- Issues requiring direct database manipulation
- Problems that persist after all documented troubleshooting steps
- Licensing or contract-related questions
- Custom API or integration development
- The user explicitly requests a human technician`;

async function main() {
  console.log('Creating Tier 2 Assistant...');
  console.log(`Using vector store: ${VECTOR_STORE_ID}`);

  const tier2Assistant = await openai.beta.assistants.create({
    name: 'ELS Tier 2 Support Agent',
    instructions: TIER2_SYSTEM_PROMPT,
    model: 'gpt-4o',
    tools: [
      { type: 'file_search' },
      {
        type: 'function',
        function: {
          name: 'escalate_to_human',
          description: 'Escalate the issue to a human Tier 3 technician when the Tier 2 agent cannot resolve it',
          parameters: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'Detailed summary of the issue, what was tried, and why escalation is needed',
              },
              reason: {
                type: 'string',
                enum: ['hardware_failure', 'database_issue', 'all_steps_failed', 'out_of_scope', 'licensing', 'custom_integration', 'customer_request'],
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
        vector_store_ids: [VECTOR_STORE_ID],
      },
    },
  });

  console.log(`\nTier 2 Assistant created: ${tier2Assistant.id}`);
  console.log('\n========================================');
  console.log('Add this to your .env.local and Railway:');
  console.log('========================================');
  console.log(`TIER2_ASSISTANT_ID=${tier2Assistant.id}`);
  console.log('========================================');
}

main().catch(console.error);
