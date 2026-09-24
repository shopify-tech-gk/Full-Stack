import type { Money } from '@youmart/shared-types';
import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

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
  /** SERVICE-ONLY endpoints (Ch6.5) - a service token is minted fresh per
   * call, never a forwarded user token. */
  serviceAuth: ServiceAuthOptions;
}

export interface ConvertCartResult {
  converted: boolean;
  cartId: string | null;
}

export interface CartClient {
  /** Backed by `GET /cart/internal/me` (Ch4.5a) - a SPECIFIC user's cart.
   * The service token authenticates the CALLER; `userId` identifies the
   * SUBJECT (Ch6.5 caller-vs-subject design), passed as an explicit query
   * param. */
  getMyCart(userId: string): Promise<CartView>;
  /** Backed by `POST /cart/internal/convert` (Ch4.5b) - marks `userId`'s
   * ACTIVE cart CONVERTED after a successful checkout. A benign no-op if
   * there's no active cart. */
  convertCart(userId: string): Promise<ConvertCartResult>;
}

/** `baseUrl` (e.g. `CART_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createCartClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateCartClientOptions): CartClient {
  return {
    getMyCart(userId) {
      const query = new URLSearchParams({ userId }).toString();
      return request<CartView>({
        baseUrl,
        path: `/cart/internal/me?${query}`,
        method: 'GET',
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },

    convertCart(userId) {
      return request<ConvertCartResult>({
        baseUrl,
        path: '/cart/internal/convert',
        method: 'POST',
        body: { userId },
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },
  };
}
