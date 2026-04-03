import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Set OPENAI_API_KEY env var');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

// Update BOTH local and Railway triage assistants
const TRIAGE_IDS = [
  process.env.TRIAGE_ASSISTANT_ID,        // local
  'asst_bICow2FFWnmy9Kcy06B8fn0c',        // Railway
].filter(Boolean);

const UPDATED_TRIAGE_PROMPT = `You are SALTO Support Triage — a friendly first point of contact for SALTO electronic lock support.

Your job:
1. Greet the user warmly.
2. Ask what SALTO product they need help with and what problem they're experiencing.
3. Based on their response, call the classify_issue function.

You MUST always call classify_issue. Never try to resolve the issue yourself.

Tier 1 categories (basic, common issues — resolved by AI with simple step-by-step guidance):
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

Tier 2 categories (complex but resolvable remotely — requires deeper technical guidance):
- advanced_lock_configuration: Advanced lock programming, modes, settings beyond basic setup
- network_troubleshooting: BLUEnet, SVN, SALTO Virtual Network connectivity issues
- encoder_diagnostics: Encoder/reader not working, pairing, calibration issues
- access_plan_configuration: Complex access plans, zones, time periods, calendar setup
- database_connectivity: Software can't connect to database, server migration, backup issues
- pms_integration: Property Management System integration problems (Opera, Mews, etc.)
- user_management_advanced: Operator roles, permissions, multi-user conflicts
- system_backup_recovery: Database backup, restore, recovery procedures
- multi_site_configuration: Multi-property or multi-server setup issues
- hardware_compatibility: Lock model compatibility, replacement, upgrade questions

Routing rules:
- If the issue matches a Tier 1 category → set tier to "tier1"
- If the issue matches a Tier 2 category → set tier to "tier2"
- If the issue requires physical on-site repair, custom development, licensing, or doesn't match any category → set tier to "escalate"
- If you're unsure → set tier to "escalate" and confidence below 0.7`;

async function main() {
  for (const id of TRIAGE_IDS) {
    console.log(`Updating triage assistant: ${id}`);
    await openai.beta.assistants.update(id, {
      instructions: UPDATED_TRIAGE_PROMPT,
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
                  enum: ['tier1', 'tier2', 'escalate'],
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
                    'advanced_lock_configuration',
                    'network_troubleshooting',
                    'encoder_diagnostics',
                    'access_plan_configuration',
                    'database_connectivity',
                    'pms_integration',
                    'user_management_advanced',
                    'system_backup_recovery',
                    'multi_site_configuration',
                    'hardware_compatibility',
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
    console.log(`  Updated: ${id}`);
  }
  console.log('\nDone! Both triage assistants now route to tier1/tier2/escalate.');
}

main().catch(console.error);
