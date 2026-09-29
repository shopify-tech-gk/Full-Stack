import { Router } from 'express';
import { getShipmentByOrderItem, getTracking } from '../logistics/logistics.service';
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
