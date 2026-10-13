import { z } from 'zod';

export const TicketTopic = z.enum([
  'ORDER_STATUS',
  'CANCELLATION',
  'RETURN_REFUND',
  'PAYMENT_WALLET',
  'DAMAGED_WRONG_ITEM',
  'ACCOUNT',
  'OTHER',
]);
export type TicketTopic = z.infer<typeof TicketTopic>;

export const CreateTicketBody = z.object({
  /** The order the request is about (the customer's own), or none for a general question. */
  orderId: z.string().uuid().optional(),
  topic: TicketTopic,
  message: z.string().trim().min(10).max(2000),
});
export type CreateTicketBody = z.infer<typeof CreateTicketBody>;

export const ListTicketsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
