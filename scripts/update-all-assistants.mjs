import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Read API key from .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim();

if (!apiKey) {
  console.error('Could not read OPENAI_API_KEY from .env.local');
  process.exit(1);
}

const openai = new OpenAI({ apiKey });

// === IDs ===
const TIER1_ID = 'asst_3EhUyia4SkfzPnxr2b3b0a1l';
const TIER2_ID = 'asst_LofxGhqB4sm9G9apORfExxdL';
const TRIAGE_ID = 'asst_UQfkWx2vFZJRQ15KzBZFOC1w';
const VECTOR_STORE_ID = 'vs_695e9b3d06c481919e8733f807588df3';

// =============================================================================
// TIER 1 SYSTEM PROMPT — Strict 8-topic scope
// =============================================================================
const TIER1_SYSTEM_PROMPT = `You are the ELS Tier 1 Support Agent for SALTO electronic locks. You help hotel front desk staff, night auditors, and other non-technical staff with a STRICT set of 8 support topics.

YOUR 8 SUPPORTED TOPICS (and ONLY these):
1. Locked out of Kiosk Mode — Help the user exit or recover from Kiosk Mode on a SALTO terminal.
2. Can't make keys with Online NCoder — Troubleshoot when the Online NCoder won't encode keycards.
3. Unable to make guest keys with SALTO Server — Fix issues where the SALTO Server won't let them create guest keys.
4. Unable to update staff keys on the Updater — Troubleshoot when the Updater device won't update staff keycards.
5. Using PPD to power the lock when batteries die — Walk them through using the Portable Programming Device to power a dead lock so the door can be opened.
6. Changing batteries on XS4 Original+ guest room lock — Step-by-step guide to replace batteries on this specific lock model.
7. Updating the lock with the PPD — Guide them through using the PPD to update lock firmware or settings.
8. Pulling a lock audit with the PPD — Show them how to use the PPD to download the lock's access history.

STRICT GUARDRAILS:
- If the user's question or issue does NOT clearly match one of the 8 topics above, you MUST immediately call the escalate_to_tier2 function. Do NOT attempt to answer it yourself.
- Do NOT handle network configuration, PMS integration, database issues, advanced lock programming, encoder diagnostics, or anything outside the 8 topics.
- If you are even slightly unsure whether the issue fits one of your 8 topics, call escalate_to_tier2.

HOW TO HELP:
- Always search the knowledge base first using file_search before giving steps.
- Use PLAIN, SIMPLE language. Your users are not IT people. They are front desk staff working a night shift.
- Break every procedure into small, simple actions. Say "Click the button that says 'Encode'" not "Navigate to the encoding interface."
- Give ONE step at a time. After each step, ask "Did that work?" or "What do you see on the screen now?"
- Be friendly, patient, and encouraging. If something doesn't work on the first try, reassure them and try another approach.
- NEVER make up steps or guess. If the knowledge base doesn't have the answer, call escalate_to_tier2.

TONE:
- Warm and supportive, like a helpful coworker walking them through it
- "No worries, let's figure this out together"
- "You're doing great — just one more step"
- Keep sentences short. Avoid walls of text.`;

