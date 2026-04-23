#!/usr/bin/env node
/**
 * ELS OpenAI Assistant provisioning — single source of truth.
 *
 * Reads the same persona docs + APP_RULES + qa_pairs that the Next.js
 * runtime reads, assembles tier-specific prompts, and creates/updates the
 * three Assistants (Triage, Tier 1, Tier 2) on the live OpenAI org.
 *
 * Usage:
 *   # First-time setup (no IDs in env):
 *   OPENAI_API_KEY=sk-... node scripts/setup-assistants.mjs
 *
 *   # Update existing assistants (IDs read from env):
 *   OPENAI_API_KEY=sk-... TRIAGE_WORKFLOW_ID=asst_... \
 *     TIER1_WORKFLOW_ID=asst_... TIER2_WORKFLOW_ID=asst_... \
 *     node scripts/setup-assistants.mjs
 *
 *   # Force-create even when IDs exist (rare — only for re-provisioning):
 *   ELS_FORCE_CREATE=1 node scripts/setup-assistants.mjs
 *
 * Reads API key from:
 *   1. OPENAI_API_KEY env var (preferred, CI/prod)
 *   2. .env.local file next to package.json (dev convenience)
 *
 * NEVER edit Assistant prompts in the OpenAI dashboard. That dashboard is
 * the live state; this script is the source of truth. Edit kb/APP_RULES.md
 * or kb/persona/*.md and re-run this script.
 */

import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const KB = path.join(ROOT, 'kb');

// ─── API key resolution ────────────────────────────────────────────────────

function resolveApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  try {
    const envPath = path.join(ROOT, '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/^OPENAI_API_KEY=(.+)$/m);
    if (match) return match[1].trim();
  } catch {}
  console.error('Set OPENAI_API_KEY env var or add it to els-tier1-agent/.env.local');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: resolveApiKey() });

// ─── Prompt assembly (mirrors src/lib/agents/prompts.ts) ──────────────────

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

const IDENTITY = readIfExists(path.join(KB, 'persona', '01_identity.md'));
const BOUNDARIES = readIfExists(path.join(KB, 'persona', '02_boundaries.md'));
const VOICE = readIfExists(path.join(KB, 'persona', '03_voice.md'));
const LINGUISTIC = readIfExists(path.join(KB, 'persona', '04_linguistic.md'));
const APP_RULES = readIfExists(path.join(KB, 'APP_RULES.md'));

function readQaPairs() {
  const dir = path.join(KB, 'qa_pairs');
  if (!fs.existsSync(dir)) return '';
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort();
  if (!files.length) return '';
  return files
    .map((f) => `### Example (${f.replace(/\.md$/, '')})\n${readIfExists(path.join(dir, f))}`)
    .join('\n\n');
}

const FEW_SHOT = readQaPairs();

const BASE_SECTIONS = [IDENTITY, BOUNDARIES, VOICE, LINGUISTIC, APP_RULES, FEW_SHOT ? `# Examples\n\n${FEW_SHOT}` : ''];

function assemble(tierSection) {
  return [...BASE_SECTIONS, tierSection].filter(Boolean).join('\n\n---\n\n').trim();
}

const TRIAGE_SECTION = `# Triage role

Greet the user warmly. Ask what SALTO product they're having trouble with and what's happening. Then classify the issue by calling the classify_issue function. Never attempt to resolve the issue yourself.

Tier 1 categories: battery_replacement, door_not_locking, keycard_not_working, software_password_reset, lock_offline, guest_card_programming, clock_sync, firmware_update, audit_trail, basic_software_navigation.

Tier 2 categories: advanced_lock_configuration, network_troubleshooting, encoder_diagnostics, access_plan_configuration, database_connectivity, pms_integration, user_management_advanced, system_backup_recovery, multi_site_configuration, hardware_compatibility.

If it matches a Tier 1 category, tier = "tier1". Tier 2 category, tier = "tier2". Otherwise or if it needs on-site physical repair, tier = "escalate".`;

const TIER1_SECTION = `# Tier 1 role

You handle the Tier 1 categories listed in Boundaries. Use file_search silently to find resolution steps (never reveal searches or cite sources).

Tools:
- escalate_to_tier2 — when the issue requires deeper troubleshooting beyond Tier 1
- escalate_to_human — when the issue cannot be resolved, or when the safety layer has flagged an emergency

Give one step at a time. After each step, check in naturally.`;

