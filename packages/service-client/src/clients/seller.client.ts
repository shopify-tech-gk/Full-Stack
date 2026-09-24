import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

export type SellerStatusValue = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type KycStatusValue = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Backed by seller-service's `GET /sellers/internal/:id/active` (Ch5.1;
 * `commissionRatePercent` added Ch5.3). */
export interface SellerActiveView {
  active: boolean;
  status: SellerStatusValue;
  kycStatus: KycStatusValue;
  commissionRatePercent: string;
}

/**
 * Backed by seller-service's `GET /sellers/internal/by-owner/:userId`
 * (Ch5.2; path changed Ch6.5 - `userId` is now an EXPLICIT param rather
 * than implied by a forwarded user token) - resolves a SPECIFIC user's own
 * seller identity. This is the one HTTP call catalog/order need to answer
 * "who is this seller, and are they allowed to act" without ever reading
 * the sellers schema directly (cross-schema isolation).
 */
export interface SellerIdentityView {
  sellerId: string;
  status: SellerStatusValue;
  kycStatus: KycStatusValue;
  active: boolean;
  isDefaultSeller: boolean;
}

export interface CreateSellerClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** Every endpoint below is SERVICE-ONLY (Ch6.5) - a service token is
   * minted fresh per call, never a forwarded user token. */
  serviceAuth: ServiceAuthOptions;
}

/** Backed by `GET /sellers/internal/active-list` (Ch5.3) - every
 * APPROVED+VERIFIED seller, for settlement-service to iterate. */
export interface ActiveSellerSummary {
  sellerId: string;
  commissionRatePercent: string;
}

export interface SellerClient {
  getActive(sellerId: string): Promise<SellerActiveView>;
  /** 404s (as an AppError) if `userId` owns no seller. The service token
   * authenticates the CALLER; `userId` identifies the SUBJECT (Ch6.5
   * caller-vs-subject design). */
  getByOwner(userId: string): Promise<SellerIdentityView>;
  getActiveList(): Promise<ActiveSellerSummary[]>;
}

/** `baseUrl` (e.g. `SELLER_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createSellerClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreateSellerClientOptions): SellerClient {
  function authToken(): string {
    return mintCallerServiceToken(serviceAuth);
  }

  return {
    getActive(sellerId) {
      return request<SellerActiveView>({
        baseUrl,
        path: `/sellers/internal/${sellerId}/active`,
        method: 'GET',
        authToken: authToken(),
        timeoutMs,
      });
    },

    getByOwner(userId) {
      return request<SellerIdentityView>({
        baseUrl,
        path: `/sellers/internal/by-owner/${userId}`,
        method: 'GET',
        authToken: authToken(),
        timeoutMs,
      });
    },

    async getActiveList() {
      const result = await request<{ items: ActiveSellerSummary[] }>({
        baseUrl,
        path: '/sellers/internal/active-list',
        method: 'GET',
        authToken: authToken(),
        timeoutMs,
      });
      return result.items;
    },
  };
}
