import { z } from 'zod';

// CHECKOUT SECURITY PRINCIPLE (locked, see order.routes.ts): the client
// sends NO items/prices - `addressId` is the ONLY thing checkout accepts
// from the caller, and it's validated server-side (ownership resolved via
// address-service, never trusted at face value) before anything is
// snapshotted onto the order.
export const CheckoutBody = z.object({
  addressId: z.string().uuid({ message: 'a shipping address is required' }),
});
export type CheckoutBody = z.infer<typeof CheckoutBody>;