const TIER2_SECTION = `# Tier 2 role

You handle the Tier 2 categories listed in Boundaries. Use file_search silently to find resolution steps (never reveal searches or cite sources).

Tools:
- escalate_to_human — when the knowledge base doesn't cover the issue, when you've exhausted the known resolution steps, or when the safety layer has flagged an emergency

If a step could cause data loss or lock people out, say so clearly first. Break complex procedures into steps and check in at critical points.

If the user has already tried basic troubleshooting (they usually have by the time they reach Tier 2), skip ahead to the more advanced steps.`;

// ─── Tool definitions ─────────────────────────────────────────────────────

const TRIAGE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'classify_issue',
      description: 'Classify the customer issue into a support tier and category.',
      parameters: {
        type: 'object',
        properties: {
          tier: { type: 'string', enum: ['tier1', 'tier2', 'escalate'] },
          category: { type: 'string' },
          confidence: { type: 'number' },
          summary: { type: 'string' },
        },
        required: ['tier', 'category', 'confidence', 'summary'],
      },
    },
  },
];

const TIER1_TOOLS = [
  { type: 'file_search' },
  {
    type: 'function',
    function: {
      name: 'escalate_to_tier2',
      description: 'Escalate to Tier 2 advanced support when the issue requires deeper technical troubleshooting.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary of the issue and what was already tried' },
          reason: { type: 'string', description: 'Why this needs Tier 2' },
        },
        required: ['summary'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Escalate to a human support agent when the issue cannot be resolved through automated support.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['summary'],
      },
    },
  },
];

const TIER2_TOOLS = [
  { type: 'file_search' },
  {
    type: 'function',
    function: {
      name: 'escalate_to_human',
      description: 'Escalate to a human support agent when the issue cannot be resolved through automated support.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['summary'],
      },
    },
  },
];

// ─── Main ──────────────────────────────────────────────────────────────────

async function upsert(kind, existingId, params) {
  const force = process.env.ELS_FORCE_CREATE === '1';
  if (existingId && !force) {
    console.log(`[${kind}] updating ${existingId} …`);
    const updated = await openai.beta.assistants.update(existingId, params);
    console.log(`[${kind}] updated: ${updated.id}`);
    return updated.id;
  }
  console.log(`[${kind}] creating new assistant …`);
  const created = await openai.beta.assistants.create({
    name: params.name,
    ...params,
  });
  console.log(`[${kind}] created: ${created.id}`);
  return created.id;
}

async function main() {
  if (!APP_RULES) throw new Error('kb/APP_RULES.md is empty or missing — aborting');
  if (!IDENTITY) throw new Error('kb/persona/01_identity.md missing — aborting');

  const vectorStoreId = process.env.OPENAI_VECTOR_STORE_ID || 'vs_695e9b3d06c481919e8733f807588df3';
  console.log(`Using vector store: ${vectorStoreId}`);

  const triageParams = {
    name: 'ELS Triage Agent',
    instructions: assemble(TRIAGE_SECTION),
    model: 'gpt-4o',
    tools: TRIAGE_TOOLS,
  };
  const tier1Params = {
    name: 'ELS Tier 1 Support Agent',
    instructions: assemble(TIER1_SECTION),
    model: 'gpt-4o',
    tools: TIER1_TOOLS,
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  };
  const tier2Params = {
    name: 'ELS Tier 2 Support Agent',
    instructions: assemble(TIER2_SECTION),
    model: 'gpt-4o',
    tools: TIER2_TOOLS,
    tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
  };

  const triageId = await upsert('triage', process.env.TRIAGE_WORKFLOW_ID, triageParams);
  const tier1Id = await upsert('tier1', process.env.TIER1_WORKFLOW_ID, tier1Params);
  const tier2Id = await upsert('tier2', process.env.TIER2_WORKFLOW_ID, tier2Params);

  console.log('\n========================================');
  console.log('Setup complete. Ensure these are set in each service\'s env:');
  console.log('========================================');
  console.log(`TRIAGE_WORKFLOW_ID=${triageId}`);
  console.log(`TIER1_WORKFLOW_ID=${tier1Id}`);
  console.log(`TIER2_WORKFLOW_ID=${tier2Id}`);
  console.log(`OPENAI_VECTOR_STORE_ID=${vectorStoreId}`);
  console.log('========================================');
  console.log('\nNext: run the eval to confirm behavior matches expectations:');
  console.log('  npm run eval');
}

main().catch((err) => { console.error(err); process.exit(1); });
