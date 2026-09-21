import type { RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { config } from './config';

/**
 * TEMPORARY dev-only authorization gate for the return-management
 * endpoints - same pattern (and, in dev, the same list) as every other
 * service's ADMIN_USER_IDS guard. For launch (single-vendor), admin
 * handles every return end-to-end - see returns.service.ts's seller-side
 * foundation note for where a future seller-approval path would hook in.
 * Real RBAC replaces this in Ch6.
 */
export const requireReturnsAdmin: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.userId;
  if (!userId || !config.adminUserIds.includes(userId)) {
    next(new AppError('FORBIDDEN', 403, 'Not authorized to administer returns'));
    return;
  }
  next();
};
