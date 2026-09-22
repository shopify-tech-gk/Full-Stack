import { registerWorker } from '@youmart/queue';
import { SearchReindexJob } from '@youmart/search-reindex-client';
import { upsertProduct } from './index.service';

let worker: ReturnType<typeof registerWorker<SearchReindexJob>> | undefined;

/** Registers the consumer side of the SAME "search-reindex" BullMQ queue
 * catalog-service's `@youmart/search-reindex-client` enqueues onto on
 * every product create/update/status-change/delete. */
export function startReindexWorker(): ReturnType<typeof registerWorker<SearchReindexJob>> {
  worker = registerWorker('search-reindex', SearchReindexJob, async (payload) => {
    await upsertProduct(payload.productId);
  });
  return worker;
}

export async function closeReindexWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
