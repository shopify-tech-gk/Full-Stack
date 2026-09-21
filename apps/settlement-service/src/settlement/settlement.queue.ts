import { createQueue, registerWorker } from '@youmart/queue';
import { z } from 'zod';
import { logger } from '../logger';
import { config } from '../config';
import { runSettlementForAllSellers } from './settlement.service';

/**
 * KNOWN LIMITATION (documented, same shape as payment-service's webhook->
 * order-service bridge, flagged since Ch4.6): a scheduled/cron-fired job
 * has no HTTP request context, so there is no end-user bearer token to
 * forward to order-service/seller-service's `requireAuth`-gated internal
 * endpoints - there is no dedicated service-to-service credential yet
 * (Ch6 concern). `serviceToken` exists on this payload for when one does;
 * until then it is never populated by the repeatable scheduler itself, so
 * the worker below detects its absence and logs a clear warning + skips
 * the run rather than 401ing or faking success. The admin manual-trigger
 * endpoint (routes/admin.routes.ts) sidesteps this entirely by running
 * the engine SYNCHRONOUSLY inside the HTTP request, where a real admin
 * bearer token IS available - that is the only path that actually
 * settles anything in this environment today.
 */
export const SettlementRunJob = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  serviceToken: z.string().optional(),
});
export type SettlementRunJob = z.infer<typeof SettlementRunJob>;

export const settlementRunQueue = createQueue('settlement-run', SettlementRunJob);

let worker: ReturnType<typeof registerWorker<SettlementRunJob>> | undefined;

const DEFAULT_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export function startSettlementRunWorker(): ReturnType<typeof registerWorker<SettlementRunJob>> {
  worker = registerWorker('settlement-run', SettlementRunJob, async (payload) => {
    if (!payload.serviceToken) {
      logger.warn(
        'settlement-run job fired with no service credential available - skipping (a real service-to-service auth token is a documented Ch6 dependency)',
      );
      return;
    }

    const periodEnd = payload.periodEnd ? new Date(payload.periodEnd) : new Date();
    const periodStart = payload.periodStart
      ? new Date(payload.periodStart)
      : new Date(periodEnd.getTime() - DEFAULT_PERIOD_MS);

    const results = await runSettlementForAllSellers(periodStart, periodEnd, payload.serviceToken);
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
