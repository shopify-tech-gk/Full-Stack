import { Router } from 'express';
import { RegisterSellerBody, SubmitKycBody } from './seller.schema';
import { registerSeller, getMySeller, submitKyc } from './seller.service';
import { isSellerActive } from './admin.service';
import { requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const sellerRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts).

// GATED: see marketplace-gate.ts - throws 403 while MARKETPLACE_MODE is
// DISABLED (the default). This is the endpoint that proves the
// marketplace is off by default.
sellerRouter.post('/register', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = RegisterSellerBody.parse(req.body);
  const seller = await registerSeller(userId, body);
  res.status(201).json(seller);
});

sellerRouter.get('/me', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const seller = await getMySeller(userId);
  res.status(200).json(seller);
});

// NOT gated by the marketplace hard-off flag itself - a seller account can
// only exist at all once registration succeeded (which IS gated), so this
// is naturally only reachable for a real seller once the marketplace has
// been opened at least once for that seller's registration.
sellerRouter.post('/me/kyc', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = SubmitKycBody.parse(req.body);
  const kyc = await submitKyc(userId, body);
  res.status(200).json(kyc);
});

// Internal, service-to-service read (for catalog/order once marketplace
// mode is enabled) - requireAuth + a forwarded token for now, same
// temporary pattern as every other service's internal endpoints.
sellerRouter.get('/internal/:id/active', requireAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const result = await isSellerActive(id);
  res.status(200).json(result);
});
