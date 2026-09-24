import { request } from '@youmart/service-client';
import { mintServiceToken } from '@youmart/auth-middleware';
import { config } from './config';

// Ch6.5 - self-minted short-lived service token attached to every internal
// call below (never a forwarded user token - this service's event-driven
// reindex worker and nightly full-reindex job have none to forward).
function serviceToken(): string {
  return mintServiceToken('search-service', {
    serviceSecret: config.serviceJwtSecret,
    ttlSeconds: config.serviceTokenTtlSeconds,
  });
}

export interface CatalogProductForIndex {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  deletedAt: string | null;
  categoryId: string;
  categoryName: string;
  price: string | null;
  primaryImageUrl: string | null;
  attributes: unknown;
  createdAt: string;
}

export interface CatalogProductsForIndexPage {
  items: CatalogProductForIndex[];
  nextCursor: string | null;
}

/** Backed by `GET /catalog/internal/products/:id` (Ch6.3, SERVICE-ONLY
 * since Ch6.5) - `null` if the id never existed at all; an
 * existing-but-inactive/soft-deleted product is still returned so the
 * caller can decide to remove it from the index. */
export async function getProductForIndex(
  productId: string,
): Promise<CatalogProductForIndex | null> {
  const result = await request<{ product: CatalogProductForIndex | null }>({
    baseUrl: config.catalogServiceUrl,
    path: `/catalog/internal/products/${productId}`,
    method: 'GET',
    authToken: serviceToken(),
    timeoutMs: config.serviceHttpTimeoutMs,
  });
  return result.product;
}

/** Backed by `GET /catalog/internal/products-for-index` (Ch6.3,
 * SERVICE-ONLY since Ch6.5) - ACTIVE, non-deleted products only, paginated. */
export async function listProductsForIndex(
  cursor: string | undefined,
  limit: number,
): Promise<CatalogProductsForIndexPage> {
  const query = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
  return request<CatalogProductsForIndexPage>({
    baseUrl: config.catalogServiceUrl,
    path: `/catalog/internal/products-for-index?${query.toString()}`,
    method: 'GET',
    authToken: serviceToken(),
    timeoutMs: config.serviceHttpTimeoutMs,
  });
}
