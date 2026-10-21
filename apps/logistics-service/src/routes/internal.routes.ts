import { Router } from 'express';
import { getShipmentByAwb, getShipmentByOrderItem, getTracking } from '../logistics/logistics.service';
import { requireServiceAuth } from '../authMiddleware';

export const internalLogisticsRouter: Router = Router();

// SERVICE-ONLY (W1) - order-service's public guest order-track, which has already matched
// orderNumber + phone itself. Same functions as the customer route, minus its userId check.
internalLogisticsRouter.get(
  '/track/order-item/:orderItemId',
  requireServiceAuth,
  async (req, res) => {
    const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
    const shipment = await getShipmentByOrderItem(orderItemId);
    res.status(200).json(await getTracking(shipment.id));
  },
);

// SERVICE-ONLY (v1.16): the same, found by the courier tracking number (AWB). order-service
// still matches the order's phone before showing anything.
internalLogisticsRouter.get('/track/awb/:awb', requireServiceAuth, async (req, res) => {
  const awb = typeof req.params.awb === 'string' ? req.params.awb : '';
  const shipment = await getShipmentByAwb(awb);
  res.status(200).json(await getTracking(shipment.id));
});
