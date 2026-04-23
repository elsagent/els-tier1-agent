/**
 * APP_RULES — the single iteration lever.
 *
 * The actual content lives in kb/APP_RULES.md. This module just reads that
 * file at module init so that:
 *   - the Next.js runtime uses the same text
 *   - the OpenAI Assistant setup script (scripts/setup-assistants.mjs)
 *     uses the same text
 *
 * ONE SOURCE OF TRUTH. Edit the markdown file, not this file.
 *
 * See kb/APP_RULES.md for the order-of-precedence diagram and editing rules.
 */

import fs from 'node:fs';
import path from 'node:path';

const APP_RULES_PATH = path.join(process.cwd(), 'kb', 'APP_RULES.md');

function load(): string {
  try {
    return fs.readFileSync(APP_RULES_PATH, 'utf8');
  } catch (err) {
    console.error(`[APP_RULES] Failed to read ${APP_RULES_PATH}:`, err);
    // Hard fail at build/startup — if APP_RULES can't load, the agent would
    // ship without its scope rules, which is unsafe.
    throw new Error(`APP_RULES missing at ${APP_RULES_PATH}`);
  }
}

export const APP_RULES = load();
