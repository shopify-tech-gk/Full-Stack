import { Router } from 'express';
import { RunSettlementBody, ListSettlementsQuery } from '../settlement/settlement.schema';
import {
  computeSettlement,
  runSettlementForAllSellers,
  listSettlementsAdmin,
  getSettlementDetailAdmin,
} from '../settlement/settlement.service';
import { requireAdmin } from '../authMiddleware';

export const adminSettlementRouter: Router = Router();

// Ch6.7a RBAC: `settlements.manage` gates actually RUNNING a settlement
// (money movement); `settlements.view` gates read-only list/detail - NOT
// the seller-active gate; an admin manages settlements for ANY seller.

// MANUAL TRIGGER - runs the engine SYNCHRONOUSLY inside this request.
// order-service/seller-service calls now go through @youmart/service-
// client, which mints its own service token per call (Ch6.5) - no user
// token forwarding needed here anymore.
adminSettlementRouter.post('/run', requireAdmin('settlements.manage'), async (req, res) => {
  const body = RunSettlementBody.parse(req.body);
  const periodStart = new Date(body.periodStart);
  const periodEnd = new Date(body.periodEnd);

  if (body.sellerId) {
    const result = await computeSettlement(body.sellerId, periodStart, periodEnd);
    res.status(200).json({ results: [result] });
    return;
  }

  const results = await runSettlementForAllSellers(periodStart, periodEnd);
  res.status(200).json({ results });
});

adminSettlementRouter.get('/', requireAdmin('settlements.view'), async (req, res) => {
  const query = ListSettlementsQuery.parse(req.query);
  const result = await listSettlementsAdmin(query);
  res.status(200).json(result);
});

adminSettlementRouter.get('/:id', requireAdmin('settlements.view'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const settlement = await getSettlementDetailAdmin(id);
  res.status(200).json(settlement);
});
