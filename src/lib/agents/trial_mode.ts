/**
 * TRIAL_MODE flag.
 *
 * Set env TRIAL_MODE=true to let Ken (or any SME evaluator) see the agent
 * answer questions it would normally defer on. Instead of escalating for
 * uncertainty, the agent answers from its training so the evaluator can
 * judge the underlying model quality — separate from whether the KB covers
 * the topic.
 *
 * Default: off (production-safe).
 *
 * Implementation: the system prompt gets an appended TRIAL_NOTE that
 * inverts the "never-guess" rule. All other rules (scope, emergencies,
 * voice) stay in force.
 *
 * DELETE THIS FILE AND ITS USAGES BEFORE FINAL HANDOFF. A toggle that
 * exists 18 months later with no one remembering what it does is a
 * liability. Re-introduce if needed for the next eval cycle.
 */

export function isTrialMode(): boolean {
  return process.env.TRIAL_MODE === 'true' || process.env.TRIAL_MODE === '1';
}

export const TRIAL_NOTE = `# TRIAL MODE OVERRIDE (evaluator use only)

This is a trial-mode session. A subject-matter expert is evaluating the
underlying model quality, not production behavior.

- OVERRIDE the "never-guess" rule: answer from your training even when the
  knowledge base doesn't explicitly cover the topic. Be upfront that you're
  answering from general knowledge ("I don't have this exact procedure in
  front of me, but in general…") so the evaluator can tell.
- DO NOT override: scope (still SALTO-only, deflect other brands), emergencies
  (still short-circuit), voice (still no em-dashes / AI tells), sourcing
  (still never cite file names).
- DO NOT call escalate_to_human just because you're uncertain. Answer, then
  note uncertainty.

Every other rule above still applies.`;

/**
 * Return the appendix to add to the system prompt when trial mode is on.
 * Empty string when off. The agent runners concat this to the tier prompt.
 */
export function trialModeAppendix(): string {
  return isTrialMode() ? `\n\n---\n\n${TRIAL_NOTE}` : '';
}
