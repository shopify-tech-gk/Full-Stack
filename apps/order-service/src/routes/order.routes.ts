import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { PaginationQuery } from '@youmart/shared-types';
import { AppError, buildApiError } from '@youmart/errors';
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
import { adminUpdateSellerItemStatus, listSellerItems } from '../order/seller-order.service';
import { ListSellerItemsQuery } from '../order/seller-order.schema';
import { SettleableItemsQuery } from '../order/settleable.schema';
import { SetSellerItemStatusBody } from '../order/item-status.schema';
import { CheckoutBody } from '../order/checkout.schema';
import { requireAuth, requireServiceAuth, requireAdmin } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const orderRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - an order is
// always the logged-in user's own.

// Ch7.2 hardening: a light PER-USER limit on checkout attempts (on top of
// the existing 30s double-submit guard in order.service.ts, which is an
// idempotency measure, not an abuse guard) - keyed by the authenticated
// userId (never IP, so it can't be defeated/shared by NAT'd users, and
// can't punish other users behind the same IP). Registered AFTER
// requireAuth so req.auth.userId is already populated.
const checkoutRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.userId ?? req.ip ?? 'unknown',
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildApiError('RATE_LIMITED', 'Too many checkout attempts, try again later'));
  },
});

// CHECKOUT SECURITY PRINCIPLE (locked): this handler NEVER reads items or
// prices from req.body - any a client sends here are silently ignored.
// The cart is read server-side and every price is re-derived from catalog
// (order.service.ts's checkout()) - the client can only say "check out my
// cart", never what's in it or what it costs. `addressId` (Ch6.1) is the
// ONE thing the client DOES contribute - which of their OWN saved
// addresses to ship to. Parsed with safeParse (not .parse()) so ANY
// validation failure (missing, wrong type, malformed uuid) surfaces as the
// exact same message, rather than zod's generic "Validation failed".
orderRouter.post('/checkout', requireAuth, checkoutRateLimiter, async (req, res) => {
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

// Ch7.1 fix: ADMIN-driven CONFIRMED->PACKED (see adminUpdateSellerItemStatus's
// doc comment - the default seller has no owning user, so this is the ONLY
// way its items can ever be packed/shipped/delivered/settled).
orderRouter.patch(
  '/admin/items/:orderItemId/status',
  requireAdmin('orders.manage'),
  async (req, res) => {
    const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
    const body = SetSellerItemStatusBody.parse(req.body);
    const item = await adminUpdateSellerItemStatus(orderItemId, body.status);
    res.status(200).json(item);
  },
);

// Ch7.2 hardening: admin previously had NO way to VIEW which order items
// need packing/shipping for a given seller (only the seller-owned
// GET /orders/seller/items, unreachable for the default seller) - reuses
// listSellerItems directly (it already takes sellerId as a plain
// parameter; the seller-owned route just resolves it via
// requireActiveSeller instead of a path param).
orderRouter.get(
  '/admin/sellers/:sellerId/items',
  requireAdmin('orders.manage'),
  async (req, res) => {
    const sellerId = typeof req.params.sellerId === 'string' ? req.params.sellerId : '';
    const query = ListSellerItemsQuery.parse(req.query);
    const result = await listSellerItems(sellerId, query);
    res.status(200).json(result);
  },
);

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
