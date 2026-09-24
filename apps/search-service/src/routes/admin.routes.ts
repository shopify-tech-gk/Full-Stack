import { Router } from 'express';
import { requireAdmin } from '../authMiddleware';
import { fullReindex } from '../search/index.service';

export const adminRouter: Router = Router();

// Manual full-reindex trigger for ops/testing (Ch6.7a: requireAdmin
// ('search.manage')) - the real safety net is the nightly scheduled job
// (full-reindex.queue.ts); this exists so a rebuild can be forced on
// demand without waiting for 2 AM.
adminRouter.post('/reindex', requireAdmin('search.manage'), async (_req, res) => {
  const result = await fullReindex();
  res.status(200).json(result);
});
