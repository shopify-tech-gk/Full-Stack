import { Router } from 'express';
import { CreateAddressBody, UpdateAddressBody } from '../address/address.schema';
import {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getAddressForOrder,
} from '../address/address.service';
import { requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const addressRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - an address
// is always the logged-in user's own; a client-supplied userId is never
// trusted (there isn't one - it always comes from `req.auth.userId`).

// Internal, service-to-service read (order-service checkout, Ch6.1).
// Registered BEFORE '/:id' so "internal" is never swallowed as an :id.
// The caller forwards the end-user's own bearer token (no separate
// service-token mechanism exists yet, same documented stop-gap as every
// other internal endpoint in this repo).
addressRouter.get('/internal/for-order', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const addressId = typeof req.query.addressId === 'string' ? req.query.addressId : '';
  const snapshot = await getAddressForOrder(userId, addressId);
  res.status(200).json(snapshot);
});

addressRouter.get('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const items = await listAddresses(userId);
  res.status(200).json({ items });
});

addressRouter.get('/:id', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const address = await getAddress(userId, id);
  res.status(200).json(address);
});

addressRouter.post('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = CreateAddressBody.parse(req.body);
  const address = await createAddress(userId, body);
  res.status(201).json(address);
});

addressRouter.patch('/:id', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = UpdateAddressBody.parse(req.body);
  const address = await updateAddress(userId, id, body);
  res.status(200).json(address);
});

addressRouter.delete('/:id', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await deleteAddress(userId, id);
  res.status(204).send();
});

addressRouter.post('/:id/default', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const address = await setDefaultAddress(userId, id);
  res.status(200).json(address);
});
