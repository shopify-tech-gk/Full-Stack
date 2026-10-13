import { BRAND_DOMAINS } from '@youmart/shared-client/src/brand-domains.data';

// Brand logos are hotlinked from the Brandfetch Logo API (their terms require embedding the CDN
// URL directly — no downloading or re-hosting). We only keep brand -> official domain.
const CLIENT_ID = process.env.EXPO_PUBLIC_BRANDFETCH_CLIENT_ID ?? '';

/** Brandfetch requires a Referer naming the embedding origin; native image loaders send none. */
export const BRAND_LOGO_HEADERS = { Referer: 'https://youmartshop.com/' } as const;

export type BrandLogoType = 'logo' | 'icon';

export function brandDomain(name: string): string | null {
  return BRAND_DOMAINS[name.trim().toLowerCase()] ?? null;
}

/**
 * Logo URL for a brand, or null when we don't know its domain (or no client ID is configured).
 * `logo` is the horizontal wordmark, `icon` the square social icon. `fallback/404` makes a
 * missing asset fail so the caller can fall back (wordmark -> icon -> name tile).
 */
export function brandLogoUrl(
  name: string,
  type: BrandLogoType,
  size: { w: number; h: number },
): string | null {
  const domain = brandDomain(name);
  if (!domain || !CLIENT_ID) return null;
  return (
    `https://cdn.brandfetch.io/domain/${domain}/w/${Math.round(size.w)}/h/${Math.round(size.h)}` +
    `/fallback/404/type/${type}?c=${encodeURIComponent(CLIENT_ID)}`
  );
}
