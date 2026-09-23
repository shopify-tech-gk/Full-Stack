import { Router } from 'express';
import { PaginationQuery } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
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
import { CheckoutBody } from '../order/checkout.schema';
import { requireAuth, requireServiceAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const orderRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - an order is
// always the logged-in user's own.

// CHECKOUT SECURITY PRINCIPLE (locked): this handler NEVER reads items or
// prices from req.body - any a client sends here are silently ignored.
// The cart is read server-side and every price is re-derived from catalog
// (order.service.ts's checkout()) - the client can only say "check out my
// cart", never what's in it or what it costs. `addressId` (Ch6.1) is the
// ONE thing the client DOES contribute - which of their OWN saved
// addresses to ship to. Parsed with safeParse (not .parse()) so ANY
// validation failure (missing, wrong type, malformed uuid) surfaces as the
// exact same message, rather than zod's generic "Validation failed".
orderRouter.post('/checkout', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const parsed = CheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 400, 'a shipping address is required');
  }
  const order = await checkout(userId, parsed.data.addressId);
  res.status(201).json(order);
});

// --- Internal/service endpoints (called by payment-service, invoice-
// service, and settlement-service) - ALL SERVICE-ONLY (Ch6.5): a service
// token authenticates the CALLER, never a forwarded user token. Registered
// BEFORE the generic GET /:id below so "internal" is never swallowed as
// an :id.

// Registered BEFORE '/internal/:orderId' - otherwise "settleable" would be
// swallowed as :orderId.
orderRouter.get('/internal/settleable', requireServiceAuth, async (req, res) => {
  const query = SettleableItemsQuery.parse(req.query);
  const items = await getSettleableItems(query.sellerId, new Date(query.from), new Date(query.to));
  res.status(200).json({ items });
});

orderRouter.get('/internal/:orderId', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const order = await getInternalOrder(orderId);
  res.status(200).json(order);
});

// SERVICE-ONLY (Ch6.5) - invoice-service's queue worker has no forwarded
// user token at all (it's triggered by a BullMQ job, not an inbound HTTP
// request); a minted service token is what authenticates this call now.
// Returns the exact same InternalOrderView shape (incl. items) as the
// route above.
orderRouter.get('/internal/for-invoice/:orderId', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  const order = await getInternalOrder(orderId);
  res.status(200).json(order);
});

// Internal reads/writes for logistics-service (Ch5.4). "items" as the 2nd
// segment never collides with the ":orderId" routes above/below (different
// segment counts either way).
orderRouter.get('/internal/items/:orderItemId', requireServiceAuth, async (req, res) => {
  const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
  const item = await getInternalOrderItem(orderItemId);
  res.status(200).json(item);
});

// LOGISTICS-DRIVEN seller_status transitions (PACKED->SHIPPED->DELIVERED) -
// the counterpart to the seller-driven CONFIRMED->PACKED path (Ch5.2's
// /orders/seller/items/:orderItemId/status). See order.service.ts's
// setSellerItemStatusInternal for the allowed-transitions table.
orderRouter.post(
  '/internal/items/:orderItemId/seller-status',
  requireServiceAuth,
  async (req, res) => {
    const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
    const body = SetSellerItemStatusBody.parse(req.body);
    const item = await setSellerItemStatusInternal(orderItemId, body.status);
    res.status(200).json(item);
  },
);

orderRouter.post('/internal/:orderId/confirm', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  await confirmOrder(orderId);
  res.status(200).json({ confirmed: true });
});

orderRouter.post('/internal/:orderId/cancel', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  await cancelOrderForPaymentFailure(orderId);
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
