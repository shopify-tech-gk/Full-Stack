import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { getShipmentByOrderItem, getTracking } from '../logistics/logistics.service';
import { orderClient } from '../serviceClients';
import { requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const customerLogisticsRouter: Router = Router();

// CUSTOMER-FACING tracking - what the storefront shows a buyer. Verifies
// the order_item belongs to ONE OF the requesting user's OWN orders (via
// order-client's userId join) before returning anything - 404 (not 403)
// on a mismatch, same "exists but not yours must be indistinguishable
// from doesn't exist" discipline used everywhere else in this codebase.
customerLogisticsRouter.get('/order-item/:orderItemId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';

  const item = await orderClient.getInternalOrderItem(orderItemId);
  if (item.userId !== userId) {
    throw new AppError('NOT_FOUND', 404, 'Order item not found');
  }

  const shipment = await getShipmentByOrderItem(orderItemId);
  const detail = await getTracking(shipment.id);
  res.status(200).json(detail);
});
