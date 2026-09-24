import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

/** Backed by admin-service's `GET /admin/internal/settings` (Ch6.7b) - the
 * ONE platform settings row every service reads instead of its own env
 * copy. */
export interface PlatformSettingsView {
  marketplaceMode: 'ENABLED' | 'DISABLED';
  commission: { enabled: boolean; defaultPercent: string };
  tcs: { enabled: boolean; percent: string };
  tds: { enabled: boolean; percent: string };
  updatedAt: string;
}

export interface CreateSettingsClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  serviceAuth: ServiceAuthOptions;
  /** Default 30s - stale-by-up-to-this-long is an accepted tradeoff for
   * these settings (documented); avoids hitting admin-service on every
   * request of every service. */
  cacheTtlMs?: number;
}

export interface SettingsClient {
  /**
   * Cached: fetches admin-service's internal settings endpoint at most
   * once per `cacheTtlMs` window. On a fetch failure, returns the
   * last-known (possibly stale) cached value if one exists - a brief
   * admin-service blip shouldn't break every other service; if NO value
   * has EVER been successfully fetched, RETHROWS the underlying error
   * rather than inventing a default - "safe" is caller-specific (the
   * marketplace hard-off gate must fail CLOSED/DISABLED, settlement must
   * refuse to run rather than guess a rate), so this generic client
   * leaves that decision to each caller.
   */
  getSettings(): Promise<PlatformSettingsView>;
}

const DEFAULT_CACHE_TTL_MS = 30_000;

export function createSettingsClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
  cacheTtlMs = DEFAULT_CACHE_TTL_MS,
}: CreateSettingsClientOptions): SettingsClient {
  let cached: { value: PlatformSettingsView; fetchedAt: number } | undefined;

  async function getSettings(): Promise<PlatformSettingsView> {
    const now = Date.now();
    if (cached && now - cached.fetchedAt < cacheTtlMs) {
      return cached.value;
    }

    try {
      const fresh = await request<PlatformSettingsView>({
        baseUrl,
        path: '/admin/internal/settings',
        method: 'GET',
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
      cached = { value: fresh, fetchedAt: now };
      return fresh;
    } catch (err) {
      if (cached) {
        return cached.value;
      }
      throw err;
    }
  }

  return { getSettings };
}
