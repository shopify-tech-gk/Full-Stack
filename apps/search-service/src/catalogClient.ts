import { request } from '@youmart/service-client';
import { config } from './config';

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

/** Backed by `GET /catalog/internal/products/:id` (Ch6.3) - `null` if the
 * id never existed at all; an existing-but-inactive/soft-deleted product
 * is still returned so the caller can decide to remove it from the index. */
export async function getProductForIndex(
  productId: string,
): Promise<CatalogProductForIndex | null> {
  const result = await request<{ product: CatalogProductForIndex | null }>({
    baseUrl: config.catalogServiceUrl,
    path: `/catalog/internal/products/${productId}`,
    method: 'GET',
    timeoutMs: config.serviceHttpTimeoutMs,
  });
  return result.product;
}

/** Backed by `GET /catalog/internal/products-for-index` (Ch6.3) - ACTIVE,
 * non-deleted products only, paginated. */
export async function listProductsForIndex(
  cursor: string | undefined,
  limit: number,
): Promise<CatalogProductsForIndexPage> {
  const query = new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) });
  return request<CatalogProductsForIndexPage>({
    baseUrl: config.catalogServiceUrl,
    path: `/catalog/internal/products-for-index?${query.toString()}`,
    method: 'GET',
    timeoutMs: config.serviceHttpTimeoutMs,
  });
}
