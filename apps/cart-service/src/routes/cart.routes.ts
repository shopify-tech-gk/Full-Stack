import { Router } from 'express';
import { AddItemBody, UpdateItemBody } from '../cart/cart.schema';
import { getCart, addItem, updateItem, removeItem, clearCart } from '../cart/cart.service';
import { requireAuth } from '../authMiddleware';
import { extractBearerToken, requireUserId } from '../authToken';

export const cartRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - a cart is
// always the logged-in user's own cart, identified by req.auth.userId.
// The caller's own bearer token is forwarded to catalog/inventory on their
// behalf (see authToken.ts, serviceClients.ts).

cartRouter.get('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const view = await getCart(userId, authToken);
  res.status(200).json(view);
});

cartRouter.post('/items', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const body = AddItemBody.parse(req.body);
  const view = await addItem(userId, body.skuId, body.quantity, authToken);
  res.status(200).json(view);
});

cartRouter.patch('/items/:cartItemId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const cartItemId = typeof req.params.cartItemId === 'string' ? req.params.cartItemId : '';
  const body = UpdateItemBody.parse(req.body);
  const view = await updateItem(userId, cartItemId, body.quantity, authToken);
  res.status(200).json(view);
});

cartRouter.delete('/items/:cartItemId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const cartItemId = typeof req.params.cartItemId === 'string' ? req.params.cartItemId : '';
  const view = await removeItem(userId, cartItemId, authToken);
  res.status(200).json(view);
});

cartRouter.post('/clear', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const view = await clearCart(userId, authToken);
  res.status(200).json(view);
});
