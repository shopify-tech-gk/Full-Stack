import type { Request, RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { sellerClient } from './serviceClients';
import { extractBearerToken } from './authToken';

// Ambient augmentation, same technique @youmart/auth-middleware uses for
// `req.auth` - makes `req.sellerId` available on Express's Request type.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sellerId?: string;
    }
  }
}

/**
 * Resolves the caller's OWN active seller identity via seller-service
 * (settlements_svc cannot read the sellers schema - cross-schema
 * isolation) and attaches it to `req.sellerId`. Requires status APPROVED
 * AND kyc VERIFIED - anyone else gets a 403 "seller not active" either
 * way. Must run after `requireAuth`. Same pattern as catalog-service's and
 * order-service's sellerScope.middleware.ts (Ch5.2).
 */
export const requireActiveSeller: RequestHandler = (req, _res, next) => {
  const authToken = extractBearerToken(req);

  sellerClient
    .getByOwnerMe(authToken)
    .then((identity) => {
      if (!identity.active) {
        next(new AppError('FORBIDDEN', 403, 'seller not active'));
        return;
      }
      req.sellerId = identity.sellerId;
      next();
    })
    .catch((err: unknown) => {
      if (err instanceof AppError && err.code === 'NOT_FOUND') {
        next(new AppError('FORBIDDEN', 403, 'seller not active'));
        return;
      }
      next(err);
    });
};

/** `requireActiveSeller` already guarantees this is set - defensive fallback only. */
export function requireSellerId(req: Request): string {
  const sellerId = req.sellerId;
  if (!sellerId) {
    throw new AppError('FORBIDDEN', 403, 'seller not active');
  }
  return sellerId;
}
