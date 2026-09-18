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

export interface ConvertCartResult {
  converted: boolean;
  cartId: string | null;
}

export interface CartClient {
  /** Backed by `GET /cart/internal/me` (Ch4.5a) - always the caller's OWN
   * cart, derived from the forwarded `authToken`. */
  getMyCart(authToken: string): Promise<CartView>;
  /** Backed by `POST /cart/internal/convert` (Ch4.5b) - marks the caller's
   * OWN active cart CONVERTED after a successful checkout. A benign no-op
   * if there's no active cart. */
  convertCart(authToken: string): Promise<ConvertCartResult>;
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

    convertCart(authToken) {
      return request<ConvertCartResult>({
        baseUrl,
        path: '/cart/internal/convert',
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },
  };
}
