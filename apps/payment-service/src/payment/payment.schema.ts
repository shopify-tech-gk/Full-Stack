import { z } from 'zod';

export const CreateRazorpayOrderBody = z.object({
  orderId: z.string().uuid(),
});
export type CreateRazorpayOrderBody = z.infer<typeof CreateRazorpayOrderBody>;

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
