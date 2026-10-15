import { AppError } from '@youmart/errors';
import { z } from 'zod';
import { prisma } from '../db';
import { renderInbox, type InboxKind } from './inbox.templates';

// v1.15: the customer's in-app inbox (the bell). Messages are written by the queue worker for
// INBOX-channel jobs and by support replies; the customer lists them, sees an unread count, and
// marks them read. Kept for 90 days.

const KEEP_DAYS = 90;

export const ListInboxQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  kind: z.enum(['ORDER', 'REFUND', 'RETURN', 'SUPPORT', 'OFFER', 'ACCOUNT']).optional(),
});
export type ListInboxQuery = z.infer<typeof ListInboxQuery>;

export interface InboxMessageView {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  orderId: string | null;
  orderNumber: string | null;
  ticketId: string | null;
  imageUrl: string | null;
  read: boolean;
  createdAt: string;
}

type Row = {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  orderId: string | null;
  orderNumber: string | null;
  ticketId: string | null;
  imageUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const toView = (row: Row): InboxMessageView => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  orderId: row.orderId,
  orderNumber: row.orderNumber,
  ticketId: row.ticketId,
  imageUrl: row.imageUrl,
  read: row.readAt !== null,
  createdAt: row.createdAt.toISOString(),
});

const since = () => new Date(Date.now() - KEEP_DAYS * 86_400_000);

/** Writes one message from a templateKey + data. Returns false when the event has no inbox text. */
export async function addInboxMessage(
  userId: string,
  templateKey: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const content = renderInbox(templateKey, data);
  if (!content) return false;
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
  await prisma.inboxMessage.create({
    data: {
      userId,
      templateKey,
      kind: content.kind,
      title: content.title,
      body: content.body,
      orderId: text(data.orderId),
      orderNumber: text(data.orderNumber),
      ticketId: text(data.ticketId),
      imageUrl: text(data.imageUrl),
    },
  });
  return true;
}

export async function listInbox(
  userId: string,
  query: ListInboxQuery,
): Promise<{ items: InboxMessageView[]; nextCursor: string | null; unread: number }> {
  const where = {
    userId,
    deletedAt: null,
    createdAt: { gte: since() },
    ...(query.kind ? { kind: query.kind } : {}),
  };
  const [rows, unread] = await Promise.all([
    prisma.inboxMessage.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    unreadCount(userId),
  ]);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map(toView),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    unread,
  };
}

export function unreadCount(userId: string): Promise<number> {
  return prisma.inboxMessage.count({
    where: { userId, deletedAt: null, readAt: null, createdAt: { gte: since() } },
  });
}

export async function markRead(userId: string, id: string): Promise<void> {
  const result = await prisma.inboxMessage.updateMany({
    where: { id, userId, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.inboxMessage.count({ where: { id, userId, deletedAt: null } });
    if (!exists) throw new AppError('NOT_FOUND', 404, 'Message not found');
  }
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await prisma.inboxMessage.updateMany({
    where: { userId, deletedAt: null, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

export async function deleteMessage(userId: string, id: string): Promise<void> {
  const result = await prisma.inboxMessage.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new AppError('NOT_FOUND', 404, 'Message not found');
}
