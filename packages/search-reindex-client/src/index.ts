import { createQueue } from '@youmart/queue';
import { z } from 'zod';

/** One entry = "re-derive this product's search-index state from
 * catalog-service's current data" - search-service's worker fetches the
 * product fresh and decides upsert-vs-remove itself (see
 * search-service's `upsertProduct`), so this payload is deliberately just
 * the id, never a pre-built document (catalog is always re-consulted as
 * the source of truth at process time, never trusted from an earlier,
 * possibly-stale enqueue). */
export const SearchReindexJob = z.object({
  productId: z.string().uuid(),
});
export type SearchReindexJob = z.infer<typeof SearchReindexJob>;

const SEARCH_REINDEX_QUEUE_NAME = 'search-reindex';

export const searchReindexQueue = createQueue(SEARCH_REINDEX_QUEUE_NAME, SearchReindexJob);

/**
 * Fire-and-forget enqueue - deliberately NEVER throws. A search-index
 * update is always secondary to the catalog write that triggered it; if
 * Redis/the queue is unreachable, this logs and returns rather than
 * propagating, so the catalog mutation's own response is never blocked or
 * failed by a search-indexing problem. The actual reindex (with BullMQ
 * retry) happens independently in search-service's worker.
 */
export async function enqueueSearchReindex(productId: string): Promise<void> {
  try {
    await searchReindexQueue.enqueue({ productId });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      'failed to enqueue search-reindex job (non-fatal, catalog write still succeeds)',
      {
        productId,
        err,
      },
    );
  }
}
