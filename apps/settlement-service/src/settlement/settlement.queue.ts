import { createQueue, registerWorker } from '@youmart/queue';
import { z } from 'zod';
import { logger } from '../logger';
import { config } from '../config';
import { runSettlementForAllSellers } from './settlement.service';

/**
 * Ch6.5 closes the gap this used to document: `runSettlementForAllSellers`
 * now calls order-service/seller-service through @youmart/service-client,
 * which mints its own short-lived HS256 service token per call - a
 * scheduled/cron-fired job (no HTTP request context, no end-user bearer
 * token) authenticates just fine now. No `serviceToken` payload field is
 * needed anymore (removed).
 */
export const SettlementRunJob = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
});
export type SettlementRunJob = z.infer<typeof SettlementRunJob>;

export const settlementRunQueue = createQueue('settlement-run', SettlementRunJob);

let worker: ReturnType<typeof registerWorker<SettlementRunJob>> | undefined;

const DEFAULT_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export function startSettlementRunWorker(): ReturnType<typeof registerWorker<SettlementRunJob>> {
  worker = registerWorker('settlement-run', SettlementRunJob, async (payload) => {
    const periodEnd = payload.periodEnd ? new Date(payload.periodEnd) : new Date();
    const periodStart = payload.periodStart
      ? new Date(payload.periodStart)
      : new Date(periodEnd.getTime() - DEFAULT_PERIOD_MS);

    const results = await runSettlementForAllSellers(periodStart, periodEnd);
    logger.info(
      {
        periodStart,
        periodEnd,
        settled: results.filter((r) => r.settled).length,
        skipped: results.filter((r) => !r.settled).length,
      },
      'scheduled settlement-run completed',
    );
  });
  return worker;
}

export async function closeSettlementRunWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}

/**
 * Registers the REPEATABLE weekly job via BullMQ's job-scheduler API
 * (`TypedQueue.upsertScheduler`). Idempotent - calling this on every
 * service startup updates the existing scheduler in place rather than
 * creating a duplicate schedule. The cron pattern is config-driven
 * (`SETTLEMENT_SCHEDULE_CRON`) so dev can use a short interval for testing
 * without a code change.
 */
export async function scheduleWeeklySettlementRun(): Promise<void> {
  await settlementRunQueue.upsertScheduler(
    'weekly-settlement-run',
    { pattern: config.settlementScheduleCron },
    {},
  );
}
