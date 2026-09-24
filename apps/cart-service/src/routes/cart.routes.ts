import { Router } from 'express';
import { AddItemBody, UpdateItemBody } from '../cart/cart.schema';
import {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
  convertActiveCart,
} from '../cart/cart.service';
import { requireAuth, requireServiceAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const cartRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - a cart is
// always the logged-in user's own cart, identified by req.auth.userId.
// catalog/inventory calls are now made with a self-minted SERVICE token
// (Ch6.5), never the caller's own forwarded bearer token.

cartRouter.get('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const view = await getCart(userId);
  res.status(200).json(view);
});

// SERVICE-ONLY (Ch6.5) - order-service's checkout calls this to read a
// SPECIFIC user's cart. The service token authenticates the CALLER (that
// it really is order-service); `userId` identifies the SUBJECT, passed
// explicitly as a query param rather than implied by a forwarded user
// token (there no longer is one to forward).
cartRouter.get('/internal/me', requireServiceAuth, async (req, res) => {
  const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
  const view = await getCart(userId);
  res.status(200).json(view);
});

// SERVICE-ONLY (Ch6.5) - order-service, right after a successful checkout.
// Same explicit-userId-param pattern as `/internal/me` above. If the
// caller has no ACTIVE cart, this is a benign no-op (see
// convertActiveCart's doc comment) rather than a 404/error.
cartRouter.post('/internal/convert', requireServiceAuth, async (req, res) => {
  const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
  const result = await convertActiveCart(userId);
  res.status(200).json(result);
});

cartRouter.post('/items', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = AddItemBody.parse(req.body);
  const view = await addItem(userId, body.skuId, body.quantity);
  res.status(200).json(view);
});

cartRouter.patch('/items/:cartItemId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const cartItemId = typeof req.params.cartItemId === 'string' ? req.params.cartItemId : '';
  const body = UpdateItemBody.parse(req.body);
  const view = await updateItem(userId, cartItemId, body.quantity);
  res.status(200).json(view);
});

cartRouter.delete('/items/:cartItemId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const cartItemId = typeof req.params.cartItemId === 'string' ? req.params.cartItemId : '';
  const view = await removeItem(userId, cartItemId);
  res.status(200).json(view);
});

cartRouter.post('/clear', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const view = await clearCart(userId);
  res.status(200).json(view);
});
