/**
 * AI-tell normalization.
 *
 * Two purposes:
 *   1. Applied to every retrieved KB excerpt before it's fed to the model.
 *      Starves the model of few-shot examples of forbidden characters/phrases.
 *      Raw KB files on disk stay untouched so `sync-kb` / ingest stays idempotent.
 *   2. Applied to streamed response deltas as a last-line defense.
 *      Character replacement is safe on deltas; phrase stripping is not
 *      (a phrase can straddle two deltas), so phrase checks are best-effort
 *      on deltas and only fully reliable on a finalized message.
 *
 * Keep the token lists in sync with:
 *   - kb/persona/04_linguistic.md (human-readable rule)
 *   - lib/agents/app_rules.ts (runtime rule for the model)
 *   - qa/persona_eval_v1.yaml forbidden_voice_tokens (grader)
 */

// ─── Character replacements (always safe on deltas) ───────────────────────
const CHAR_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/\u2014/g, ' - '],       // em-dash
  [/\u2013/g, '-'],         // en-dash
  [/\u2026/g, '...'],       // horizontal ellipsis
  [/[\u201C\u201D]/g, '"'], // curly double quotes
  [/[\u2018\u2019]/g, "'"], // curly single quotes
  [/【[^】]*】/g, ''],        // OpenAI file_search citation brackets
];

// ─── Forbidden phrases (case-insensitive; only safe on finalized text) ────
const FORBIDDEN_PHRASES: readonly string[] = [
  "great question",
  "that's a great question",
  "that is a great question",
  "let me tell you a story",
  "as an ai",
  "i'm just an ai",
  "i am just an ai",
  "according to the manual",
  "based on the documentation",
  "based on my training",
  "per my sources",
];

// ─── Boilerplate openers (strip if they're the first thing) ───────────────
const FORBIDDEN_OPENERS: readonly string[] = [
  "certainly!",
  "absolutely!",
  "i'd be happy to help",
  "i would be happy to help",
];

// ──────────────────────────────────────────────────────────────────────────

/** Normalize characters only. Safe on streamed deltas. */
export function normalizeChars(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [re, replacement] of CHAR_REPLACEMENTS) out = out.replace(re, replacement);
  return out;
}

/**
 * Full normalization for finalized text (KB excerpts, stored message history,
 * or a complete assistant response). Applies character normalization AND
 * strips forbidden phrases and boilerplate openers.
 */
export function normalizeAiTells(text: string): string {
  if (!text) return text;
  let out = normalizeChars(text);

  // Strip forbidden phrases (case-insensitive substring removal).
  for (const phrase of FORBIDDEN_PHRASES) {
    const re = new RegExp(escapeRegExp(phrase), 'gi');
    out = out.replace(re, '');
  }

  // Strip boilerplate openers ONLY at the very start of the text.
  const trimmed = out.trimStart();
  const leadingWhitespace = out.slice(0, out.length - trimmed.length);
  const lowered = trimmed.toLowerCase();
  for (const opener of FORBIDDEN_OPENERS) {
    if (lowered.startsWith(opener)) {
      out = leadingWhitespace + trimmed.slice(opener.length).trimStart();
      break;
    }
  }

  // Collapse double spaces introduced by the substitutions.
  out = out.replace(/ {2,}/g, ' ');
  return out;
}

/**
 * Check a finalized response against all forbidden tokens (used by the eval
 * grader and for lightweight runtime logging — NOT for blocking).
 */
export function findAiTells(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];

  const rawCharPatterns = [
    ['\u2014', 'em-dash'],
    ['\u2013', 'en-dash'],
    ['\u2026', 'ellipsis char'],
    ['\u201C', 'curly open-double'],
    ['\u201D', 'curly close-double'],
    ['\u2018', 'curly open-single'],
    ['\u2019', 'curly close-single'],
  ] as const;
  for (const [ch, name] of rawCharPatterns) {
    if (text.includes(ch)) hits.push(name);
  }

  const lower = text.toLowerCase();
  for (const p of FORBIDDEN_PHRASES) if (lower.includes(p)) hits.push(p);
  for (const o of FORBIDDEN_OPENERS) if (lower.startsWith(o)) hits.push(`opener: ${o}`);
  return hits;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
