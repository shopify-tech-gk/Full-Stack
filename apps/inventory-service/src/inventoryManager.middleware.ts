import type { RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { config } from './config';

/**
 * TEMPORARY dev-only authorization gate for stock-admin endpoints (setStock).
 * Same pattern as catalog-service's requireCatalogManager - no admin/role
 * claim on access tokens yet (real RBAC lands in Ch6). Must run after
 * `requireAuth` so `req.auth` is populated.
 */
export const requireInventoryManager: RequestHandler = (req, _res, next) => {
  const userId = req.auth?.userId;
  if (!userId || !config.adminUserIds.includes(userId)) {
    next(new AppError('FORBIDDEN', 403, 'Not authorized to manage inventory'));
    return;
  }
  next();
};
