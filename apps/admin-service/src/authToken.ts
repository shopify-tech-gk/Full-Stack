import type { Request } from 'express';
import { AppError } from '@youmart/errors';

/** `requireAdmin()` already guarantees `req.admin` is populated - this is
 * a defensive fallback only, same pattern as every other service's
 * `requireUserId(req)` helper for `req.auth`. */
export function requireAdminId(req: Request): string {
  const adminId = req.admin?.adminId;
  if (!adminId) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or missing authentication token');
  }
  return adminId;
}
