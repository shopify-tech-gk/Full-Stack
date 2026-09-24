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
  /** GST invoice fields (Ch6.4) - product-level, nullable; the caller
   * (invoice-service) applies its own default HSN/rate fallback when
   * either is null. */
  hsnCode: string | null;
  gstRatePercent: string | null;
}

export interface CreateCatalogClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface CatalogClient {
  getProductBySlug(slug: string): Promise<ProductDetail>;
  getSku(skuId: string): Promise<SkuDetail>;
}

/** `baseUrl` (e.g. `CATALOG_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. Both endpoints below are
 * genuinely PUBLIC (`optionalAuth`, unchanged since Ch4.1) - not part of
 * the Ch6.5 internal-endpoint lockdown, so no service token is attached
 * here at all. */
export function createCatalogClient({
  baseUrl,
  timeoutMs,
}: CreateCatalogClientOptions): CatalogClient {
  return {
    getProductBySlug(slug) {
      return request<ProductDetail>({
        baseUrl,
        path: `/catalog/products/${slug}`,
        method: 'GET',
        timeoutMs,
      });
    },

    getSku(skuId) {
      return request<SkuDetail>({
        baseUrl,
        path: `/catalog/skus/${skuId}`,
        method: 'GET',
        timeoutMs,
      });
    },
  };
}
