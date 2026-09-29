import { z } from 'zod';

// Deliberately loose shapes: a malformed order number or phone gets the SAME 404 as a wrong one
// (guest-track.service.ts), so the response never hints at which half was wrong.
export const GuestTrackBody = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  phone: z.string().trim().min(1).max(20),
});
export type GuestTrackBody = z.infer<typeof GuestTrackBody>;
