import { createQueue, registerWorker } from '@youmart/queue';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../logger';
import { fullReindex } from './index.service';

const FullReindexJob = z.object({});
type FullReindexJob = z.infer<typeof FullReindexJob>;

const FULL_REINDEX_QUEUE_NAME = 'search-full-reindex';

export const fullReindexQueue = createQueue(FULL_REINDEX_QUEUE_NAME, FullReindexJob);

let worker: ReturnType<typeof registerWorker<FullReindexJob>> | undefined;

export function startFullReindexWorker(): ReturnType<typeof registerWorker<FullReindexJob>> {
  worker = registerWorker(FULL_REINDEX_QUEUE_NAME, FullReindexJob, async () => {
    await fullReindex();
  });
  return worker;
}

export async function closeFullReindexWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}

/**
 * The NIGHTLY safety net (Ch6.3): a BullMQ repeatable "job scheduler"
 * (`upsertScheduler`, the same pattern settlement-service's weekly job
 * uses, Ch5.3) that fires `fullReindex()` on `FULL_REINDEX_SCHEDULE_CRON`
 * (default `0 2 * * *` - 2 AM daily). Idempotent: re-registering on every
 * service restart updates the existing schedule in place rather than
 * creating a duplicate. This is what SELF-HEALS any product that the
 * event-driven path missed (e.g. a reindex job that failed after
 * exhausting its retries, or an out-of-band DB fix) - Typesense can never
 * permanently drift from Postgres for more than one night.
 */
export async function scheduleNightlyFullReindex(): Promise<void> {
  await fullReindexQueue.upsertScheduler(
    'nightly-full-reindex',
    { pattern: config.fullReindexScheduleCron },
    {},
  );
  logger.info(
    { cron: config.fullReindexScheduleCron },
    'nightly full-reindex scheduler registered',
  );
}
