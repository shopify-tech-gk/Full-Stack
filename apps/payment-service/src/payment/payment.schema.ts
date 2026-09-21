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
});
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
