/**
 * Per-user rate limiter for /api/chat.
 *
 * Two modes:
 *   - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set, uses
 *     Upstash REST (sliding window).
 *   - Otherwise, degrades to an in-memory sliding window. Not durable
 *     across instances, but still useful locally and in single-instance
 *     Railway deployments.
 *
 * Designed to protect against runaway OpenAI cost from a buggy client in
 * a loop or a forgotten tab overnight — not against malicious abuse. Staff
 * normally use ~5-15 req/min during active troubleshooting.
 *
 * Limits (defaults; can override via env):
 *   CHAT_RATE_PER_MIN      default 30
 *   CHAT_RATE_PER_DAY      default 500
 */

const PER_MIN = Number(process.env.CHAT_RATE_PER_MIN || 30);
const PER_DAY = Number(process.env.CHAT_RATE_PER_DAY || 500);

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback state.
const memState = new Map<string, { minWindow: number; minCount: number; dayWindow: number; dayCount: number }>();

export type RateResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;      // epoch seconds when the currently-exceeded window resets
  scope: 'minute' | 'day' | 'ok';
  backend: 'upstash' | 'memory';
};

export async function checkRate(userId: string): Promise<RateResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return await checkUpstash(userId);
    } catch (err) {
      console.warn('[rate_limit] upstash error, falling back to memory:', (err as Error).message);
    }
  }
  return checkMemory(userId);
}

function checkMemory(userId: string): RateResult {
  const now = Date.now();
  const minBucket = Math.floor(now / 60_000);
  const dayBucket = Math.floor(now / 86_400_000);
  const s = memState.get(userId) || { minWindow: minBucket, minCount: 0, dayWindow: dayBucket, dayCount: 0 };

  if (s.minWindow !== minBucket) { s.minWindow = minBucket; s.minCount = 0; }
  if (s.dayWindow !== dayBucket) { s.dayWindow = dayBucket; s.dayCount = 0; }

  s.minCount += 1;
  s.dayCount += 1;
  memState.set(userId, s);

  if (s.minCount > PER_MIN) {
    return { allowed: false, limit: PER_MIN, remaining: 0, reset: (minBucket + 1) * 60, scope: 'minute', backend: 'memory' };
  }
  if (s.dayCount > PER_DAY) {
    return { allowed: false, limit: PER_DAY, remaining: 0, reset: (dayBucket + 1) * 86400, scope: 'day', backend: 'memory' };
  }
  return { allowed: true, limit: PER_MIN, remaining: PER_MIN - s.minCount, reset: (minBucket + 1) * 60, scope: 'ok', backend: 'memory' };
}

async function checkUpstash(userId: string): Promise<RateResult> {
  const now = Date.now();
  const minKey = `rl:${userId}:m:${Math.floor(now / 60_000)}`;
  const dayKey = `rl:${userId}:d:${Math.floor(now / 86_400_000)}`;

  // Pipelined INCR + EXPIRE for both keys.
  const pipeline = [
    ['INCR', minKey],
    ['EXPIRE', minKey, '70'],
    ['INCR', dayKey],
    ['EXPIRE', dayKey, '90000'],
  ];
  const r = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pipeline),
    signal: AbortSignal.timeout(1500),
  });
  if (!r.ok) throw new Error(`upstash ${r.status}`);
  const results = (await r.json()) as Array<{ result: number }>;
  const minCount = Number(results[0]?.result || 0);
  const dayCount = Number(results[2]?.result || 0);

  const minBucket = Math.floor(now / 60_000);
  const dayBucket = Math.floor(now / 86_400_000);

  if (minCount > PER_MIN) {
    return { allowed: false, limit: PER_MIN, remaining: 0, reset: (minBucket + 1) * 60, scope: 'minute', backend: 'upstash' };
  }
  if (dayCount > PER_DAY) {
    return { allowed: false, limit: PER_DAY, remaining: 0, reset: (dayBucket + 1) * 86400, scope: 'day', backend: 'upstash' };
  }
  return { allowed: true, limit: PER_MIN, remaining: Math.max(0, PER_MIN - minCount), reset: (minBucket + 1) * 60, scope: 'ok', backend: 'upstash' };
}
