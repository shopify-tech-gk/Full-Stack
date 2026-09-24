import { AppError } from '@youmart/errors';
import { logger } from '../logger';
import { settingsClient } from '../serviceClients';

/**
 * THE hard-off enforcement point for the marketplace. Ch6.7b: reads
 * `marketplace_mode` from admin-service's authoritative settings row via
 * `settingsClient` (cached client-side, default 30s TTL) - flipping
 * `PATCH /admin/settings` opens/closes self-registration with NO code
 * change, NO redeploy, NO env edit (within the cache TTL).
 *
 * FAIL-CLOSED (safety-critical): if the settings can't be fetched AND the
 * client has no cached value at all (`settingsClient.getSettings()`
 * rethrows in that case - see its doc comment), this treats the
 * marketplace as DISABLED - it must NEVER default to ENABLED just because
 * admin-service happened to be unreachable. A transient blip with an
 * existing cache is unaffected (the client serves the last-known value).
 *
 * Only self-registration is gated by this. Admin approval/management
 * endpoints (admin.routes.ts) are NOT gated - an admin can still manage any
 * seller that already exists regardless of the flag; in hard-off mode
 * there simply won't be any real (non-default) sellers to manage yet.
 */
export async function assertMarketplaceOpen(): Promise<void> {
  let marketplaceMode: 'ENABLED' | 'DISABLED';
  try {
    marketplaceMode = (await settingsClient.getSettings()).marketplaceMode;
  } catch (err) {
    logger.error(
      { err },
      'settings unavailable and no cache - failing CLOSED (marketplace DISABLED)',
    );
    marketplaceMode = 'DISABLED';
  }

  if (marketplaceMode === 'DISABLED') {
    throw new AppError('FORBIDDEN', 403, 'Seller registration is currently disabled');
  }
}
