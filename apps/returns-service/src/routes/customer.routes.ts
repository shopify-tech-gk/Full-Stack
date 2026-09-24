import { Router } from 'express';
import { PaginationQuery } from '@youmart/shared-types';
import { RequestReturnBody } from '../returns/returns.schema';
import { requestReturn, getMyReturns, getReturn } from '../returns/returns.service';
import { requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const customerReturnsRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts). Every route requires auth - a return is
// always the logged-in user's own.

customerReturnsRouter.post('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = RequestReturnBody.parse(req.body);
  const returnRequest = await requestReturn(userId, body);
  res.status(201).json(returnRequest);
});

customerReturnsRouter.get('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const query = PaginationQuery.parse(req.query);
  const result = await getMyReturns(userId, query);
  res.status(200).json(result);
});

customerReturnsRouter.get('/:id', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const returnRequest = await getReturn(userId, id);
  res.status(200).json(returnRequest);
});
