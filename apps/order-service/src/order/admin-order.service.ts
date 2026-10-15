import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { z } from 'zod';
import { prisma } from '../db';
import { authClient } from '../serviceClients';
import {
  ORDER_WITH_ITEMS_INCLUDE,
  decimalToMoney,
  toOrderView,
  type OrderItemStatusValue,
  type OrderView,
} from './order.service';

// v1.14 admin dashboard: the store-wide order list, one order with its customer, and the
// overview numbers. Read-only - every action goes through the existing admin endpoints
// (item status, shipments, cancel requests).

/** Fulfilment queue the admin is working (derived from the items' seller_status). */
export const ADMIN_ORDER_STAGES = [
  'ALL',
  'TO_PACK',
  'TO_SHIP',
  'IN_TRANSIT',
  'DELIVERED',
  'UNPAID',
  'CANCELLED',
] as const;

export const AdminOrdersQuery = z.object({
  stage: z.enum(ADMIN_ORDER_STAGES).default('ALL'),
  q: z.string().trim().max(100).optional(),
  paymentMethod: z.enum(['ONLINE', 'COD']).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminOrdersQuery = z.infer<typeof AdminOrdersQuery>;

export interface AdminOrderListItem {
  orderId: string;
  orderNumber: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
  customerName: string | null;
  customerPhone: string | null;
  city: string | null;
  itemCount: number;
  itemStatuses: OrderItemStatusValue[];
  grandTotal: Money;
  paymentMethod: 'ONLINE' | 'COD';
  couponCode: string | null;
  createdAt: string;
}

const OPEN_ITEM: OrderItemStatusValue[] = ['CONFIRMED', 'PACKED', 'SHIPPED'];

function stageWhere(stage: AdminOrdersQuery['stage']): Prisma.OrderWhereInput {
  const live = { deletedAt: null };
  switch (stage) {
    case 'TO_PACK':
      return { status: 'CONFIRMED', items: { some: { ...live, sellerStatus: 'CONFIRMED' } } };
    case 'TO_SHIP':
      return { status: 'CONFIRMED', items: { some: { ...live, sellerStatus: 'PACKED' } } };
    case 'IN_TRANSIT':
      return { status: 'CONFIRMED', items: { some: { ...live, sellerStatus: 'SHIPPED' } } };
    case 'DELIVERED':
      return {
        status: 'CONFIRMED',
        items: {
          some: { ...live, sellerStatus: 'DELIVERED' },
          none: { ...live, sellerStatus: { in: OPEN_ITEM } },
        },
      };
    case 'UNPAID':
      return { status: 'PENDING_PAYMENT' };
    case 'CANCELLED':
      return { status: 'CANCELLED' };
    default:
      return {};
  }
}

export async function listAdminOrders(
  query: AdminOrdersQuery,
): Promise<{ items: AdminOrderListItem[]; nextCursor: string | null }> {
  const q = query.q?.trim();
  const where: Prisma.OrderWhereInput = {
    deletedAt: null,
    ...stageWhere(query.stage),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
            { shipFullName: { contains: q, mode: 'insensitive' } },
            { shipPhone: { contains: q.replace(/\D/g, '') || q } },
          ],
        }
      : {}),
  };

  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: {
      items: { where: { deletedAt: null }, select: { sellerStatus: true, quantity: true } },
    },
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    items: page.map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.shipFullName,
      customerPhone: order.shipPhone,
      city: order.shipCity,
      itemCount: order.items.reduce((n, item) => n + item.quantity, 0),
      itemStatuses: order.items.map((item) => item.sellerStatus),
      grandTotal: decimalToMoney(order.grandTotal),
      paymentMethod: order.paymentMethod,
      couponCode: order.couponCode,
      createdAt: order.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export interface AdminOrderView extends OrderView {
  userId: string;
  customer: { phone: string | null; email: string | null } | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAdminOrder(idOrNumber: string): Promise<AdminOrderView> {
  const key = UUID_PATTERN.test(idOrNumber)
    ? { id: idOrNumber }
    : { orderNumber: idOrNumber.trim().toUpperCase() };
  const order = await prisma.order.findFirst({
    where: { ...key, deletedAt: null },
    include: ORDER_WITH_ITEMS_INCLUDE,
  });
  if (!order) {
    throw new AppError('NOT_FOUND', 404, 'Order not found');
  }
  const contact = await authClient.getUserContact(order.userId).catch(() => null);
  return {
    ...toOrderView(order),
    userId: order.userId,
    customer: contact ? { phone: contact.phone ?? null, email: contact.email ?? null } : null,
  };
}

export interface AdminStats {
  today: { orders: number; revenue: Money };
  last30Days: { orders: number; revenue: Money; averageOrder: Money };
  /** Last 14 days, oldest first (IST calendar days). */
  daily: Array<{ date: string; orders: number; revenue: Money }>;
  queues: {
    toPack: number;
    toShip: number;
    inTransit: number;
    unpaid: number;
    cancelRequests: number;
    codToCollect: number;
  };
  paymentSplit: { online: number; cod: number };
  topProducts: Array<{ productId: string; title: string; quantity: number; revenue: Money }>;
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** Start of the IST calendar day `daysAgo` days before today, as a UTC instant. */
function istDayStart(daysAgo: number): Date {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const startIst = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate());
  return new Date(startIst - daysAgo * 86_400_000 - IST_OFFSET_MS);
}

function istDateKey(at: Date): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export async function getAdminStats(): Promise<AdminStats> {
  const since30 = istDayStart(29);
  const since14 = istDayStart(13);
  const today = istDayStart(0);

  const count = (stage: AdminOrdersQuery['stage']) =>
    prisma.order.count({ where: { deletedAt: null, ...stageWhere(stage) } });

  const [recent, toPack, toShip, inTransit, unpaid, cancelRequests, codToCollect, top] =
    await Promise.all([
      prisma.order.findMany({
        where: { deletedAt: null, status: 'CONFIRMED', createdAt: { gte: since30 } },
        select: { grandTotal: true, createdAt: true, paymentMethod: true },
      }),
      count('TO_PACK'),
      count('TO_SHIP'),
      count('IN_TRANSIT'),
      count('UNPAID'),
      prisma.orderCancelRequest.count({ where: { deletedAt: null, status: 'REQUESTED' } }),
      prisma.order.count({
        where: {
          deletedAt: null,
          status: 'CONFIRMED',
          paymentMethod: 'COD',
          items: { some: { deletedAt: null, sellerStatus: { in: OPEN_ITEM } } },
        },
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'titleSnapshot'],
        where: {
          deletedAt: null,
          sellerStatus: { notIn: ['CANCELLED'] },
          order: { status: 'CONFIRMED', createdAt: { gte: since30 } },
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

  // Paise integers so the sums stay exact.
  const paise = (value: Prisma.Decimal) => Math.round(Number(value) * 100);
  const money = (p: number) => (p / 100).toFixed(2) as Money;

  const byDay = new Map<string, { orders: number; paise: number }>();
  for (let d = 13; d >= 0; d--) byDay.set(istDateKey(istDayStart(d)), { orders: 0, paise: 0 });
  let total = 0;
  let todayOrders = 0;
  let todayPaise = 0;
  let online = 0;
  let cod = 0;
  for (const order of recent) {
    const p = paise(order.grandTotal);
    total += p;
    if (order.paymentMethod === 'COD') cod++;
    else online++;
    if (order.createdAt >= today) {
      todayOrders++;
      todayPaise += p;
    }
    if (order.createdAt >= since14) {
      const day = byDay.get(istDateKey(order.createdAt));
      if (day) {
        day.orders++;
        day.paise += p;
      }
    }
  }

  return {
    today: { orders: todayOrders, revenue: money(todayPaise) },
    last30Days: {
      orders: recent.length,
      revenue: money(total),
      averageOrder: money(recent.length ? Math.round(total / recent.length) : 0),
    },
    daily: [...byDay].map(([date, d]) => ({ date, orders: d.orders, revenue: money(d.paise) })),
    queues: { toPack, toShip, inTransit, unpaid, cancelRequests, codToCollect },
    paymentSplit: { online, cod },
    topProducts: top.map((row) => ({
      productId: row.productId,
      title: row.titleSnapshot,
      quantity: row._sum.quantity ?? 0,
      revenue: row._sum.lineTotal ? decimalToMoney(row._sum.lineTotal) : ('0.00' as Money),
    })),
  };
}
