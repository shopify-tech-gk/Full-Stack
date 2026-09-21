import type { Request } from 'express';
import { AppError } from '@youmart/errors';

/** `requireAuth` already guarantees a valid token was present, so this is a
 * defensive fallback only (should be unreachable in practice). */
export function requireUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or missing authentication token');
  }
  return userId;
}
