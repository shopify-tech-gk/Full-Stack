import { Router } from 'express';
import { RunSettlementBody, ListSettlementsQuery } from '../settlement/settlement.schema';
import {
  computeSettlement,
  runSettlementForAllSellers,
  listSettlementsAdmin,
  getSettlementDetailAdmin,
} from '../settlement/settlement.service';
import { requireAuth } from '../authMiddleware';
import { requireSettlementAdmin } from '../settlementAdmin.middleware';
import { extractBearerToken } from '../authToken';

export const adminSettlementRouter: Router = Router();

// Every route requires requireAuth + the TEMPORARY requireSettlementAdmin
// gate (see settlementAdmin.middleware.ts) - NOT the seller-active gate;
// an admin manages settlements for ANY seller.

// MANUAL TRIGGER - runs the engine SYNCHRONOUSLY inside this request,
// forwarding the CALLING ADMIN'S OWN bearer token to order-service/
// seller-service. This is the only path that actually settles anything
// today - see settlement.queue.ts's doc comment on the scheduled job's
// service-credential gap.
adminSettlementRouter.post('/run', requireAuth, requireSettlementAdmin, async (req, res) => {
  const authToken = extractBearerToken(req);
  const body = RunSettlementBody.parse(req.body);
  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);

  if (body.sellerId) {
    const result = await computeSettlement(body.sellerId, periodStart, periodEnd, authToken);
    res.status(200).json({ results: [result] });
    return;
  }

  const results = await runSettlementForAllSellers(periodStart, periodEnd, authToken);
  res.status(200).json({ results });
});

adminSettlementRouter.get('/', requireAuth, requireSettlementAdmin, async (req, res) => {
  const query = ListSettlementsQuery.parse(req.query);
  const result = await listSettlementsAdmin(query);
  res.status(200).json(result);
});

adminSettlementRouter.get('/:id', requireAuth, requireSettlementAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const settlement = await getSettlementDetailAdmin(id);
  res.status(200).json(settlement);
});
