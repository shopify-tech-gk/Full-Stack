import type { Money } from '@youmart/shared-types';
import { request } from '../http';

export type OrderStatusValue = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';

export interface InternalOrderView {
  orderId: string;
  userId: string;
  status: OrderStatusValue;
  grandTotal: Money;
}

export interface CreateOrderClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface OrderClient {
  /** Backed by `GET /orders/internal/:orderId` (Ch4.6) - no ownership
   * filter server-side; the caller must check `.userId` itself. */
  getInternalOrder(orderId: string, authToken: string): Promise<InternalOrderView>;
  /** Backed by `POST /orders/internal/:orderId/confirm` (Ch4.6) -
   * PENDING_PAYMENT -> CONFIRMED and commits held stock. Idempotent. */
  confirmOrder(orderId: string, authToken: string): Promise<void>;
  /** Backed by `POST /orders/internal/:orderId/cancel` (Ch4.6) -
   * PENDING_PAYMENT -> CANCELLED and releases held stock. Idempotent. */
  cancelOrder(orderId: string, authToken: string): Promise<void>;
}

/** `baseUrl` (e.g. `ORDER_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createOrderClient({ baseUrl, timeoutMs }: CreateOrderClientOptions): OrderClient {
  return {
    getInternalOrder(orderId, authToken) {
      return request<InternalOrderView>({
        baseUrl,
        path: `/orders/internal/${orderId}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },

    confirmOrder(orderId, authToken) {
      return request<void>({
        baseUrl,
        path: `/orders/internal/${orderId}/confirm`,
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },

    cancelOrder(orderId, authToken) {
      return request<void>({
        baseUrl,
        path: `/orders/internal/${orderId}/cancel`,
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },
  };
}
