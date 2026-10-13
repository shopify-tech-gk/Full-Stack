import { z } from 'zod';
import { Money } from '@youmart/shared-types';

export const CreateRazorpayOrderBody = z.object({
  orderId: z.string().uuid(),
});
export type CreateRazorpayOrderBody = z.infer<typeof CreateRazorpayOrderBody>;

export const CreateRefundBody = z.object({
  orderId: z.string().uuid(),
  amount: Money,
  reason: z.string().min(1).max(500).optional(),
  /** W9: the return / cancel-request id - a retry with the same key returns the first refund. */
  idempotencyKey: z.string().min(1).max(200).optional(),
});

/** W9: the Razorpay Checkout success response, sent by the client right after paying. */
export const VerifyPaymentBody = z.object({
  razorpayOrderId: z.string().min(1).max(64),
  razorpayPaymentId: z.string().min(1).max(64),
  razorpaySignature: z.string().min(1).max(256),
});
export type VerifyPaymentBody = z.infer<typeof VerifyPaymentBody>;

/** W9: pay a PENDING_PAYMENT order, optionally with wallet money first. */
export const PayOrderBody = z.object({
  orderId: z.string().uuid(),
  useWallet: z.boolean().default(false),
});
export type PayOrderBody = z.infer<typeof PayOrderBody>;
export type CreateRefundBody = z.infer<typeof CreateRefundBody>;

// Only the fields this service actually reads from Razorpay's webhook
// payload - Razorpay's real payload has many more fields, all ignored.
export const RazorpayWebhookPayload = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        amount: z.number().int().nonnegative(),
        status: z.string(),
      }),
    }),
  }),
});
export type RazorpayWebhookPayload = z.infer<typeof RazorpayWebhookPayload>;
