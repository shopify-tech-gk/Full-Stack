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

// v1.14 admin dashboard: the help-request inbox.
export const TicketStatus = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']);

export const AdminListTicketsQuery = z.object({
  status: TicketStatus.optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminListTicketsQuery = z.infer<typeof AdminListTicketsQuery>;

export const AdminUpdateTicketBody = z
  .object({
    status: TicketStatus.optional(),
    reply: z.string().trim().min(2).max(2000).optional(),
  })
  .refine((b) => b.status || b.reply, { message: 'Nothing to update' });
export type AdminUpdateTicketBody = z.infer<typeof AdminUpdateTicketBody>;
