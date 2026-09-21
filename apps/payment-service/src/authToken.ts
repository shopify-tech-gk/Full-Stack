import type { Request } from 'express';
import { AppError } from '@youmart/errors';

/** The raw bearer token, forwarded as-is to order-service - the user acts
 * on their own behalf on downstream calls. `requireAuth` already guarantees
 * a valid token was present, so the error path here is a defensive
 * fallback only (should be unreachable in practice). */
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
