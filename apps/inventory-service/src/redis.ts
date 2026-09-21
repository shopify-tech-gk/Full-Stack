import IORedis, { type Redis } from 'ioredis';
import { config } from './config';

let client: Redis | null = null;

/**
 * Single shared ioredis connection for this process (used by the stock
 * lock) - never open a new connection per request. Separate from
 * @youmart/queue's own connection since inventory-service doesn't use
 * BullMQ; this is a plain ioredis client for direct SET/EVAL commands.
 */
export function getRedis(): Redis {
  if (!client) {
    client = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
