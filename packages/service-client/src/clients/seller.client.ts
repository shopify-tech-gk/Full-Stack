import { request } from '../http';

export type SellerStatusValue = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type KycStatusValue = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Backed by seller-service's `GET /sellers/internal/:id/active` (Ch5.1). */
export interface SellerActiveView {
  active: boolean;
  status: SellerStatusValue;
  kycStatus: KycStatusValue;
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

export interface SellerClient {
  getActive(sellerId: string, authToken: string): Promise<SellerActiveView>;
  /** 404s (as an AppError) if the caller owns no seller. */
  getByOwnerMe(authToken: string): Promise<SellerIdentityView>;
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
  };
}
