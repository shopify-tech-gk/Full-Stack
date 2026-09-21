import { Router } from 'express';
import { PaginationQuery } from '@youmart/shared-types';
import { listSellerSettlements, getSellerSettlementDetail } from '../settlement/settlement.service';
import { requireAuth } from '../authMiddleware';
import { requireActiveSeller, requireSellerId } from '../sellerScope.middleware';

export const sellerSettlementRouter: Router = Router();

// SELLER-OWNED path - a seller sees ONLY their own settlements, resolved
// server-side via requireActiveSeller (seller-service), never a
// client-supplied sellerId. Same pattern as catalog/order's Ch5.2
// seller-scoped endpoints.

sellerSettlementRouter.get('/', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const query = PaginationQuery.parse(req.query);
  const result = await listSellerSettlements(sellerId, query);
  res.status(200).json(result);
});

sellerSettlementRouter.get('/:id', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const settlement = await getSellerSettlementDetail(sellerId, id);
  res.status(200).json(settlement);
});
