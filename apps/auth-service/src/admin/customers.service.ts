import type { Prisma } from '@youmart/db';
import { z } from 'zod';
import { prisma } from '../db';

// v1.14 admin dashboard: the customer list (read-only). Search by name, phone or email.

export const AdminCustomersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminCustomersQuery = z.infer<typeof AdminCustomersQuery>;

export interface AdminCustomerView {
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  joinedAt: string;
  /** Last sign-in / token refresh on any device; null = never since sessions were tracked. */
  lastActiveAt: string | null;
  activeDevices: number;
}

export async function listAdminCustomers(query: AdminCustomersQuery): Promise<{
  items: AdminCustomerView[];
  nextCursor: string | null;
  total: number;
  joinedLast7Days: number;
}> {
  const q = query.q?.trim();
  const digits = q?.replace(/\D/g, '') ?? '';
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : {}),
  };
  const now = new Date();
  const [rows, total, joinedLast7Days] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        status: true,
        createdAt: true,
        refreshTokens: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, revokedAt: true, expiresAt: true },
          take: 20,
        },
      },
    }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({
      where: { deletedAt: null, createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    }),
  ]);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items: page.map((user) => ({
      userId: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      status: user.status,
      joinedAt: user.createdAt.toISOString(),
      lastActiveAt: user.refreshTokens[0]?.createdAt.toISOString() ?? null,
      activeDevices: user.refreshTokens.filter((t) => !t.revokedAt && t.expiresAt > now).length,
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    total,
    joinedLast7Days,
  };
}
