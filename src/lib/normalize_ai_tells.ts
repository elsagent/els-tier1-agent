/**
 * Scrubs common "AI-tell" punctuation + openers from agent output before it
 * reaches the customer or the DB.
 *
 * Layered defense: the persona prompt (see agents config) forbids these;
 * this function enforces the rule regardless of whether the model obeyed.
 *
 * Applied in two places:
 *   - per-streamed-chunk (before send + before appending to fullAssistantMessage),
 *     so the customer never sees em-dashes in the typing animation
 *   - on the final message before the DB insert (belt-and-suspenders)
 *
 * Intentionally does NOT touch:
 *   - code blocks (em-dashes can appear in code legitimately)
 *   - URLs (smart quotes can appear in query strings, unlikely but possible)
 * Per-chunk mode can't tell whether it's inside a code block, so it normalizes
 * everything. If that bites us on code rendering later, add a streaming-aware
 * fenced-block detector here.
 */

// Character substitutions — the specific Unicode AI tells.
const CHAR_MAP: Array<[RegExp, string]> = [
  [/\u2014/g, '-'],       // em-dash      →  hyphen
  [/\u2013/g, '-'],       // en-dash      →  hyphen
  [/\u2018/g, "'"],       // left single smart quote
  [/\u2019/g, "'"],       // right single smart quote (also apostrophe)
  [/\u201C/g, '"'],       // left double smart quote
  [/\u201D/g, '"'],       // right double smart quote
  [/\u2026/g, '...'],     // ellipsis     →  three dots
  [/\u00A0/g, ' '],       // non-breaking space → regular space
];

// Boilerplate openers that telegraph "this is an LLM". Only stripped when
// they appear at the very start of a message (opening line of the assistant
// turn), not mid-sentence where a user might legitimately echo them back.
const OPENER_PATTERNS: RegExp[] = [
  /^(?:Great question[!.,]?\s+)/i,
  /^(?:That'?s (?:a )?(?:great|excellent|good) question[!.,]?\s+)/i,
  /^(?:Let me tell you (?:a )?story[!.,]?\s+)/i,
  /^(?:Certainly[!.,]?\s+)/i,
  /^(?:Absolutely[!.,]?\s+)/i,
  /^(?:Of course[!.,]?\s+)/i,
  /^(?:I'?d be happy to help[!.,]?\s+)/i,
];

/**
 * Normalize a text fragment. Safe to call on streamed chunks — idempotent,
 * no state, never reintroduces an AI tell.
 */
export function normalizeAiTells(text: string): string {
  if (!text) return text;
  let out = text;
  for (const [pat, rep] of CHAR_MAP) {
    out = out.replace(pat, rep);
  }
  return out;
}

/**
 * Stricter pass for the final assembled message before DB write:
 * character substitutions + strip boilerplate openers. Don't call this
 * per-chunk — it trims leading matches, which breaks mid-stream.
 */
export function normalizeAssistantMessage(text: string): string {
  if (!text) return text;
  let out = normalizeAiTells(text);
  for (const pat of OPENER_PATTERNS) {
    out = out.replace(pat, '');
  }
  return out;
}
