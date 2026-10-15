import { z } from 'zod';

// CHECKOUT SECURITY PRINCIPLE (locked, see order.routes.ts): the client
// sends NO items/prices - `addressId` is the ONLY thing checkout accepts
// from the caller, and it's validated server-side (ownership resolved via
// address-service, never trusted at face value) before anything is
// snapshotted onto the order.
export const CheckoutBody = z.object({
  addressId: z.string().uuid({ message: 'a shipping address is required' }),
  // "Buy this now": which of the caller's OWN cart lines to order (default: the whole cart). Only
  // ids - quantities and prices still come from the server-side cart and catalog.
  cartItemIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  // v1.13: a coupon code - validated and reserved server-side (the discount is never sent in).
  couponCode: z.string().trim().min(1).max(40).optional(),
});
export type CheckoutBody = z.infer<typeof CheckoutBody>;
