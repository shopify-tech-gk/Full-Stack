import { createQueue } from '@youmart/queue';
import { z } from 'zod';

/** Payload is deliberately JUST the orderId - the consumer (invoice-service)
 * always re-fetches the order fresh from order-service at process time
 * rather than trusting a potentially-stale pre-built snapshot in the job
 * payload (same design principle as @youmart/search-reindex-client). */
export const InvoiceGenerationJob = z.object({ orderId: z.string().uuid() });
export type InvoiceGenerationJob = z.infer<typeof InvoiceGenerationJob>;

const INVOICE_GENERATION_QUEUE_NAME = 'invoice-generation';

export const invoiceGenerationQueue = createQueue(
  INVOICE_GENERATION_QUEUE_NAME,
  InvoiceGenerationJob,
);

/**
 * Fire-and-forget enqueue - deliberately NEVER throws. Invoice generation
 * is always secondary to order confirmation itself: a failure here must
 * never undo or fail a real payment capture. The actual PDF generation
 * (with BullMQ retry) happens independently in invoice-service's worker.
 */
export async function enqueueInvoiceGeneration(orderId: string): Promise<void> {
  try {
    await invoiceGenerationQueue.enqueue({ orderId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'failed to enqueue invoice-generation job (non-fatal, order confirm still succeeds)',
      {
        orderId,
        err,
      },
    );
  }
}
