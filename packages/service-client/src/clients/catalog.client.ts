import type { Money } from '@youmart/shared-types';
import { request } from '../http';

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface ProductSkuDetail {
  id: string;
  skuCode: string;
  mrp: Money;
  sellingPrice: Money;
  attributes: unknown;
}

export interface ProductImageDetail {
  id: string;
  url: string;
  position: number;
}

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: CategoryRef;
  skus: ProductSkuDetail[];
  images: ProductImageDetail[];
}

/**
 * NOT YET BACKED BY A REAL ENDPOINT. catalog-service (Ch4.1/4.2) only
 * exposes `GET /catalog/products/:slug` - there is no lookup by `skuId`.
 * Cart/checkout need one (price + active status for a SKU already in a
 * cart/order line, where only the skuId is known). 4.4b (or a small
 * catalog-service addition) MUST add `GET /catalog/skus/:skuId` (or
 * `/internal/skus/:skuId`) returning this shape before `getSku` can be
 * called for real - calling it today will 404.
 */
export interface SkuDetail {
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  sellingPrice: Money;
  mrp: Money;
  active: boolean;
}

export interface CreateCatalogClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface CatalogClient {
  getProductBySlug(slug: string, authToken?: string): Promise<ProductDetail>;
  /** See the `SkuDetail` doc comment above - not yet backed by a real
   * catalog-service endpoint (flagged for 4.4b). */
  getSku(skuId: string, authToken?: string): Promise<SkuDetail>;
}

/** `baseUrl` (e.g. `CATALOG_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createCatalogClient({
  baseUrl,
  timeoutMs,
}: CreateCatalogClientOptions): CatalogClient {
  return {
    getProductBySlug(slug, authToken) {
      return request<ProductDetail>({
        baseUrl,
        path: `/catalog/products/${slug}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },

    getSku(skuId, authToken) {
      return request<SkuDetail>({
        baseUrl,
        path: `/catalog/skus/${skuId}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },
  };
}
