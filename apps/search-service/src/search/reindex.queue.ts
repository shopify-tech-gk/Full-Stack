import { getConnection, registerWorker } from '@youmart/queue';
import { SearchReindexJob } from '@youmart/search-reindex-client';
import { upsertProduct } from './index.service';

let worker: ReturnType<typeof registerWorker<SearchReindexJob>> | undefined;

/** Jobs processed at once. Each job is one catalog read + one Typesense upsert, independent of the
 * others (same product twice is an idempotent upsert), so a catalog import's thousands of queued
 * products index ~8x faster than one at a time without overloading catalog-service. */
const REINDEX_CONCURRENCY = 8;

/** Registers the consumer side of the SAME "search-reindex" BullMQ queue
 * catalog-service's `@youmart/search-reindex-client` enqueues onto on
 * every product create/update/status-change/delete. */
export function startReindexWorker(): ReturnType<typeof registerWorker<SearchReindexJob>> {
  worker = registerWorker(
    'search-reindex',
    SearchReindexJob,
    async (payload) => {
      await upsertProduct(payload.productId);
    },
    { connection: getConnection(), concurrency: REINDEX_CONCURRENCY },
  );
  return worker;
}

export async function closeReindexWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = undefined;
  }
}
