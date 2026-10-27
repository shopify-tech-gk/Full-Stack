import type { Money } from '@youmart/shared-types';
import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

export type RefundStatusValue = 'PENDING' | 'PROCESSED' | 'FAILED';

/** Backed by `POST /payments/internal/refund` (Ch5.5; W9: credited to the YouMart Wallet). */
export interface RefundResult {
  refundId: string;
  /** The Razorpay payment refunded (pre-W9 refunds); null for wallet refunds. */
  paymentId: string | null;
  amount: Money;
  status: RefundStatusValue;
  razorpayRefundId: string | null;
  /** W9: WALLET = credited to the customer's YouMart Wallet (every new refund). */
  method: 'ORIGINAL_PAYMENT' | 'WALLET';
  /** Pre-W9 field: a wallet credit can't be blocked, so this is always false now. */
  blocked: boolean;
}

/** Backed by `GET /wallet/internal/users/:userId` (W9). */
export interface WalletSummary {
  balance: Money;
  held: Money;
  available: Money;
}

export interface CreatePaymentClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** SERVICE-ONLY endpoints (Ch6.5) - a service token is minted fresh per
   * call, never a forwarded user token. */
  serviceAuth: ServiceAuthOptions;
}

export interface PaymentClient {
  /** Refunds `amount` of `orderId` to the customer's YouMart Wallet (W9). `idempotencyKey` (the
   * return / cancel-request id) makes a retry return the first refund instead of paying again.
   * Throws an `AppError` for a request-level failure (nothing paid, over-refund). */
  createRefund(
    orderId: string,
    amount: Money,
    reason?: string,
    idempotencyKey?: string,
  ): Promise<RefundResult>;
  /** W9: gives an unpaid order's reserved wallet money back (cancel / expiry). Idempotent. */
  releaseWalletHold(orderId: string): Promise<void>;
  /** Cash on Delivery: everything delivered - the cash is collected. Idempotent. */
  markCodCollected(orderId: string): Promise<void>;
  /** Cash on Delivery: cancelled before delivery - nothing to collect. Idempotent. */
  voidCod(orderId: string): Promise<void>;
  /** W9: the customer's wallet balance (account deletion shows it first). */
  getWallet(userId: string): Promise<WalletSummary>;
  /** W9: account deletion - the customer agreed to give up the balance. */
  forfeitWallet(userId: string): Promise<{ forfeited: Money }>;
  /** v1.17 Refer & Earn: pay a reward into the referrer's wallet (CREDIT) or take it back after a
   * return (DEBIT, capped at the spendable balance). Idempotent on `idempotencyKey`. */
  referralEntry(
    userId: string,
    input: {
      direction: 'CREDIT' | 'DEBIT';
      amount: Money;
      idempotencyKey: string;
      orderId?: string;
      orderNumber?: string;
    },
  ): Promise<{ applied: Money }>;
}

/** `baseUrl` (e.g. `PAYMENT_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createPaymentClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreatePaymentClientOptions): PaymentClient {
  function authToken(): string {
    return mintCallerServiceToken(serviceAuth);
  }

  return {
    createRefund(orderId, amount, reason, idempotencyKey) {
      return request<RefundResult>({
        baseUrl,
        path: '/payments/internal/refund',
        method: 'POST',
        body: {
          orderId,
          amount,
          ...(reason ? { reason } : {}),
          ...(idempotencyKey ? { idempotencyKey } : {}),
        },
        authToken: authToken(),
        timeoutMs,
      });
    },

    async markCodCollected(orderId) {
      await request<unknown>({
        baseUrl,
        path: '/payments/internal/cod-collected',
        method: 'POST',
        body: { orderId },
        authToken: authToken(),
        timeoutMs,
      });
    },

    async voidCod(orderId) {
      await request<unknown>({
        baseUrl,
        path: '/payments/internal/cod-void',
        method: 'POST',
        body: { orderId },
        authToken: authToken(),
        timeoutMs,
      });
    },

    async releaseWalletHold(orderId) {
      await request<unknown>({
        baseUrl,
        path: `/wallet/internal/holds/${orderId}/release`,
        method: 'POST',
        authToken: authToken(),
        timeoutMs,
      });
    },

    getWallet(userId) {
      return request<WalletSummary>({
        baseUrl,
        path: `/wallet/internal/users/${userId}`,
        method: 'GET',
        authToken: authToken(),
        timeoutMs,
      });
    },

    forfeitWallet(userId) {
      return request<{ forfeited: Money }>({
        baseUrl,
        path: `/wallet/internal/users/${userId}/forfeit`,
        method: 'POST',
        authToken: authToken(),
        timeoutMs,
      });
    },

    referralEntry(userId, input) {
      return request<{ applied: Money }>({
        baseUrl,
        path: `/wallet/internal/users/${userId}/referral`,
        method: 'POST',
        body: input,
        authToken: authToken(),
        timeoutMs,
      });
    },
  };
}
