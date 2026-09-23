import type { Money } from '@youmart/shared-types';
import { request } from '../http';
import { mintCallerServiceToken, type ServiceAuthOptions } from '../serviceAuth';

export type RefundStatusValue = 'PENDING' | 'PROCESSED' | 'FAILED';

/** Backed by `POST /payments/internal/refund` (Ch5.5). */
export interface RefundResult {
  refundId: string;
  paymentId: string;
  amount: Money;
  status: RefundStatusValue;
  razorpayRefundId: string | null;
  /** true when the live Razorpay call itself failed (e.g. placeholder dev
   * credentials) - the refund record still exists (status FAILED), but no
   * money actually moved. Never faked as a success. */
  blocked: boolean;
}

export interface CreatePaymentClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  /** SERVICE-ONLY endpoint (Ch6.5) - a service token is minted fresh per
   * call, never a forwarded user token. */
  serviceAuth: ServiceAuthOptions;
}

export interface PaymentClient {
  /** Creates a refund against the CAPTURED payment for `orderId`. Always
   * resolves (200/201) - even when the Razorpay call itself is
   * BLOCKED-on-creds, in which case `status: 'FAILED'`/`blocked: true` is
   * returned rather than thrown, so the caller (returns-service) can still
   * proceed with its own retryable steps (restock, order status). Throws
   * an `AppError` only for a genuine request-level failure (e.g. no
   * CAPTURED payment found, or an over-refund attempt). */
  createRefund(orderId: string, amount: Money, reason?: string): Promise<RefundResult>;
}

/** `baseUrl` (e.g. `PAYMENT_SERVICE_URL`) is injected by the caller - this
 * package never reads `process.env` itself. */
export function createPaymentClient({
  baseUrl,
  timeoutMs,
  serviceAuth,
}: CreatePaymentClientOptions): PaymentClient {
  return {
    createRefund(orderId, amount, reason) {
      return request<RefundResult>({
        baseUrl,
        path: '/payments/internal/refund',
        method: 'POST',
        body: { orderId, amount, ...(reason ? { reason } : {}) },
        authToken: mintCallerServiceToken(serviceAuth),
        timeoutMs,
      });
    },
  };
}
