#!/usr/bin/env node
/**
 * ELS pre-deploy smoke test.
 *
 * Six probes, <30s, <$0.01. Exits non-zero on any failure.
 * Run locally: `node scripts/smoke-test.mjs`
 * CI / pre-deploy: wire into Railway pre-deploy hook or GitHub Actions.
 *
 * Required env (read from process.env — load .env.local yourself if running local):
 *   OPENAI_API_KEY
 *   OPENAI_VECTOR_STORE_ID
 *   TRIAGE_WORKFLOW_ID | TIER1_WORKFLOW_ID | TIER2_WORKFLOW_ID  (or *_ASSISTANT_ID)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   FALLBACK_MODEL              default: gpt-4o-mini
 *   SMOKE_TEST_URLS             comma-separated health URLs to probe
 *   SMOKE_TEST_SKIP             comma-separated probe names to skip:
 *                               env,supabase,assistants,vectorstore,model,health
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = [
  'OPENAI_API_KEY',
  'OPENAI_VECTOR_STORE_ID',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

// Accept either *_WORKFLOW_ID (legacy) or *_ASSISTANT_ID (current Railway convention).
const ASSISTANT_ENV_KEYS = [
  'TRIAGE_WORKFLOW_ID',
  'TIER1_WORKFLOW_ID',
  'TIER2_WORKFLOW_ID',
  'TRIAGE_ASSISTANT_ID',
  'TIER1_ASSISTANT_ID',
  'TIER2_ASSISTANT_ID',
];

const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'gpt-4o-mini';
const SKIP = new Set((process.env.SMOKE_TEST_SKIP || '').split(',').map((s) => s.trim()).filter(Boolean));
const HEALTH_URLS = (process.env.SMOKE_TEST_URLS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const isTTY = process.stdout.isTTY;
const c = {
  green: (s) => (isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s) => (isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s) => (isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  dim: (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s),
};

const results = [];
function record(name, ok, detail, skipped = false) {
  results.push({ name, ok, detail, skipped });
  const tag = skipped ? c.yellow('SKIP') : ok ? c.green(' OK ') : c.red('FAIL');
  console.log(`  [${tag}] ${name}  ${c.dim(detail || '')}`);
}

async function probe(name, fn) {
  if (SKIP.has(name)) {
    record(name, true, 'skipped via SMOKE_TEST_SKIP', true);
    return;
  }
  const t0 = Date.now();
  try {
    const detail = await fn();
    record(name, true, `${detail || 'ok'} (${Date.now() - t0}ms)`);
  } catch (err) {
    record(name, false, err?.message || String(err));
  }
}

async function probeEnv() {
  const missing = [];
  const placeholder = [];
  for (const key of REQUIRED_ENV) {
    const v = process.env[key];
    if (!v) missing.push(key);
    else if (v.startsWith('CHANGE_ME_')) placeholder.push(key);
  }
  const assistantIds = ASSISTANT_ENV_KEYS.filter((k) => process.env[k]);
  if (assistantIds.length === 0) {
    missing.push(`at least one of ${ASSISTANT_ENV_KEYS.join('/')}`);
  }
  if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
  if (placeholder.length) throw new Error(`CHANGE_ME_ placeholder still set for: ${placeholder.join(', ')}`);
  if (!process.env.OPENAI_API_KEY.startsWith('sk-')) throw new Error('OPENAI_API_KEY does not start with sk-');
  if (!process.env.OPENAI_VECTOR_STORE_ID.startsWith('vs_')) throw new Error('OPENAI_VECTOR_STORE_ID does not start with vs_');
  for (const k of assistantIds) {
    if (!process.env[k].startsWith('asst_') && !process.env[k].startsWith('wf_')) {
      throw new Error(`${k} does not start with asst_ or wf_`);
    }
  }
  return `${REQUIRED_ENV.length} required + ${assistantIds.length} assistant IDs`;
}

async function probeSupabase() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const { error, count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true });
  if (error) {
    const { error: authErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (authErr) throw new Error(`supabase unreachable: ${error.message}`);
    return 'reachable (messages table not found; auth ok)';
  }
  return `reachable, messages count: ${count ?? 'unknown'}`;
}

async function probeAssistants(openai) {
  const checked = [];
  for (const key of ASSISTANT_ENV_KEYS) {
    const id = process.env[key];
    if (!id) continue;
    if (id.startsWith('asst_')) {
      const a = await openai.beta.assistants.retrieve(id);
      checked.push(`${key}=${a.id.slice(0, 14)}…`);
    } else {
      checked.push(`${key}=${id.slice(0, 14)}… (workflow — skipped retrieve)`);
    }
  }
  if (checked.length === 0) throw new Error('no assistant IDs to verify');
  return checked.join(', ');
}

async function probeVectorStore(openai) {
  const id = process.env.OPENAI_VECTOR_STORE_ID;
  const vs = await openai.vectorStores.retrieve(id);
  const fileCount = vs.file_counts?.completed ?? vs.file_counts?.total ?? 0;
  if (fileCount === 0) throw new Error(`vector store exists but has 0 completed files`);
  return `${fileCount} indexed files`;
}

async function probeModel(openai) {
  const res = await openai.responses.create({
    model: FALLBACK_MODEL,
    input: 'Reply with the single word: pong',
    max_output_tokens: 16,
  });
  const text = res.output_text?.trim().toLowerCase() || '';
  if (!text.includes('pong')) throw new Error(`unexpected response from ${FALLBACK_MODEL}: "${text.slice(0, 40)}"`);
  const usage = res.usage;
  return `${FALLBACK_MODEL} ok (${usage?.input_tokens ?? '?'}→${usage?.output_tokens ?? '?'} tok)`;
}

async function probeHealth() {
  if (HEALTH_URLS.length === 0) {
    throw new Error('SMOKE_TEST_URLS not set — set comma-separated /api/health URLs to enable');
  }
  const failures = [];
  for (const url of HEALTH_URLS) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) failures.push(`${url}→${r.status}`);
    } catch (err) {
      failures.push(`${url}→${err.message}`);
    }
  }
  if (failures.length) throw new Error(failures.join('; '));
  return `${HEALTH_URLS.length}/${HEALTH_URLS.length} healthy`;
}

async function main() {
  console.log(c.bold('\nELS smoke test'));
  console.log(c.dim(`  fallback model: ${FALLBACK_MODEL}`));
  console.log(c.dim(`  skipped: ${[...SKIP].join(',') || 'none'}\n`));
  await probe('env', probeEnv);
  if (!results[0].ok && !results[0].skipped) {
    console.log(c.red('\nenv probe failed; skipping downstream probes.\n'));
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  await probe('supabase', probeSupabase);
  await probe('assistants', () => probeAssistants(openai));
  await probe('vectorstore', () => probeVectorStore(openai));
  await probe('model', () => probeModel(openai));
  await probe('health', probeHealth);

  const failed = results.filter((r) => !r.ok && !r.skipped);
  const passed = results.filter((r) => r.ok && !r.skipped);
  const skipped = results.filter((r) => r.skipped);
  console.log('');
  if (failed.length === 0) {
    console.log(c.green(`  ✓ ${passed.length} passed`) + c.dim(`${skipped.length ? `, ${skipped.length} skipped` : ''}\n`));
    process.exit(0);
  } else {
    console.log(c.red(`  ✗ ${failed.length} failed`) + c.dim(`, ${passed.length} passed${skipped.length ? `, ${skipped.length} skipped` : ''}\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(c.red('\nsmoke test crashed:'), err);
  process.exit(2);
});
