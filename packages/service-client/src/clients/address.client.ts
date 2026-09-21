import { request } from '../http';

/** Backed by `GET /addresses/internal/for-order` (Ch6.1) - server
 * validates the address belongs to the calling user (via the forwarded
 * bearer token) before returning it; never a client-supplied userId. */
export interface AddressSnapshot {
  addressId: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface CreateAddressClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export interface AddressClient {
  /** Validates `addressId` belongs to `userId` (resolved server-side from
   * the forwarded `authToken`) and returns a full snapshot for the caller
   * (order-service checkout) to persist verbatim. Throws a `404`
   * `AppError` if the address doesn't exist or isn't the caller's own. */
  getAddressForOrder(addressId: string, authToken: string): Promise<AddressSnapshot>;
}

/** `baseUrl` (e.g. `ADDRESS_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createAddressClient({
  baseUrl,
  timeoutMs,
}: CreateAddressClientOptions): AddressClient {
  return {
    getAddressForOrder(addressId, authToken) {
      const query = new URLSearchParams({ addressId }).toString();
      return request<AddressSnapshot>({
        baseUrl,
        path: `/addresses/internal/for-order?${query}`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },
  };
}
