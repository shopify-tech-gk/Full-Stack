import { request } from '../http';

export interface StockSummary {
  skuId: string;
  available: number;
  reserved: number;
}

export interface ReservationResult {
  reservationId: string;
  skuId: string;
  quantity: number;
  status: 'HELD' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
}

export interface CreateInventoryClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface InventoryClient {
  getStock(skuId: string, authToken: string): Promise<StockSummary>;
  setStock(skuId: string, available: number, authToken: string): Promise<StockSummary>;
  reserve(
    skuId: string,
    quantity: number,
    authToken: string,
    orderId?: string,
  ): Promise<ReservationResult>;
  release(reservationId: string, authToken: string): Promise<void>;
  commit(reservationId: string, authToken: string): Promise<void>;
  /** Releases every still-HELD reservation linked to this order (checkout
   * rollback on partial reserve failure). */
  releaseByOrder(orderId: string, authToken: string): Promise<void>;
  /** Commits every still-HELD reservation linked to this order (payment
   * success, Ch4.6). */
  commitByOrder(orderId: string, authToken: string): Promise<void>;
}

/** `baseUrl` (e.g. `INVENTORY_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. Mirrors inventory-service's
 * real endpoints (Ch4.3) exactly. */
export function createInventoryClient({
  baseUrl,
  timeoutMs,
}: CreateInventoryClientOptions): InventoryClient {
  return {
    getStock(skuId, authToken) {
      return request<StockSummary>({
        baseUrl,
        path: `/inventory/${skuId}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },

    setStock(skuId, available, authToken) {
      return request<StockSummary>({
        baseUrl,
        path: `/inventory/${skuId}/set`,
        method: 'POST',
        body: { available },
        authToken,
        timeoutMs,
      });
    },

    reserve(skuId, quantity, authToken, orderId) {
      return request<ReservationResult>({
        baseUrl,
        path: `/inventory/${skuId}/reserve`,
        method: 'POST',
        body: { quantity, ...(orderId ? { orderId } : {}) },
        authToken,
        timeoutMs,
      });
    },

    release(reservationId, authToken) {
      return request<void>({
        baseUrl,
        path: `/inventory/reservations/${reservationId}/release`,
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },

    commit(reservationId, authToken) {
      return request<void>({
        baseUrl,
        path: `/inventory/reservations/${reservationId}/commit`,
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },

    releaseByOrder(orderId, authToken) {
      return request<void>({
        baseUrl,
        path: `/inventory/orders/${orderId}/release`,
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },

    commitByOrder(orderId, authToken) {
      return request<void>({
        baseUrl,
        path: `/inventory/orders/${orderId}/commit`,
        method: 'POST',
        authToken,
        timeoutMs,
      });
    },
  };
}