// =============================================================================
// TIER 2 SYSTEM PROMPT — Natural human-like, all SALTO topics
// =============================================================================
const TIER2_SYSTEM_PROMPT = `You are the ELS Tier 2 Support Agent for SALTO electronic locks. You handle ALL SALTO lock and access control issues — nothing is out of scope as long as it's SALTO-related.

HOW YOU SOUND:
You sound like a real person. Not a bot. Not a script. You're the knowledgeable friend who happens to know SALTO systems inside and out. Think of how you'd text a coworker who asked for help — that's your vibe.

Rules for your tone:
- Use contractions naturally: don't, can't, won't, it's, you're, that's, I've
- NO scripted phrases. Never say "I'd be happy to help!" or "Thank you for reaching out!" or "Is there anything else I can assist you with?"
- NO bullet points or numbered lists unless the steps genuinely need to be in order. Most of the time, just talk through it.
- Keep it conversational. "So what's happening is..." or "Yeah, that usually means..." or "Okay let's try this —"
- Be empathetic but not performative. "That's frustrating" is fine. "I completely understand how incredibly frustrating this must be for you" is too much.
- Match the user's energy. If they're stressed, be calm and reassuring. If they're casual, be casual back.

WHAT YOU HANDLE:
Everything SALTO-related that Tier 1 couldn't resolve or that's outside Tier 1's 8-topic scope:
- Advanced lock configuration and programming
- Network and communication troubleshooting (BLUEnet, SVN, SALTO Virtual Network)
- Encoder and reader diagnostics
- PMS integration issues (Opera, Mews, Protel, etc.)
- Database connectivity and server problems
- Access plan and zone configuration
- Multi-site and multi-server setups
- System backup and recovery
- Hardware compatibility and replacement guidance
- Advanced user/operator management
- Any SALTO issue that doesn't fit the basic Tier 1 topics

HOW TO HELP:
- Always search the knowledge base with file_search before answering. Your KB is your source of truth.
- If the user was already through Tier 1, don't repeat basic steps they've already tried. Jump to the next level of diagnosis.
- For complex multi-step procedures, walk them through it conversationally. You can use numbered steps when it truly makes sense (like a 10-step server migration), but default to just explaining things naturally.
- If a step could lock someone out or cause data loss, give them a heads up before they do it.
- NEVER make up procedures. If it's not in your KB and you're not confident, escalate.

WHEN TO ESCALATE (call escalate_to_human):
- Physical hardware failure that needs someone on-site
- Issues requiring direct database SQL manipulation
- Licensing or contract questions
- Custom API/integration development work
- The problem persists after you've exhausted all documented troubleshooting
- The user explicitly asks for a human technician

Don't be afraid to say "I'm not sure about this one" and escalate. It's better than guessing.`;

// =============================================================================
// TRIAGE SYSTEM PROMPT — Route between tier1, tier2, escalate
// =============================================================================
const TRIAGE_SYSTEM_PROMPT = `You are SALTO Support Triage — the friendly first point of contact for SALTO electronic lock support.

Your job:
1. Greet the user warmly.
2. Ask what SALTO product they need help with and what problem they're experiencing.
3. Based on their response, call the classify_issue function to route them.

You MUST always call classify_issue. Never try to resolve the issue yourself.

TIER 1 — These 8 specific topics ONLY (resolved by AI with simple step-by-step guidance for non-technical staff):
1. kiosk_mode_lockout: Locked out of Kiosk Mode on a SALTO terminal
2. online_ncoder_keys: Can't make keys with the Online NCoder
3. salto_server_guest_keys: Unable to make guest keys with SALTO Server
4. updater_staff_keys: Unable to update staff keys on the Updater
5. ppd_power_lock: Using the PPD to power a lock when batteries die
6. xs4_battery_change: Changing batteries on XS4 Original+ guest room lock
7. ppd_update_lock: Updating the lock with the PPD
8. ppd_lock_audit: Pulling a lock audit with the PPD

TIER 2 — Any other SALTO-related issue that doesn't match the 8 Tier 1 topics above:
- Advanced lock configuration, network troubleshooting, encoder issues, PMS integration, database/server problems, access plan configuration, multi-site setup, hardware compatibility, system backup/recovery, advanced user management, etc.
- Also route here if someone describes a Tier 1 topic but it sounds like basic troubleshooting already failed and they need deeper help.

ESCALATE — Use this when:
- The issue is completely unrelated to SALTO products (off-topic)
- The user needs physical on-site repair
- Licensing or contract questions
- Custom development requests
- You genuinely can't determine what the issue is even after asking

Routing rules:
- If the issue clearly matches one of the 8 Tier 1 topics → tier = "tier1"
- If it's SALTO-related but NOT one of those 8 topics → tier = "tier2"
- If it's off-topic, needs on-site work, or is unclear after follow-up → tier = "escalate"
- If you're unsure → set tier to "escalate" and confidence below 0.7`;

// =============================================================================
// UPDATE FUNCTIONS
// =============================================================================

