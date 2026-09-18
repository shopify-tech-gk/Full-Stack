import type { RequestHandler } from 'express';
import { config } from './config';
import { AppError } from './errors';

/**
 * TEMPORARY dev-only authorization gate for catalog write endpoints.
 * Access tokens carry no admin/role claim yet (real RBAC lands in Ch6) - so
 * until then, catalog management is restricted to the user ids listed in
 * ADMIN_USER_IDS. Must run after `requireAuth` so `req.auth` is populated.
 * REPLACE with a real role check once Ch6 wires roles into JWT claims or an
 * admin schema lookup.
 */
export const requireCatalogManager: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.userId;
  if (!userId || !config.adminUserIds.includes(userId)) {
    next(new AppError('FORBIDDEN', 403, 'Not authorized to manage the catalog'));
    return;
  }
  next();
};
