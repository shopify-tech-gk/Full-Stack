import { Router } from 'express';
import { optionalAuth, requireAuth } from '../authMiddleware';
import { FinderAskBody, FinderListQuery, askFinder, listFinder } from '../finder/finder.service';

// v1.18 Product Finder Live. Mounted at /support/finder (the gateway routes /api/support without
// a login): anyone can read the room, asking needs a signed-in shopper.
export const finderRouter: Router = Router();

finderRouter.get('/messages', optionalAuth, async (req, res) => {
  res.json(await listFinder(req.auth?.userId ?? null, FinderListQuery.parse(req.query)));
});

finderRouter.post('/messages', requireAuth, async (req, res) => {
  res.status(201).json(await askFinder(req.auth?.userId ?? '', FinderAskBody.parse(req.body)));
});