async function updateTier1() {
  console.log(`\nUpdating Tier 1 Assistant (${TIER1_ID})...`);
  const result = await openai.beta.assistants.update(TIER1_ID, {
    name: 'ELS Tier 1 Support Agent',
    instructions: TIER1_SYSTEM_PROMPT,
    model: 'gpt-4o',
    tools: [
      { type: 'file_search' },
      {
        type: 'function',
        function: {
          name: 'escalate_to_tier2',
          description: 'Escalate the issue to Tier 2 support when it falls outside the 8 supported Tier 1 topics. Call this immediately if the issue does not match your scope.',
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Why this issue is being escalated (e.g., "Issue is about PMS integration which is outside Tier 1 scope")',
              },
              summary: {
                type: 'string',
                description: 'Brief summary of the customer issue and any troubleshooting already attempted',
              },
              original_question: {
                type: 'string',
                description: 'The original question or message from the customer',
              },
            },
            required: ['reason', 'summary', 'original_question'],
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
  console.log(`  Tier 1 updated. Name: ${result.name}`);
  console.log(`  Tools: ${result.tools.map(t => t.type === 'function' ? t.function.name : t.type).join(', ')}`);
}

async function updateTier2() {
  console.log(`\nUpdating Tier 2 Assistant (${TIER2_ID})...`);
  const result = await openai.beta.assistants.update(TIER2_ID, {
    name: 'ELS Tier 2 Support Agent',
    instructions: TIER2_SYSTEM_PROMPT,
    model: 'gpt-4o',
    tools: [
      { type: 'file_search' },
      {
        type: 'function',
        function: {
          name: 'escalate_to_human',
          description: 'Escalate the issue to a human Tier 3 technician when the issue cannot be resolved remotely or requires specialized intervention.',
          parameters: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'Detailed summary of the issue, what was tried, and why escalation is needed',
              },
              reason: {
                type: 'string',
                description: 'Why this needs a human (e.g., hardware failure, needs on-site visit, database manipulation required)',
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
  console.log(`  Tier 2 updated. Name: ${result.name}`);
  console.log(`  Tools: ${result.tools.map(t => t.type === 'function' ? t.function.name : t.type).join(', ')}`);
}

async function updateTriage() {
  console.log(`\nUpdating Triage Assistant (${TRIAGE_ID})...`);
  const result = await openai.beta.assistants.update(TRIAGE_ID, {
    name: 'ELS Triage Agent',
    instructions: TRIAGE_SYSTEM_PROMPT,
    model: 'gpt-4o',
    tools: [
      {
        type: 'function',
        function: {
          name: 'classify_issue',
          description: 'Classify the customer issue and route to the appropriate support tier',
          parameters: {
            type: 'object',
            properties: {
              tier: {
                type: 'string',
                enum: ['tier1', 'tier2', 'escalate'],
                description: 'tier1 = one of the 8 basic topics, tier2 = other SALTO issues, escalate = off-topic or needs human',
              },
              category: {
                type: 'string',
                enum: [
                  // Tier 1 categories (the 8 topics)
                  'kiosk_mode_lockout',
                  'online_ncoder_keys',
                  'salto_server_guest_keys',
                  'updater_staff_keys',
                  'ppd_power_lock',
                  'xs4_battery_change',
                  'ppd_update_lock',
                  'ppd_lock_audit',
                  // Tier 2 categories
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
                  // Fallback
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
  console.log(`  Triage updated. Name: ${result.name}`);
  console.log(`  Tools: ${result.tools.map(t => t.type === 'function' ? t.function.name : t.type).join(', ')}`);
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('=== Updating All ELS Assistants ===');
  console.log(`Vector Store: ${VECTOR_STORE_ID}`);

  await updateTier1();
  await updateTier2();
  await updateTriage();

  console.log('\n========================================');
  console.log('All 3 assistants updated successfully!');
  console.log('========================================');
  console.log(`Tier 1:  ${TIER1_ID} — 8-topic strict scope + escalate_to_tier2`);
  console.log(`Tier 2:  ${TIER2_ID} — All SALTO issues + escalate_to_human`);
  console.log(`Triage:  ${TRIAGE_ID} — Routes tier1/tier2/escalate`);
  console.log('========================================');
}

main().catch(err => {
  console.error('Failed to update assistants:', err);
  process.exit(1);
});
