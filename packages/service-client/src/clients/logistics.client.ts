import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

export type ShipmentStatusValue =
  'CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'RTO' | 'CANCELLED';

export interface TrackingEventView {
  id: string;
  status: string;
  location: string | null;
  occurredAt: string;
}

/** Backed by `GET /logistics/internal/track/order-item/:orderItemId` (W1) - same shape as the
 * customer-facing `GET /logistics/track/order-item/:orderItemId`. */
export interface ShipmentDetailView {
  id: string;
  orderItemId: string;
  carrier: string | null;
  awbNumber: string | null;
  status: ShipmentStatusValue;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
  events: TrackingEventView[];
}

export interface CreateLogisticsClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** SERVICE-ONLY endpoint - a service token is minted fresh per call. */
  serviceAuth: ServiceAuthOptions;
}

export interface LogisticsClient {
  /** No ownership check server-side - the caller (order-service's guest order-track) has
   * already authorised the request. Throws `NOT_FOUND` when the item has no shipment yet. */
  getOrderItemTracking(orderItemId: string): Promise<ShipmentDetailView>;
}

/** `baseUrl` (e.g. `LOGISTICS_SERVICE_URL`) is injected by the caller. */
export function createLogisticsClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateLogisticsClientOptions): LogisticsClient {
  return {
    getOrderItemTracking(orderItemId) {
      return request<ShipmentDetailView>({
        baseUrl,
        path: `/logistics/internal/track/order-item/${orderItemId}`,
        method: 'GET',
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },
  };
}
