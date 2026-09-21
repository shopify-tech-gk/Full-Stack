import { request } from '../http';

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
 * Backed by seller-service's `GET /sellers/internal/by-owner/me` (Ch5.2) -
 * resolves the CALLER'S (forwarded token's) own seller identity. This is
 * the one HTTP call catalog/order need to answer "who is this seller, and
 * are they allowed to act" without ever reading the sellers schema
 * directly (cross-schema isolation).
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
}

/** Backed by `GET /sellers/internal/active-list` (Ch5.3) - every
 * APPROVED+VERIFIED seller, for settlement-service to iterate. */
export interface ActiveSellerSummary {
  sellerId: string;
  commissionRatePercent: string;
}

export interface SellerClient {
  getActive(sellerId: string, authToken: string): Promise<SellerActiveView>;
  /** 404s (as an AppError) if the caller owns no seller. */
  getByOwnerMe(authToken: string): Promise<SellerIdentityView>;
  getActiveList(authToken: string): Promise<ActiveSellerSummary[]>;
}

/** `baseUrl` (e.g. `SELLER_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createSellerClient({
  baseUrl,
  timeoutMs,
}: CreateSellerClientOptions): SellerClient {
  return {
    getActive(sellerId, authToken) {
      return request<SellerActiveView>({
        baseUrl,
        path: `/sellers/internal/${sellerId}/active`,
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },

    getByOwnerMe(authToken) {
      return request<SellerIdentityView>({
        baseUrl,
        path: '/sellers/internal/by-owner/me',
        method: 'GET',
        authToken,
        timeoutMs,
      });
    },

    async getActiveList(authToken) {
      const result = await request<{ items: ActiveSellerSummary[] }>({
        baseUrl,
        path: '/sellers/internal/active-list',
        method: 'GET',
        authToken,
        timeoutMs,
      });
      return result.items;
    },
  };
}
