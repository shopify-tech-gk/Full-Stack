'use client';

import type { Money, OrderView } from '@youmart/shared-client';
import { API_URL } from './api';

// v1.14 admin dashboard client. The admin token is a separate identity from the shopper session:
// it is kept for this browser tab only (sessionStorage) and expires on its own (API.md §2.4).

const STORAGE_KEY = 'ym_admin_session';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'OPS' | 'SUPPORT' | 'FINANCE';
  permissions: string[];
}

export interface AdminSession {
  token: string;
  expiresAt: number;
  admin: AdminProfile;
}

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function readAdminSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function writeAdminSession(session: AdminSession | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
  window.dispatchEvent(new Event('ym-admin-session'));
}

export function signOutAdmin(): void {
  writeAdminSession(null);
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => null)) as {
    accessToken?: string;
    expiresIn?: number;
    admin?: AdminProfile;
    error?: { message?: string };
  } | null;
  if (!res.ok || !body?.accessToken || !body.admin) {
    throw new AdminApiError(
      res.status,
      res.status === 401
        ? 'That email and password don’t match an admin account.'
        : (body?.error?.message ?? 'Could not sign in. Please try again.'),
    );
  }
  const session: AdminSession = {
    token: body.accessToken,
    expiresAt: Date.now() + (body.expiresIn ?? 3600) * 1000 - 30_000,
    admin: body.admin,
  };
  writeAdminSession(session);
  return session;
}

export async function adminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const session = readAdminSession();
  if (!session) {
    writeAdminSession(null);
    throw new AdminApiError(401, 'Your admin session has ended. Please sign in again.');
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      authorization: `Bearer ${session.token}`,
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;
  if (!res.ok) {
    if (res.status === 401) writeAdminSession(null);
    throw new AdminApiError(
      res.status,
      res.status === 403
        ? 'Your admin role doesn’t allow this.'
        : (body?.error?.message ?? 'Something went wrong. Please try again.'),
    );
  }
  return body as T;
}

export const can = (session: AdminSession | null, permission: string): boolean =>
  !!session?.admin.permissions.includes(permission);

// --- Response shapes (docs/contracts/API.md v1.14) ---

export type ItemStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED';

export interface AdminStats {
  today: { orders: number; revenue: Money };
  last30Days: { orders: number; revenue: Money; averageOrder: Money };
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

export type OrderStage =
  | 'ALL'
  | 'TO_PACK'
  | 'TO_SHIP'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'UNPAID'
  | 'CANCELLED';

export interface AdminOrderListItem {
  orderId: string;
  orderNumber: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED';
  customerName: string | null;
  customerPhone: string | null;
  city: string | null;
  itemCount: number;
  itemStatuses: ItemStatus[];
  grandTotal: Money;
  paymentMethod: 'ONLINE' | 'COD';
  couponCode: string | null;
  createdAt: string;
}

export interface AdminOrder extends OrderView {
  userId: string;
  customer: { phone: string | null; email: string | null } | null;
}

export interface Shipment {
  id: string;
  orderItemId: string;
  carrier: string | null;
  awbNumber: string | null;
  status: 'CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'RTO' | 'CANCELLED';
  events: Array<{ status: string; location: string | null; occurredAt: string }>;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdminReturn {
  id: string;
  orderItemId: string;
  userId: string;
  reason: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PICKED_UP' | 'REFUNDED';
  refundAmount: Money | null;
  orderId: string | null;
  orderNumber: string | null;
  title: string | null;
  quantity: number | null;
  createdAt: string;
}

export interface AdminCancelRequest {
  cancelRequestId: string;
  orderId: string;
  orderNumber: string;
  grandTotal: Money;
  paymentMethod: 'ONLINE' | 'COD';
  customerName: string | null;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED';
  reason: string;
  comment: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminCoupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: 'PERCENT' | 'FLAT';
  discountValue: Money;
  maxDiscount: Money | null;
  minOrderValue: Money | null;
  endsAt: string | null;
  startsAt: string | null;
  isActive: boolean;
  isPublic: boolean;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  createdAt: string;
}

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  imageUrl: string | null;
  category: { id: string; name: string; slug: string };
  rating: string | null;
  ratingCount: number;
  skus: Array<{
    id: string;
    skuCode: string;
    mrp: Money;
    sellingPrice: Money;
    attributes: unknown;
  }>;
  updatedAt: string;
}

export interface StockLevel {
  skuId: string;
  available: number;
  reserved: number;
}

export interface AdminCustomer {
  userId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED';
  joinedAt: string;
  lastActiveAt: string | null;
  activeDevices: number;
}

export interface AdminTicket {
  ticketId: string;
  reference: string;
  topicLabel: string;
  orderId: string | null;
  orderNumber: string | null;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
  userId: string;
  customer: { phone: string | null; email: string | null } | null;
}

// --- Display helpers ---

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'To pack',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

/** One badge for a whole order on the admin list: the least-advanced live line wins. */
export function orderStage(order: Pick<AdminOrderListItem, 'status' | 'itemStatuses'>): {
  label: string;
  tone: Tone;
} {
  if (order.status === 'CANCELLED') return { label: 'Cancelled', tone: 'red' };
  if (order.status === 'PENDING_PAYMENT') return { label: 'Unpaid', tone: 'grey' };
  const live = order.itemStatuses.filter((s) => s !== 'CANCELLED' && s !== 'RETURNED');
  if (live.length === 0) {
    return order.itemStatuses.includes('RETURNED')
      ? { label: 'Returned', tone: 'grey' }
      : { label: 'Cancelled', tone: 'red' };
  }
  if (live.includes('CONFIRMED')) return { label: 'To pack', tone: 'amber' };
  if (live.includes('PACKED')) return { label: 'To ship', tone: 'blue' };
  if (live.includes('SHIPPED')) return { label: 'In transit', tone: 'violet' };
  return { label: 'Delivered', tone: 'green' };
}

export type Tone = 'green' | 'amber' | 'blue' | 'violet' | 'red' | 'grey';

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return fmtDate(iso);
}
