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
import { requireAuth } from '../authMiddleware';
import { requireLogisticsAdmin } from '../logisticsAdmin.middleware';

export const adminLogisticsRouter: Router = Router();

// PLATFORM-fulfillment path (requireAuth + the TEMPORARY ADMIN_USER_IDS
// guard) - for launch (single-vendor), YouMart itself ships every order,
// so this IS the launch fulfillment path. Express 5 auto-forwards
// rejected promises to the central error handler.

adminLogisticsRouter.post('/shipments', requireAuth, requireLogisticsAdmin, async (req, res) => {
  const body = CreateShipmentBody.parse(req.body);
  const shipment = await createShipment(body);
  res.status(201).json(shipment);
});

adminLogisticsRouter.patch(
  '/shipments/:id/status',
  requireAuth,
  requireLogisticsAdmin,
  async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const body = UpdateShipmentStatusBody.parse(req.body);
    const shipment = await updateShipmentStatus(id, body.status);
    res.status(200).json(shipment);
  },
);

adminLogisticsRouter.post(
  '/shipments/:id/tracking',
  requireAuth,
  requireLogisticsAdmin,
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
  requireAuth,
  requireLogisticsAdmin,
  async (req, res) => {
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const shipment = await markDelivered(id);
    res.status(200).json(shipment);
  },
);

adminLogisticsRouter.get('/shipments/:id', requireAuth, requireLogisticsAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const detail = await getTracking(id);
  res.status(200).json(detail);
});
