import { z } from 'zod';

const OrderItemStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
]);

// Shape validation only - whether THIS specific transition is one
// logistics may make is a business rule enforced in order.service.ts's
// setSellerItemStatusInternal (409, not 400, on an illegal transition).
export const SetSellerItemStatusBody = z.object({
  status: OrderItemStatusEnum,
});
export type SetSellerItemStatusBody = z.infer<typeof SetSellerItemStatusBody>;
