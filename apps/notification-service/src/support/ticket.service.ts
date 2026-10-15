import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { prisma } from '../db';
import { config } from '../config';
import { authClient, orderClient } from '../serviceClients';
import type {
  AdminListTicketsQuery,
  AdminUpdateTicketBody,
  CreateTicketBody,
  TicketTopic,
} from './ticket.schema';

// W9: "Need help with this order?" - a signed-in customer's help request. Stored here (the record
// support works from and the customer can follow under My Help Requests) and forwarded to the
// support inbox by email, the same way the public contact form is.

const TOPIC_LABEL: Record<TicketTopic, string> = {
  ORDER_STATUS: 'Where is my order?',
  CANCELLATION: 'Cancel my order',
  RETURN_REFUND: 'Return / refund',
  PAYMENT_WALLET: 'Payment / wallet',
  DAMAGED_WRONG_ITEM: 'Damaged or wrong item',
  ACCOUNT: 'My account',
  OTHER: 'Something else',
};

export interface TicketView {
  ticketId: string;
  /** Short reference for the customer ("HLP-" + the id's random tail). */
  reference: string;
  topic: TicketTopic;
  topicLabel: string;
  orderId: string | null;
  orderNumber: string | null;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  /** v1.14: support's answer (null until they reply). */
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type TicketRow = {
  id: string;
  topic: TicketTopic;
  orderId: string | null;
  orderNumber: string | null;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  adminReply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function referenceOf(id: string): string {
  return `HLP-${id.replace(/-/g, '').slice(-8).toUpperCase()}`;
}

function toView(row: TicketRow): TicketView {
  return {
    ticketId: row.id,
    reference: referenceOf(row.id),
    topic: row.topic,
    topicLabel: TOPIC_LABEL[row.topic],
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    message: row.message,
    status: row.status,
    adminReply: row.adminReply,
    repliedAt: row.repliedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createTicket(userId: string, input: CreateTicketBody): Promise<TicketView> {
  let orderNumber: string | null = null;
  let customerName: string | null = null;
  if (input.orderId) {
    const order = await orderClient.getInternalOrder(input.orderId).catch(() => null);
    if (!order || order.userId !== userId) {
      // Never reveal that someone else's order exists.
      throw new AppError('NOT_FOUND', 404, 'Order not found');
    }
    orderNumber = order.orderNumber;
    customerName = order.shippingAddress?.fullName ?? null;
  }

  const row = await prisma.supportTicket.create({
    data: {
      userId,
      orderId: input.orderId ?? null,
      orderNumber,
      topic: input.topic,
      message: input.message,
    },
  });
  const view = toView(row);

  // Fire-and-forget (never fails the customer's request): forward to the support inbox.
  const contact = await authClient.getUserContact(userId).catch(() => null);
  await enqueueNotification({
    channel: 'EMAIL',
    to: config.supportInboxEmail,
    templateKey: 'SUPPORT_TICKET',
    data: {
      reference: view.reference,
      topic: view.topicLabel,
      orderNumber,
      customerName,
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
      message: row.message,
    },
  });

  return view;
}

export async function listMyTickets(
  userId: string,
  query: { cursor?: string; limit: number },
): Promise<{ items: TicketView[]; nextCursor: string | null }> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map(toView),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export async function getMyTicket(userId: string, ticketId: string): Promise<TicketView> {
  const row = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId, deletedAt: null },
  });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Help request not found');
  }
  return toView(row);
}

// ---------------------------------------------------------------------------
// v1.14 admin dashboard: the help-request inbox.
// ---------------------------------------------------------------------------

export interface AdminTicketView extends TicketView {
  userId: string;
  customer: { phone: string | null; email: string | null } | null;
}

export async function listAdminTickets(query: AdminListTicketsQuery): Promise<{
  items: AdminTicketView[];
  nextCursor: string | null;
  counts: { OPEN: number; IN_PROGRESS: number; RESOLVED: number };
}> {
  const q = query.q?.trim();
  const ref = q?.toUpperCase().replace(/^HLP-/, '');
  const where = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(q
      ? {
          OR: [
            { message: { contains: q, mode: 'insensitive' as const } },
            { orderNumber: { contains: q, mode: 'insensitive' as const } },
            ...(ref && /^[0-9A-F]{4,8}$/.test(ref)
              ? [{ id: { endsWith: ref.toLowerCase() } }]
              : []),
          ],
        }
      : {}),
  };
  const [rows, grouped] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    prisma.supportTicket.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
  ]);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const contacts = new Map(
    await Promise.all(
      [...new Set(page.map((r) => r.userId))].map(
        async (userId) =>
          [userId, await authClient.getUserContact(userId).catch(() => null)] as const,
      ),
    ),
  );
  const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
  for (const g of grouped) counts[g.status] = g._count;
  return {
    items: page.map((row) => {
      const contact = contacts.get(row.userId);
      return {
        ...toView(row),
        userId: row.userId,
        customer: contact ? { phone: contact.phone ?? null, email: contact.email ?? null } : null,
      };
    }),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    counts,
  };
}

export async function updateAdminTicket(
  ticketId: string,
  input: AdminUpdateTicketBody,
): Promise<TicketView> {
  const existing = await prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
  });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Help request not found');
  }
  const row = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      // A reply on an untouched request moves it to In progress unless a status was chosen.
      status: input.status ?? (input.reply && existing.status === 'OPEN' ? 'IN_PROGRESS' : undefined),
      ...(input.reply ? { adminReply: input.reply, repliedAt: new Date() } : {}),
    },
  });
  return toView(row);
}
