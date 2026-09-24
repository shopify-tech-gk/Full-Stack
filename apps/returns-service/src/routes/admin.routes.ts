import { Router } from 'express';
import { ListReturnsQuery, ApproveReturnBody, RejectReturnBody } from '../returns/returns.schema';
import {
  listReturnsAdmin,
  approveReturn,
  rejectReturn,
  markPickedUp,
  processRefund,
} from '../returns/returns.service';
import { requireAdmin } from '../authMiddleware';

export const adminReturnsRouter: Router = Router();

// Ch6.7a RBAC: `returns.manage` gates the return WORKFLOW (list/approve/
// reject/picked-up); the actual money movement (process-refund) requires
// the separate `refunds.manage` permission - so an OPS admin can run the
// return workflow without also being able to trigger a refund. For launch
// (single-vendor), admin handles the entire return lifecycle - see
// returns.service.ts's seller-side foundation note for the (unbuilt)
// multivendor hook.

adminReturnsRouter.get('/', requireAdmin('returns.manage'), async (req, res) => {
  const query = ListReturnsQuery.parse(req.query);
  const result = await listReturnsAdmin(query);
  res.status(200).json(result);
});

adminReturnsRouter.post('/:id/approve', requireAdmin('returns.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = ApproveReturnBody.parse(req.body);
  const returnRequest = await approveReturn(id, body.refundAmount);
  res.status(200).json(returnRequest);
});

adminReturnsRouter.post('/:id/reject', requireAdmin('returns.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const body = RejectReturnBody.parse(req.body);
  const returnRequest = await rejectReturn(id, body.reason);
  res.status(200).json(returnRequest);
});

adminReturnsRouter.post('/:id/picked-up', requireAdmin('returns.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const returnRequest = await markPickedUp(id);
  res.status(200).json(returnRequest);
});

adminReturnsRouter.post('/:id/process-refund', requireAdmin('refunds.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const result = await processRefund(id);
  res.status(200).json(result);
});
