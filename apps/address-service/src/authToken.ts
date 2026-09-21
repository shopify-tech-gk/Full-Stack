import type { Request } from 'express';
import { AppError } from '@youmart/errors';

/** The raw bearer token, forwarded as-is to order-service's internal
 * for-order lookup - the caller acts on their own behalf. `requireAuth`
 * already guarantees a valid token was present, so the error path here is
 * a defensive fallback only. */
export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or missing authentication token');
  }
  return header.slice('Bearer '.length);
}

export function requireUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid or missing authentication token');
  }
  return userId;
}
