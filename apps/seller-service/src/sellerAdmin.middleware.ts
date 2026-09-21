import type { RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { config } from './config';

/**
 * TEMPORARY dev-only authorization gate for the seller-approval endpoints.
 * Access tokens carry no admin/role claim yet (real RBAC lands in Ch6) - so
 * until then, seller administration is restricted to the user ids listed
 * in ADMIN_USER_IDS (same pattern as catalog/inventory's manager guards).
 * Must run after `requireAuth` so `req.auth` is populated. NOT gated by the
 * marketplace hard-off mode (see marketplace-gate.ts) - an admin can manage
 * any existing seller regardless of whether registration is currently open.
 */
export const requireSellerAdmin: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.userId;
  if (!userId || !config.adminUserIds.includes(userId)) {
    next(new AppError('FORBIDDEN', 403, 'Not authorized to administer sellers'));
    return;
  }
  next();
};
