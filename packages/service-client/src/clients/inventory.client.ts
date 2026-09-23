import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

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
  /** Every inventory-service endpoint this client calls is SERVICE-ONLY
   * (Ch6.5) - a service token is minted fresh per call, never a forwarded
   * user token. */
  serviceAuth: ServiceAuthOptions;
}

export interface InventoryClient {
  getStock(skuId: string): Promise<StockSummary>;
  setStock(skuId: string, available: number): Promise<StockSummary>;
  reserve(skuId: string, quantity: number, orderId?: string): Promise<ReservationResult>;
  release(reservationId: string): Promise<void>;
  commit(reservationId: string): Promise<void>;
  /** Releases every still-HELD reservation linked to this order (checkout
   * rollback on partial reserve failure). */
  releaseByOrder(orderId: string): Promise<void>;
  /** Commits every still-HELD reservation linked to this order (payment
   * success, Ch4.6). */
  commitByOrder(orderId: string): Promise<void>;
  /** Backed by `POST /inventory/:skuId/restock` (Ch5.5) - a returned
   * item's units re-enter sellable stock. NO built-in idempotency key;
   * the caller must call at most once per return. */
  restock(skuId: string, quantity: number, reason?: string): Promise<StockSummary>;
}

/** `baseUrl` (e.g. `INVENTORY_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. Mirrors inventory-service's
 * real endpoints (Ch4.3) exactly. */
export function createInventoryClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateInventoryClientOptions): InventoryClient {
  function authToken(): string {
    return mintCallerServiceToken(serviceAuth);
  }

  return {
    getStock(skuId) {
      return request<StockSummary>({
        baseUrl,
        path: `/inventory/${skuId}`,
        method: 'GET',
        authToken: authToken(),
        timeoutMs,
      });
    },

    setStock(skuId, available) {
      return request<StockSummary>({
        baseUrl,
        path: `/inventory/${skuId}/set`,
        method: 'POST',
        body: { available },
        authToken: authToken(),
        timeoutMs,
      });
    },

    reserve(skuId, quantity, orderId) {
      return request<ReservationResult>({
        baseUrl,
        path: `/inventory/${skuId}/reserve`,
        method: 'POST',
        body: { quantity, ...(orderId ? { orderId } : {}) },
        authToken: authToken(),
        timeoutMs,
      });
    },

    release(reservationId) {
      return request<void>({
        baseUrl,
        path: `/inventory/reservations/${reservationId}/release`,
        method: 'POST',
        authToken: authToken(),
        timeoutMs,
      });
    },

    commit(reservationId) {
      return request<void>({
        baseUrl,
        path: `/inventory/reservations/${reservationId}/commit`,
        method: 'POST',
        authToken: authToken(),
        timeoutMs,
      });
    },

    releaseByOrder(orderId) {
      return request<void>({
        baseUrl,
        path: `/inventory/orders/${orderId}/release`,
        method: 'POST',
        authToken: authToken(),
        timeoutMs,
      });
    },

    commitByOrder(orderId) {
      return request<void>({
        baseUrl,
        path: `/inventory/orders/${orderId}/commit`,
        method: 'POST',
        authToken: authToken(),
        timeoutMs,
      });
    },

    restock(skuId, quantity, reason) {
      return request<StockSummary>({
        baseUrl,
        path: `/inventory/${skuId}/restock`,
        method: 'POST',
        body: { quantity, ...(reason ? { reason } : {}) },
        authToken: authToken(),
        timeoutMs,
      });
    },
  };
}
