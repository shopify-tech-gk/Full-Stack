import { Router } from 'express';
import { CreateShipmentBody } from '../logistics/logistics.schema';
import { createShipment } from '../logistics/logistics.service';
import { requireAuth } from '../authMiddleware';
import { requireActiveSeller, requireSellerId } from '../sellerScope.middleware';

export const sellerLogisticsRouter: Router = Router();

// SELLER-FULFILLED path (Ch5.4 FOUNDATION) - a seller may create a
// shipment for THEIR OWN order_item (ownership enforced in
// logistics.service.ts's createShipment via `actorSellerId`). NOT
// exercised at launch (single-vendor = platform/admin ships everything,
// see routes/admin.routes.ts) - registered now so the moment the
// marketplace opens, sellers can self-fulfill with no code change.
sellerLogisticsRouter.post('/shipments', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const body = CreateShipmentBody.parse(req.body);
  const shipment = await createShipment({ ...body, fulfillmentMode: 'SELLER' }, sellerId);
  res.status(201).json(shipment);
});
