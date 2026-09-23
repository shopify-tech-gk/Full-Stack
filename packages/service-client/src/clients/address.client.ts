import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

/** Backed by `GET /addresses/internal/for-order` (Ch6.1) - server
 * validates the address belongs to `userId` (an explicit param, Ch6.5 -
 * no forwarded user token to derive it from anymore) before returning it. */
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
  /** SERVICE-ONLY endpoint (Ch6.5) - a service token is minted fresh per
   * call, never a forwarded user token. */
  serviceAuth: ServiceAuthOptions;
}

export interface AddressClient {
  /** Validates `addressId` belongs to `userId` and returns a full
   * snapshot for the caller (order-service checkout) to persist verbatim.
   * The service token authenticates the CALLER; `userId` identifies the
   * SUBJECT (Ch6.5 caller-vs-subject design). Throws a `404` `AppError` if
   * the address doesn't exist or isn't that user's own. */
  getAddressForOrder(userId: string, addressId: string): Promise<AddressSnapshot>;
}

/** `baseUrl` (e.g. `ADDRESS_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createAddressClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateAddressClientOptions): AddressClient {
  return {
    getAddressForOrder(userId, addressId) {
      const query = new URLSearchParams({ userId, addressId }).toString();
      return request<AddressSnapshot>({
        baseUrl,
        path: `/addresses/internal/for-order?${query}`,
        method: 'GET',
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },
  };
}
