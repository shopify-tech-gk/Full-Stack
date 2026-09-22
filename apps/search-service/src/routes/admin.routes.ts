import { Router } from 'express';
import { requireAuth } from '../authMiddleware';
import { requireSearchAdmin } from '../searchAdmin.middleware';
import { fullReindex } from '../search/index.service';

export const adminRouter: Router = Router();

// TEMPORARY manual full-reindex trigger for ops/testing - the real safety
// net is the nightly scheduled job (full-reindex.queue.ts); this exists so
// a rebuild can be forced on demand without waiting for 2 AM.
adminRouter.post('/reindex', requireAuth, requireSearchAdmin, async (_req, res) => {
  const result = await fullReindex();
  res.status(200).json(result);
});
