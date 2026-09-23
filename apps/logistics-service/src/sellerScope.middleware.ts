import type { Request, RequestHandler } from 'express';
import { AppError } from '@youmart/errors';
import { sellerClient } from './serviceClients';
import { requireUserId } from './authToken';

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
 * (logistics_svc cannot read the sellers schema - cross-schema isolation)
 * and attaches it to `req.sellerId`. Same pattern as catalog/order/
 * settlement-service's Ch5.2/5.3 sellerScope.middleware.ts.
 *
 * FOUNDATION, not exercised at launch: single-vendor launch means every
 * shipment is PLATFORM-fulfilled (see logisticsAdmin.middleware.ts) - this
 * gate exists so the seller-fulfilled path is ready the moment the
 * marketplace opens, with no code change needed then.
 */
export const requireActiveSeller: RequestHandler = (req, _res, next) => {
  const userId = requireUserId(req);

  sellerClient
    .getByOwner(userId)
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
