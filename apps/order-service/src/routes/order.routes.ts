import { Router } from 'express';
import { PaginationQuery } from '@youmart/shared-types';
import { checkout, getOrder, getMyOrders } from '../order/order.service';
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
