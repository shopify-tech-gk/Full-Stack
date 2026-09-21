import { Router } from 'express';
import { ListReturnsQuery, ApproveReturnBody, RejectReturnBody } from '../returns/returns.schema';
import {
  listReturnsAdmin,
  approveReturn,
  rejectReturn,
  markPickedUp,
  processRefund,
} from '../returns/returns.service';
import { requireAuth } from '../authMiddleware';
import { requireReturnsAdmin } from '../returnsAdmin.middleware';
import { extractBearerToken } from '../authToken';

export const adminReturnsRouter: Router = Router();

// Every route requires requireAuth + the TEMPORARY requireReturnsAdmin
// gate (see returnsAdmin.middleware.ts). For launch (single-vendor), admin
// handles the entire return lifecycle - see returns.service.ts's
// seller-side foundation note for the (unbuilt) multivendor hook.

adminReturnsRouter.get('/', requireAuth, requireReturnsAdmin, async (req, res) => {
  const query = ListReturnsQuery.parse(req.query);
  const result = await listReturnsAdmin(query);
  res.status(200).json(result);
});

adminReturnsRouter.post('/:id/approve', requireAuth, requireReturnsAdmin, async (req, res) => {
  const authToken = extractBearerToken(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = ApproveReturnBody.parse(req.body);
  const returnRequest = await approveReturn(id, body.refundAmount, authToken);
  res.status(200).json(returnRequest);
});

adminReturnsRouter.post('/:id/reject', requireAuth, requireReturnsAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = RejectReturnBody.parse(req.body);
  const returnRequest = await rejectReturn(id, body.reason);
  res.status(200).json(returnRequest);
});

adminReturnsRouter.post('/:id/picked-up', requireAuth, requireReturnsAdmin, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const returnRequest = await markPickedUp(id);
  res.status(200).json(returnRequest);
});

adminReturnsRouter.post(
  '/:id/process-refund',
  requireAuth,
  requireReturnsAdmin,
  async (req, res) => {
    const authToken = extractBearerToken(req);
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const result = await processRefund(id, authToken);
    res.status(200).json(result);
  },
);
