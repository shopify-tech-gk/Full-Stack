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
  getStockLevels,
  getLowStock,
} from '../inventory/inventory.service';
import { z } from 'zod';
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

// v1.14 admin dashboard: stock for a page of SKUs, and the low-stock report. Registered BEFORE
// the 2-segment `/admin/:skuId` read below.
const StockLevelsBody = z.object({ skuIds: z.array(z.string().uuid()).min(1).max(200) });
inventoryRouter.post('/admin/stock-levels', requireAdmin('inventory.manage'), async (req, res) => {
  const body = StockLevelsBody.parse(req.body);
  res.status(200).json({ items: await getStockLevels(body.skuIds) });
});

const LowStockQuery = z.object({
  threshold: z.coerce.number().int().min(0).max(1000).default(5),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
inventoryRouter.get('/admin/reports/low-stock', requireAdmin('inventory.manage'), async (req, res) => {
  const query = LowStockQuery.parse(req.query);
  res.status(200).json({ items: await getLowStock(query.threshold, query.limit) });
});

// Ch7.2 hardening: admin had no way to VIEW current stock at all before
// this (only the internal service-only read above, and the admin-gated
// `/set` write below) - operationally needed to manage the default
// seller's catalog/inventory end-to-end without a raw DB query. A 2-
// segment path so it can never collide with the 1-segment `/:skuId` above
// regardless of registration order.
inventoryRouter.get('/admin/:skuId', requireAdmin('inventory.manage'), async (req, res) => {
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
