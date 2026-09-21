import type { RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { config } from './config';

/**
 * TEMPORARY dev-only authorization gate for the settlement-run/list admin
 * endpoints - same pattern (and, in dev, the same list) as every other
 * service's ADMIN_USER_IDS guard. Must run after `requireAuth` so
 * `req.auth` is populated. Real RBAC replaces this in Ch6.
 */
export const requireSettlementAdmin: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.userId;
  if (!userId || !config.adminUserIds.includes(userId)) {
    next(new AppError('FORBIDDEN', 403, 'Not authorized to administer settlements'));
    return;
  }
  next();
};
