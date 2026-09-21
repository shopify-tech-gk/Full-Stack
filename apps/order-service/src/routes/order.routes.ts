import { Router } from 'express';
import { PaginationQuery } from '@youmart/shared-types';
import {
  checkout,
  getOrder,
  getMyOrders,
  getInternalOrder,
  confirmOrder,
  cancelOrderForPaymentFailure,
  getSettleableItems,
  getInternalOrderItem,
  setSellerItemStatusInternal,
} from '../order/order.service';
import { SettleableItemsQuery } from '../order/settleable.schema';
import { SetSellerItemStatusBody } from '../order/item-status.schema';
import { requireAuth } from '../authMiddleware';
import { extractBearerToken, requireUserId } from '../authToken';

export const orderRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - an order is
// always the logged-in user's own.

// CHECKOUT SECURITY PRINCIPLE (locked): this handler NEVER reads req.body -
// any items/prices a client sends here are silently ignored. The cart is
// read server-side and every price is re-derived from catalog
// (order.service.ts's checkout()) - the client can only say "check out my
// cart", never what's in it or what it costs.
orderRouter.post('/checkout', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const order = await checkout(userId, authToken);
  res.status(201).json(order);
});

// --- Internal/service endpoints (called by payment-service, Ch4.6, and
// settlement-service, Ch5.3) ---
// Registered BEFORE the generic GET /:id below so "internal" is never
// swallowed as an :id. Protected by requireAuth + a forwarded token for
// now (no ownership filter on the GET - the caller does its own ownership
// check); a dedicated service-to-service auth mechanism is a documented
// future improvement.

// Registered BEFORE '/internal/:orderId' - otherwise "settleable" would be
// swallowed as :orderId.
orderRouter.get('/internal/settleable', requireAuth, async (req, res) => {
  const query = SettleableItemsQuery.parse(req.query);
  const items = await getSettleableItems(query.sellerId, new Date(query.from), new Date(query.to));
  res.status(200).json({ items });
});

orderRouter.get('/internal/:orderId', requireAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const order = await getInternalOrder(orderId);
  res.status(200).json(order);
});

// Internal reads/writes for logistics-service (Ch5.4). "items" as the 2nd
// segment never collides with the ":orderId" routes above/below (different
// segment counts either way).
orderRouter.get('/internal/items/:orderItemId', requireAuth, async (req, res) => {
  const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
  const item = await getInternalOrderItem(orderItemId);
  res.status(200).json(item);
});

// LOGISTICS-DRIVEN seller_status transitions (PACKED->SHIPPED->DELIVERED) -
// the counterpart to the seller-driven CONFIRMED->PACKED path (Ch5.2's
// /orders/seller/items/:orderItemId/status). See order.service.ts's
// setSellerItemStatusInternal for the allowed-transitions table.
orderRouter.post('/internal/items/:orderItemId/seller-status', requireAuth, async (req, res) => {
  const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
  const body = SetSellerItemStatusBody.parse(req.body);
  const item = await setSellerItemStatusInternal(orderItemId, body.status);
  res.status(200).json(item);
});

orderRouter.post('/internal/:orderId/confirm', requireAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const authToken = extractBearerToken(req);
  await confirmOrder(orderId, authToken);
  res.status(200).json({ confirmed: true });
});

orderRouter.post('/internal/:orderId/cancel', requireAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const authToken = extractBearerToken(req);
  await cancelOrderForPaymentFailure(orderId, authToken);
  res.status(200).json({ cancelled: true });
});

orderRouter.get('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const query = PaginationQuery.parse(req.query);
  const result = await getMyOrders(userId, query);
  res.status(200).json(result);
});

orderRouter.get('/:id', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const order = await getOrder(userId, id);
  res.status(200).json(order);
});
