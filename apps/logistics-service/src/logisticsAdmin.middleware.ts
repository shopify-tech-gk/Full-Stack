import type { RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { config } from './config';

/**
 * TEMPORARY dev-only authorization gate for the platform-fulfillment
 * endpoints - same pattern (and, in dev, the same list) as every other
 * service's ADMIN_USER_IDS guard. Must run after `requireAuth`. For
 * launch (single-vendor), the platform (YouMart itself) ships every
 * order, so this IS the launch fulfillment path. Real RBAC replaces this
 * in Ch6.
 */
export const requireLogisticsAdmin: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.userId;
  if (!userId || !config.adminUserIds.includes(userId)) {
    next(new AppError('FORBIDDEN', 403, 'Not authorized to administer logistics'));
    return;
  }
  next();
};
