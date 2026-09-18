import { randomUUID } from 'node:crypto';
import { AppError } from '@youmart/errors';
import { getRedis } from '../redis';

// Short TTL so a crashed lock holder self-heals fast instead of jamming a
// SKU forever - 5s is comfortably longer than a single reserve/release/
// commit transaction takes.
const LOCK_TTL_MS = 5000;
const ACQUIRE_RETRY_DELAY_MS = 50;
const ACQUIRE_MAX_ATTEMPTS = 40; // ~2s total retry window before giving up

function lockKey(skuId: string): string {
  return `lock:stock:${skuId}`;
}

// Compare-and-delete: only removes the key if its value still matches the
// token WE set. Without this, a slow holder whose lock already expired
// could delete the NEXT holder's still-valid lock (classic "delete someone
// else's lock" bug).
const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

async function acquireLock(skuId: string): Promise<string> {
  const redis = getRedis();
  const token = randomUUID();
  const key = lockKey(skuId);

  for (let attempt = 0; attempt < ACQUIRE_MAX_ATTEMPTS; attempt += 1) {
    // SET key value NX PX ttl - atomic "set if not held, with expiry".
    const result = await redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX');
    if (result === 'OK') {
      return token;
    }
    await new Promise((resolve) => setTimeout(resolve, ACQUIRE_RETRY_DELAY_MS));
  }

  // Another request is still mid-mutation for this SKU - caller retries later
  // rather than this becoming an unbounded wait.
  throw new AppError('CONFLICT', 409, 'Stock is busy, try again');
}

async function releaseLock(skuId: string, token: string): Promise<void> {
  const redis = getRedis();
  await redis.eval(RELEASE_SCRIPT, 1, lockKey(skuId), token);
}

/**
 * Runs `fn` while holding an exclusive, per-SKU Redis lock - the anti-
 * oversell mechanism. Every stock mutation (reserve/release/commit/set)
 * for a given skuId MUST go through this so concurrent requests for the
 * same SKU are serialized and can't both read-then-write a stale
 * `available` count.
 */
export async function withStockLock<T>(skuId: string, fn: () => Promise<T>): Promise<T> {
  const token = await acquireLock(skuId);
  try {
    return await fn();
  } finally {
    await releaseLock(skuId, token);
  }
}
