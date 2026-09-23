import { registerWorker } from '@youmart/queue';
import { InvoiceGenerationJob } from '@youmart/invoice-client';
import { generateInvoice } from './invoice.service';
import { logger } from '../logger';

let worker: ReturnType<typeof registerWorker<InvoiceGenerationJob>> | undefined;

/** Registers the consumer side of the SAME "invoice-generation" BullMQ
 * queue order-service's `@youmart/invoice-client` enqueues onto right
 * after an order transitions to CONFIRMED. `generateInvoice` is itself
 * idempotent, so a BullMQ retry (e.g. after a transient order-service/
 * catalog-service outage) never produces a duplicate invoice. */
export function startInvoiceGenerationWorker(): ReturnType<
  typeof registerWorker<InvoiceGenerationJob>
> {
  worker = registerWorker('invoice-generation', InvoiceGenerationJob, async (payload) => {
    const invoice = await generateInvoice(payload.orderId);
    logger.info(
      { orderId: payload.orderId, invoiceNumber: invoice.invoiceNumber },
      'invoice-generation job processed',
    );
  });
  return worker;
}

export async function closeInvoiceGenerationWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
