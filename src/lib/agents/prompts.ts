/**
 * System prompts for triage / tier-1 / tier-2.
 *
 * Assembled at module load from:
 *   kb/persona/01_identity.md
 *   kb/persona/02_boundaries.md
 *   kb/persona/03_voice.md
 *   kb/persona/04_linguistic.md
 *   lib/agents/app_rules.ts (APP_RULES)
 *   kb/qa_pairs/*.md (optional few-shot examples, all files concatenated)
 *
 * DO NOT hand-edit this file to change what the agents say. Edit either:
 *   - the relevant persona doc (stable, client-canonical), or
 *   - APP_RULES in lib/agents/app_rules.ts (iteration lever)
 *
 * The tier-specific sections (appended last) are minimal — the persona docs
 * + APP_RULES already cover voice, scope, and boundaries. These just name
 * which tier-specific tools the agent can call.
 */

import fs from 'node:fs';
import path from 'node:path';
import { APP_RULES } from './app_rules';

// ─── Load once at module init ──────────────────────────────────────────────
// In Next.js server runtime the cwd is the project root, so resolve from there.
// (Files are committed; they are not rebuilt at runtime.)

function readIfExists(p: string): string {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

const ROOT = process.cwd();
const PERSONA_DIR = path.join(ROOT, 'kb', 'persona');
const QA_PAIRS_DIR = path.join(ROOT, 'kb', 'qa_pairs');

const IDENTITY = readIfExists(path.join(PERSONA_DIR, '01_identity.md'));
const BOUNDARIES = readIfExists(path.join(PERSONA_DIR, '02_boundaries.md'));
const VOICE = readIfExists(path.join(PERSONA_DIR, '03_voice.md'));
const LINGUISTIC = readIfExists(path.join(PERSONA_DIR, '04_linguistic.md'));

function readQaPairs(): string {
  if (!fs.existsSync(QA_PAIRS_DIR)) return '';
  const files = fs.readdirSync(QA_PAIRS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();
  if (files.length === 0) return '';
  return files
    .map((f) => `### Example (${f.replace(/\.md$/, '')})\n${readIfExists(path.join(QA_PAIRS_DIR, f))}`)
    .join('\n\n');
}

const FEW_SHOT = readQaPairs();

// ─── Assemble base ────────────────────────────────────────────────────────

function assemble(tierSection: string): string {
  return [
    IDENTITY,
    BOUNDARIES,
    VOICE,
    LINGUISTIC,
    APP_RULES,
    FEW_SHOT ? `# Examples\n\n${FEW_SHOT}` : '',
    tierSection,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')
    .trim();
}

// ─── Tier-specific addenda (short) ────────────────────────────────────────

const TRIAGE_SECTION = `# Triage role

Greet the user warmly. Ask what SALTO product they're having trouble with and what's happening. Then classify the issue by calling the classify_issue function. Never attempt to resolve the issue yourself.

Tier 1 categories: battery_replacement, door_not_locking, keycard_not_working, software_password_reset, lock_offline, guest_card_programming, clock_sync, firmware_update, audit_trail, basic_software_navigation.

Tier 2 categories: advanced_lock_configuration, network_troubleshooting, encoder_diagnostics, access_plan_configuration, database_connectivity, pms_integration, user_management_advanced, system_backup_recovery, multi_site_configuration, hardware_compatibility.

If it matches a Tier 1 category, tier = "tier1". Tier 2 category, tier = "tier2". Otherwise or if it needs on-site physical repair, tier = "escalate".`;

const TIER1_SECTION = `# Tier 1 role

You handle the Tier 1 categories listed in Boundaries. Use the file_search tool silently to find resolution steps (never reveal that you're searching or cite sources).

Tools you may call:
- escalate_to_tier2 — when the issue requires deeper troubleshooting beyond Tier 1 steps
- escalate_to_human — when the issue cannot be resolved through automated support, or when the safety layer has flagged an emergency

Give one step at a time. After each step, check in naturally.`;

const TIER2_SECTION = `# Tier 2 role

You handle the Tier 2 categories listed in Boundaries. Use the file_search tool silently to find resolution steps (never reveal that you're searching or cite sources).

Tools you may call:
- escalate_to_human — when the knowledge base doesn't cover the issue, when you've exhausted the known resolution steps, or when the safety layer has flagged an emergency

If a step could cause data loss or lock people out, say so clearly first. Break complex procedures into steps and check in at critical points: "Let me know once you've done that."

If the user has already tried basic troubleshooting (they usually have by the time they reach Tier 2), skip ahead to the more advanced steps.`;

// ─── Exports ──────────────────────────────────────────────────────────────

export const TRIAGE_SYSTEM_PROMPT = assemble(TRIAGE_SECTION);
export const TIER1_SYSTEM_PROMPT = assemble(TIER1_SECTION);
export const TIER2_SYSTEM_PROMPT = assemble(TIER2_SECTION);
