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
 * (catalog_svc cannot read the sellers schema - cross-schema isolation)
 * and attaches it to `req.sellerId`. Requires status APPROVED AND kyc
 * VERIFIED (seller-service's `active` flag) - anyone else (no seller
 * owned, or owned-but-not-active) gets a 403 "seller not active", the
 * same message either way so a caller can't learn which. Must run after
 * `requireAuth`.
 *
 * This is the SELLER-OWNED counterpart to `catalogManager.middleware.ts`'s
 * `requireCatalogManager` (the TEMPORARY ADMIN_USER_IDS gate) - the admin
 * guard is untouched and keeps managing ANY seller's catalog (in
 * particular the default seller's, in hard-off mode); this gate is for a
 * seller managing ONLY their own. Real platform-admin RBAC is still Ch6
 * work - this prompt only introduces seller-ownership scoping.
 *
 * Ch6.5: `sellerClient.getByOwner` now authenticates the CALL itself with
 * a self-minted service token; `userId` (this request's OWN verified
 * user, from `requireAuth`) is passed explicitly as the SUBJECT - no
 * token forwarding involved.
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
