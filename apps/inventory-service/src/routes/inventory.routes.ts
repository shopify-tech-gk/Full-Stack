import { Router } from 'express';
import { SetStockBody, ReserveBody } from '../inventory/inventory.schema';
import { getStock, setStock, reserve, release, commit } from '../inventory/inventory.service';
import { requireAuth } from '../authMiddleware';
import { requireInventoryManager } from '../inventoryManager.middleware';

export const inventoryRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed.

// Protected (requireAuth only) - read by cart/checkout, or an admin UI.
// Service-to-service auth is a plain Bearer token for now; a dedicated
// service-to-service auth mechanism can be added later.
inventoryRouter.get('/:skuId', requireAuth, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const stock = await getStock(skuId);
  res.status(200).json(stock);
});

// Admin op (TEMPORARY manager guard - see inventoryManager.middleware.ts).
inventoryRouter.post('/:skuId/set', requireAuth, requireInventoryManager, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const body = SetStockBody.parse(req.body);
  const stock = await setStock(skuId, body);
  res.status(200).json(stock);
});

// Called by order-service (Ch4.5) during checkout - requireAuth only for now.
inventoryRouter.post('/:skuId/reserve', requireAuth, async (req, res) => {
  const skuId = typeof req.params.skuId === 'string' ? req.params.skuId : '';
  const body = ReserveBody.parse(req.body);
  const result = await reserve(skuId, body);
  res.status(201).json(result);
});

// Called by order-service on payment failure/expiry.
inventoryRouter.post('/reservations/:id/release', requireAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await release(id);
  res.status(204).send();
});

// Called by order-service after payment succeeds.
inventoryRouter.post('/reservations/:id/commit', requireAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await commit(id);
  res.status(204).send();
});
