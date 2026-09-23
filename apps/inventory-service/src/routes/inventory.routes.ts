import { Router } from 'express';
import { SetStockBody, ReserveBody, RestockBody } from '../inventory/inventory.schema';
import {
  getStock,
  setStock,
  reserve,
  release,
  commit,
  releaseByOrder,
  commitByOrder,
  restock,
} from '../inventory/inventory.service';
import { requireServiceAuth, requireAdmin } from '../authMiddleware';

export const inventoryRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed.

// SERVICE-ONLY (Ch6.5) - read by cart/checkout, never a real customer UI.
inventoryRouter.get('/:skuId', requireServiceAuth, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const stock = await getStock(skuId);
  res.status(200).json(stock);
});

// Ch6.7a: real RBAC - requireAdmin('inventory.manage') replaces the
// retired ADMIN_USER_IDS gate (requireInventoryManager).
inventoryRouter.post('/:skuId/set', requireAdmin('inventory.manage'), async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const body = SetStockBody.parse(req.body);
  const stock = await setStock(skuId, body);
  res.status(200).json(stock);
});

// SERVICE-ONLY (Ch6.5) - called by order-service (Ch4.5) during checkout.
inventoryRouter.post('/:skuId/reserve', requireServiceAuth, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const body = ReserveBody.parse(req.body);
  const result = await reserve(skuId, body);
  res.status(201).json(result);
});

// SERVICE-ONLY (Ch6.5) - called by order-service on payment failure/expiry.
inventoryRouter.post('/reservations/:id/release', requireServiceAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await release(id);
  res.status(204).send();
});

// SERVICE-ONLY (Ch6.5) - called by order-service after payment succeeds.
inventoryRouter.post('/reservations/:id/commit', requireServiceAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await commit(id);
  res.status(204).send();
});

// SERVICE-ONLY (Ch6.5) - called by order-service's checkout rollback
// (partial reserve failure) - releases every HELD reservation linked to
// this order via reservation.order_id, without order-service needing to
// track individual reservation ids itself.
inventoryRouter.post('/orders/:orderId/release', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  await releaseByOrder(orderId);
  res.status(204).send();
});

// SERVICE-ONLY (Ch6.5) - called by order/payment-service (Ch4.6) on
// payment success.
inventoryRouter.post('/orders/:orderId/commit', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  await commitByOrder(orderId);
  res.status(204).send();
});

// SERVICE-ONLY (Ch6.5) - called by returns-service (Ch5.5) once a return
// is refunded - see inventory.service.ts's restock doc comment for the
// idempotency caveat (no built-in dedupe key here; the caller must call
// at most once).
inventoryRouter.post('/:skuId/restock', requireServiceAuth, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const body = RestockBody.parse(req.body);
  const stock = await restock(skuId, body);
  res.status(200).json(stock);
});
