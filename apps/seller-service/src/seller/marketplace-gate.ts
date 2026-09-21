import { AppError } from '@youmart/errors';
import { config } from '../config';

/**
 * THE hard-off enforcement point for the marketplace. `sellers_svc` cannot
 * read `admin.marketplace_settings` (cross-schema isolation), so the mode
 * is injected via the `MARKETPLACE_MODE` env var instead of looked up at
 * runtime - the SAME temporary pattern catalog-service already uses.
 * Ch6's admin service is expected to become the real source of truth
 * (e.g. a cached lookup/webhook from the admin schema); when that lands,
 * flipping the mode to ENABLED opens self-registration with NO code change
 * here - only the config source changes.
 *
 * Only self-registration is gated by this. Admin approval/management
 * endpoints (admin.routes.ts) are NOT gated - an admin can still manage any
 * seller that already exists regardless of the flag; in hard-off mode
 * there simply won't be any real (non-default) sellers to manage yet.
 */
export function assertMarketplaceOpen(): void {
  if (config.marketplaceMode === 'DISABLED') {
    throw new AppError('FORBIDDEN', 403, 'Seller registration is currently disabled');
  }
}
