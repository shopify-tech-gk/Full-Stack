import { Router } from 'express';
import {
  CreateShipmentBody,
  UpdateShipmentStatusBody,
  AddTrackingEventBody,
} from '../logistics/logistics.schema';
import {
  createShipment,
  updateShipmentStatus,
  addTrackingEvent,
  markDelivered,
  getTracking,
} from '../logistics/logistics.service';
import { requireAdmin } from '../authMiddleware';

export const adminLogisticsRouter: Router = Router();

// PLATFORM-fulfillment path (requireAdmin('fulfillment.manage'), Ch6.7a
// RBAC) - for launch (single-vendor), YouMart itself ships every order,
// so this IS the launch fulfillment path. Express 5 auto-forwards
// rejected promises to the central error handler.

adminLogisticsRouter.post('/shipments', requireAdmin('fulfillment.manage'), async (req, res) => {
  const body = CreateShipmentBody.parse(req.body);
  const shipment = await createShipment(body);
  res.status(201).json(shipment);
});

adminLogisticsRouter.patch(
  '/shipments/:id/status',
  requireAdmin('fulfillment.manage'),
  async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const body = UpdateShipmentStatusBody.parse(req.body);
    const shipment = await updateShipmentStatus(id, body.status);
    res.status(200).json(shipment);
  },
);

adminLogisticsRouter.post(
  '/shipments/:id/tracking',
  requireAdmin('fulfillment.manage'),
  async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const body = AddTrackingEventBody.parse(req.body);
    const detail = await addTrackingEvent(id, {
      status: body.status,
      location: body.location,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
    });
    res.status(200).json(detail);
  },
);

adminLogisticsRouter.post(
  '/shipments/:id/delivered',
  requireAdmin('fulfillment.manage'),
  async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const shipment = await markDelivered(id);
    res.status(200).json(shipment);
  },
);

adminLogisticsRouter.get('/shipments/:id', requireAdmin('fulfillment.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const detail = await getTracking(id);
  res.status(200).json(detail);
});
