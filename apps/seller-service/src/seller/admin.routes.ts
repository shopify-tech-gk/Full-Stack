import { Router } from 'express';
import { ListSellersQuery, RejectBody, SetCommissionBody } from './seller.schema';
import {
  listSellers,
  approveSeller,
  rejectSeller,
  suspendSeller,
  reinstateSeller,
  verifyKyc,
  rejectKyc,
  setCommission,
} from './admin.service';
import { requireAuth } from '../authMiddleware';
import { requireSellerAdmin } from '../sellerAdmin.middleware';

export const adminRouter: Router = Router();

// Every route requires requireAuth + the TEMPORARY requireSellerAdmin gate
// (see sellerAdmin.middleware.ts) - NOT the marketplace hard-off gate (see
// marketplace-gate.ts): an admin can manage any existing seller regardless
// of whether self-registration is currently open.

adminRouter.get('/sellers', requireAuth, requireSellerAdmin, async (req, res) => {
  const query = ListSellersQuery.parse(req.query);
  const result = await listSellers(query);
  res.status(200).json(result);
});

adminRouter.post('/sellers/:id/approve', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const seller = await approveSeller(id);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/reject', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = RejectBody.parse(req.body);
  const seller = await rejectSeller(id, body.reason);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/suspend', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const seller = await suspendSeller(id);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/reinstate', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const seller = await reinstateSeller(id);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/kyc/verify', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const kyc = await verifyKyc(id);
  res.status(200).json(kyc);
});

adminRouter.post('/sellers/:id/kyc/reject', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = RejectBody.parse(req.body);
  const kyc = await rejectKyc(id, body.reason);
  res.status(200).json(kyc);
});

adminRouter.post('/sellers/:id/commission', requireAuth, requireSellerAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = SetCommissionBody.parse(req.body);
  const seller = await setCommission(id, body);
  res.status(200).json(seller);
});
