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
import { requireAdmin } from '../authMiddleware';

export const adminRouter: Router = Router();

// DORMANT MULTIVENDOR BASEMENT (Ch6.7a): every route here requires a
// `sellers.approve`/`sellers.kyc` permission, granted to SUPER_ADMIN only
// - not exercised at single-vendor launch (seller self-registration is
// still hard-off, Ch6.1) - NOT the marketplace hard-off gate (see
// marketplace-gate.ts): an admin can manage any existing seller regardless
// of whether self-registration is currently open.

adminRouter.get('/sellers', requireAdmin('sellers.approve'), async (req, res) => {
  const query = ListSellersQuery.parse(req.query);
  const result = await listSellers(query);
  res.status(200).json(result);
});

adminRouter.post('/sellers/:id/approve', requireAdmin('sellers.approve'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const seller = await approveSeller(id);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/reject', requireAdmin('sellers.approve'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = RejectBody.parse(req.body);
  const seller = await rejectSeller(id, body.reason);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/suspend', requireAdmin('sellers.approve'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const seller = await suspendSeller(id);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/reinstate', requireAdmin('sellers.approve'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const seller = await reinstateSeller(id);
  res.status(200).json(seller);
});

adminRouter.post('/sellers/:id/kyc/verify', requireAdmin('sellers.kyc'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const kyc = await verifyKyc(id);
  res.status(200).json(kyc);
});

adminRouter.post('/sellers/:id/kyc/reject', requireAdmin('sellers.kyc'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = RejectBody.parse(req.body);
  const kyc = await rejectKyc(id, body.reason);
  res.status(200).json(kyc);
});

adminRouter.post('/sellers/:id/commission', requireAdmin('sellers.approve'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = SetCommissionBody.parse(req.body);
  const seller = await setCommission(id, body);
  res.status(200).json(seller);
});
