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
 * Backed by catalog-service's `GET /catalog/skus/:skuId` (Ch4.4b).
 * `sellerId` (Ch4.5a) is the ONLY authoritative source of a SKU's seller -
 * order-service uses it to set `order_item.seller_id` per line, since
 * orders_svc cannot read the catalog schema itself.
 */
export interface SkuDetail {
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  sellerId: string;
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
