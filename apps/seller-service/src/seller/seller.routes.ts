import { Router } from 'express';
import { RegisterSellerBody, SubmitKycBody } from './seller.schema';
import { registerSeller, getMySeller, submitKyc, getMySellerIdentity } from './seller.service';
import { isSellerActive, listActiveSellers } from './admin.service';
import { requireAuth, requireServiceAuth } from '../authMiddleware';
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

// SERVICE-ONLY (Ch6.5) - for catalog/order once marketplace mode is
// enabled.
sellerRouter.get('/internal/:id/active', requireServiceAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const result = await isSellerActive(id);
  res.status(200).json(result);
});

// SERVICE-ONLY (Ch6.5) - "who is THIS user's own seller, and are they
// active". `userId` is now an EXPLICIT path param (Ch6.5's caller-vs-
// subject design) rather than implied by a forwarded user token - the
// service token authenticates the CALLER (catalog/order/logistics/
// settlement-service), `userId` identifies the SUBJECT. Backs
// @youmart/service-client's `sellerClient.getByOwner`.
sellerRouter.get('/internal/by-owner/:userId', requireServiceAuth, async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId : '';
  const identity = await getMySellerIdentity(userId);
  res.status(200).json(identity);
});

// SERVICE-ONLY (Ch6.5) - every APPROVED+VERIFIED seller (Ch5.3), used by
// settlement-service's runSettlementForAllSellers to iterate sellers
// without ever querying the sellers schema directly.
sellerRouter.get('/internal/active-list', requireServiceAuth, async (_req, res) => {
  const items = await listActiveSellers();
  res.status(200).json({ items });
});
