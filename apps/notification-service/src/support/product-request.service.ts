import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { enqueueNotification } from '@youmart/notifications-client';
import { authClient } from '../serviceClients';
import { addInboxMessage } from '../inbox/inbox.service';
import { logger } from '../logger';

// v1.17 "Restock this for me": when YouMart AI can't find what a shopper wants, it offers a
// request button; each request lands here and in Admin -> Product requests, so the team sees what
// people are asking for. Works signed out too (no contact details then).

export const CreateProductRequestBody = z.object({
  /** What they wanted (the AI fills it from the chat, e.g. "waterproof hiking shoes"). */
  item: z.string().trim().min(2).max(200),
  note: z.string().trim().max(500).optional(),
  /** The AI chat it came from. */
  transcript: z.string().trim().max(12000).optional(),
});
export type CreateProductRequestBody = z.infer<typeof CreateProductRequestBody>;

export const ProductRequestStatus = z.enum(['OPEN', 'RESTOCKED', 'CLOSED']);

export const AdminListProductRequestsQuery = z.object({
  status: ProductRequestStatus.optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AdminListProductRequestsQuery = z.infer<typeof AdminListProductRequestsQuery>;

/** Our own relative path ("/product/x", "/category/y?taxo=a~b", "/search?q=z") - never a URL. */
const AppPath = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?!\/)[\w\-./?=&%~]*$/, 'Must be a path on our site');

export const AdminUpdateProductRequestBody = z.object({
  status: ProductRequestStatus,
  /** v1.17 with RESTOCKED: what to send the shopper to (a product or a category). */
  link: z
    .object({
      label: z.string().trim().min(2).max(160),
      appPath: AppPath,
      webPath: AppPath,
      imageUrl: z.string().url().max(500).optional(),
    })
    .optional(),
  /** With RESTOCKED: also restock + notify every other open request for the same item. */
  notifyAll: z.boolean().default(true),
});

export async function createProductRequest(
  userId: string | null,
  body: CreateProductRequestBody,
): Promise<{ requestId: string; createdAt: string }> {
  const row = await prisma.productRequest.create({
    data: {
      userId,
      item: body.item,
      note: body.note ?? null,
      chatTranscript: body.transcript ?? null,
    },
  });
  return { requestId: row.id, createdAt: row.createdAt.toISOString() };
}

export interface AdminProductRequestView {
  requestId: string;
  item: string;
  note: string | null;
  chatTranscript: string | null;
  status: z.infer<typeof ProductRequestStatus>;
  /** v1.17 what the shopper was sent when it was marked restocked. */
  restockLabel: string | null;
  restockLink: string | null;
  notifiedAt: string | null;
  createdAt: string;
  /** Null when the shopper wasn't signed in. */
  customer: { userId: string; phone: string | null; email: string | null } | null;
  /** How many open requests ask for the same thing (same item text, any case). */
  sameItemOpen: number;
}

export async function listAdminProductRequests(query: AdminListProductRequestsQuery): Promise<{
  items: AdminProductRequestView[];
  nextCursor: string | null;
  counts: { OPEN: number; RESTOCKED: number; CLOSED: number };
}> {
  const q = query.q?.trim();
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(q
      ? {
          OR: [
            { item: { contains: q, mode: 'insensitive' as const } },
            { note: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [rows, grouped, openItems] = await Promise.all([
    prisma.productRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
    prisma.productRequest.groupBy({ by: ['status'], _count: true }),
    prisma.productRequest.findMany({ where: { status: 'OPEN' }, select: { item: true } }),
  ]);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  const demand = new Map<string, number>();
  for (const r of openItems) {
    const key = r.item.trim().toLowerCase();
    demand.set(key, (demand.get(key) ?? 0) + 1);
  }
  const userIds = [...new Set(page.map((r) => r.userId).filter((u): u is string => !!u))];
  const contacts = new Map(
    await Promise.all(
      userIds.map(
        async (userId) =>
          [userId, await authClient.getUserContact(userId).catch(() => null)] as const,
      ),
    ),
  );
  const counts = { OPEN: 0, RESTOCKED: 0, CLOSED: 0 };
  for (const g of grouped) counts[g.status] = g._count;

  return {
    items: page.map((row) => {
      const contact = row.userId ? contacts.get(row.userId) : null;
      return {
        requestId: row.id,
        item: row.item,
        note: row.note,
        chatTranscript: row.chatTranscript,
        status: row.status,
        restockLabel: row.restockLabel,
        restockLink: row.restockLink,
        notifiedAt: row.notifiedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        customer: row.userId
          ? {
              userId: row.userId,
              phone: contact?.phone ?? null,
              email: contact?.email ?? null,
            }
          : null,
        sameItemOpen: demand.get(row.item.trim().toLowerCase()) ?? 0,
      };
    }),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    counts,
  };
}

export async function updateAdminProductRequest(
  id: string,
  body: z.infer<typeof AdminUpdateProductRequestBody>,
): Promise<{ requestId: string; status: string; notified: number; guests: number }> {
  const row = await prisma.productRequest.findUnique({ where: { id } });
  if (!row) throw new AppError('NOT_FOUND', 404, 'Product request not found');

  if (body.status !== 'RESTOCKED') {
    const updated = await prisma.productRequest.update({
      where: { id },
      data: { status: body.status },
    });
    return { requestId: updated.id, status: updated.status, notified: 0, guests: 0 };
  }

  // Restocked: this request - and, by default, everyone else still waiting for the same item.
  const same = body.notifyAll
    ? await prisma.productRequest.findMany({
        where: { status: 'OPEN', item: { equals: row.item, mode: 'insensitive' } },
      })
    : [];
  const targets = [row, ...same.filter((r) => r.id !== row.id)];
  const label = body.link?.label ?? row.item;
  await prisma.productRequest.updateMany({
    where: { id: { in: targets.map((r) => r.id) } },
    data: {
      status: 'RESTOCKED',
      restockLabel: label,
      restockLink: body.link?.appPath ?? null,
      restockWebLink: body.link?.webPath ?? null,
      notifiedAt: new Date(),
    },
  });

  // One message per shopper (a person may have asked twice). Guests can't be reached.
  const userIds = [...new Set(targets.map((r) => r.userId).filter((u): u is string => !!u))];
  const guests = targets.filter((r) => !r.userId).length;
  const data = {
    item: row.item,
    label,
    link: body.link?.appPath ?? null,
    webLink: body.link?.webPath ?? null,
    imageUrl: body.link?.imageUrl ?? null,
  };
  for (const userId of userIds) {
    try {
      await addInboxMessage(userId, 'RESTOCK_AVAILABLE', data);
      const contact = await authClient.getUserContact(userId).catch(() => null);
      if (contact?.email) {
        await enqueueNotification({
          channel: 'EMAIL',
          to: contact.email,
          userId,
          templateKey: 'RESTOCK_AVAILABLE',
          data,
        });
      }
      if (contact?.phone) {
        await enqueueNotification({
          channel: 'WHATSAPP',
          to: contact.phone,
          userId,
          templateKey: 'RESTOCK_AVAILABLE',
          data,
        });
      }
    } catch (err) {
      logger.warn({ err, userId }, 'restock: could not notify a shopper');
    }
  }
  return { requestId: row.id, status: 'RESTOCKED', notified: userIds.length, guests };
}
