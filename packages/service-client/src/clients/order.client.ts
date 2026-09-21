import type { Money } from '@youmart/shared-types';
import { request } from '../http';

export type OrderStatusValue = 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';

export interface InternalOrderView {
  orderId: string;
  userId: string;
  status: OrderStatusValue;
  grandTotal: Money;
}

/** Backed by `GET /orders/internal/settleable` (Ch5.3). */
export interface SettleableItemView {
  orderItemId: string;
  orderId: string;
  sellerId: string;
  lineTotal: Money;
  deliveredAt: string;
}

export type OrderItemStatusValue =
  'PENDING' | 'CONFIRMED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';

/** Backed by `GET /orders/internal/items/:orderItemId` (Ch5.4; extended
 * Ch5.5 with `skuId`/`quantity`/`lineTotal`/`updatedAt`) - includes the
 * order's `userId` so callers (e.g. logistics-service's customer tracking
 * endpoint, returns-service's ownership/return-window checks) can do
 * their OWN checks. */
export interface InternalOrderItemView {
  orderItemId: string;
  orderId: string;
  userId: string;
  sellerId: string;
  skuId: string;
  quantity: number;
  lineTotal: Money;
  sellerStatus: OrderItemStatusValue;
  /** DELIVERED-time proxy (order_item has no `delivered_at` column) - same
   * approximation used by settlement-service's getSettleableItems. */
  updatedAt: string;
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
  /** Backed by `GET /orders/internal/settleable` (Ch5.3) - every DELIVERED
   * order_item for `sellerId` in `[from, to)`. Does NOT exclude
   * already-settled items - the caller (settlement-service) owns that
   * knowledge via its own settlement_line rows. */
  getSettleableItems(
    sellerId: string,
    from: string,
    to: string,
    authToken: string,
  ): Promise<SettleableItemView[]>;
  /** Backed by `GET /orders/internal/items/:orderItemId` (Ch5.4) - no
   * ownership filter server-side; the caller must check `.userId`/
   * `.sellerId` itself. */
  getInternalOrderItem(orderItemId: string, authToken: string): Promise<InternalOrderItemView>;
  /** Backed by `POST /orders/internal/items/:orderItemId/seller-status`
   * (Ch5.4) - the LOGISTICS-driven counterpart to the seller-driven
   * CONFIRMED->PACKED transition (Ch5.2). Server validates the requested
   * transition is one of PACKED->SHIPPED / SHIPPED->DELIVERED; anything
   * else is a 409. */
  setSellerItemStatus(
    orderItemId: string,
    status: OrderItemStatusValue,
    authToken: string,
  ): Promise<InternalOrderItemView>;
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

    async getSettleableItems(sellerId, from, to, authToken) {
      const query = new URLSearchParams({ sellerId, from, to }).toString();
      const result = await request<{ items: SettleableItemView[] }>({
        baseUrl,
        path: `/orders/internal/settleable?${query}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
      return result.items;
    },

    getInternalOrderItem(orderItemId, authToken) {
      return request<InternalOrderItemView>({
        baseUrl,
        path: `/orders/internal/items/${orderItemId}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },

    setSellerItemStatus(orderItemId, status, authToken) {
      return request<InternalOrderItemView>({
        baseUrl,
        path: `/orders/internal/items/${orderItemId}/seller-status`,
        method: 'POST',
        body: { status },
        authToken,
        timeoutMs,
      });
    },
  };
}
