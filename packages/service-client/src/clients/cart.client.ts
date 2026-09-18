import type { Money } from '@youmart/shared-types';
import { request } from '../http';

export interface CartLineItem {
  cartItemId: string;
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  quantity: number;
  priceSnapshot: Money;
  lineTotal: Money;
}

export interface CartView {
  cartId: string | null;
  items: CartLineItem[];
  subtotal: Money;
  itemCount: number;
}

export interface CreateCartClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface CartClient {
  /** Backed by `GET /cart/internal/me` (Ch4.5a) - always the caller's OWN
   * cart, derived from the forwarded `authToken`. */
  getMyCart(authToken: string): Promise<CartView>;
}

/** `baseUrl` (e.g. `CART_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createCartClient({ baseUrl, timeoutMs }: CreateCartClientOptions): CartClient {
  return {
    getMyCart(authToken) {
      return request<CartView>({
        baseUrl,
        path: '/cart/internal/me',
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },
  };
}
