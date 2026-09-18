import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { withStockLock } from './stock-lock';
import type { SetStockBody, ReserveBody } from './inventory.schema';

// Reservations are HELD for a bounded window (checkout must complete within
// this) - order-service (Ch4.5) will call reserve during checkout, then
// commit after payment succeeds or release on payment failure/expiry.
const RESERVATION_TTL_MS = 15 * 60 * 1000;

export interface StockSummary {
  skuId: string;
  available: number;
  reserved: number;
}

export interface ReservationResult {
  reservationId: string;
  skuId: string;
  quantity: number;
  status: 'HELD' | 'COMMITTED' | 'RELEASED' | 'EXPIRED';
  expiresAt: string;
}

/**
 * inventory_svc has no visibility into catalog/orders (cross-schema
 * isolation) - `skuId` here is trusted as given by the caller (checkout
 * will already have validated it against the catalog service).
 *
 * Returns zeros for a SKU with no stock row yet, WITHOUT creating one -
 * reads should never have side effects. A row is only ever created by
 * `setStock` (the first real write for that SKU).
 */
export async function getStock(skuId: string): Promise<StockSummary> {
  const stock = await prisma.stockLevel.findFirst({ where: { skuId, deletedAt: null } });
  return {
    skuId,
    available: stock?.available ?? 0,
    reserved: stock?.reserved ?? 0,
  };
}

/** Admin op: sets the absolute `available` count. `reserved` is untouched. */
export async function setStock(skuId: string, input: SetStockBody): Promise<StockSummary> {
  return withStockLock(skuId, async () => {
    // `sku_id` uniqueness (one active row per SKU) is a hand-added partial
    // unique index, not a Prisma `@unique` - findFirst + create/update, not upsert.
    const existing = await prisma.stockLevel.findFirst({ where: { skuId, deletedAt: null } });

    if (existing) {
      const updated = await prisma.stockLevel.update({
        where: { id: existing.id },
        data: { available: input.available },
      });
      return { skuId, available: updated.available, reserved: updated.reserved };
    }

    const created = await prisma.stockLevel.create({
      data: { skuId, available: input.available, reserved: 0 },
    });
    return { skuId, available: created.available, reserved: created.reserved };
  });
}

/**
 * THE anti-oversell path. `available` is re-checked INSIDE the per-SKU
 * lock (not before acquiring it) - two concurrent reserve calls for the
 * same SKU are serialized by the lock, so the second one always sees the
 * first one's decrement before deciding whether there's enough stock left.
 */
export async function reserve(skuId: string, input: ReserveBody): Promise<ReservationResult> {
  return withStockLock(skuId, async () => {
    const stock = await prisma.stockLevel.findFirst({ where: { skuId, deletedAt: null } });
    const available = stock?.available ?? 0;

    if (available < input.quantity) {
      throw new AppError('CONFLICT', 409, 'Insufficient stock', {
        skuId,
        requested: input.quantity,
        available,
      });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

    const reservation = await prisma.$transaction(async (tx) => {
      await tx.stockLevel.update({
        where: { id: stock!.id },
        data: { available: { decrement: input.quantity }, reserved: { increment: input.quantity } },
      });

      return tx.reservation.create({
        data: {
          skuId,
          orderId: input.orderId ?? null,
          quantity: input.quantity,
          status: 'HELD',
          expiresAt,
        },
      });
    });

    return {
      reservationId: reservation.id,
      skuId: reservation.skuId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
    };
  });
}

/**
 * Returns stock to `available`. Idempotent: a reservation that's already
 * RELEASED/COMMITTED/EXPIRED is a documented no-op (never double-counts
 * stock) - checked once before acquiring the lock (cheap early exit) and
 * again after (in case another request resolved it while we waited).
 */
export async function release(reservationId: string): Promise<void> {
  const existing = await prisma.reservation.findFirst({ where: { id: reservationId } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Reservation not found');
  }
  if (existing.status !== 'HELD') {
    return;
  }

  await withStockLock(existing.skuId, async () => {
    const fresh = await prisma.reservation.findFirst({ where: { id: reservationId } });
    if (!fresh || fresh.status !== 'HELD') {
      return;
    }

    await prisma.$transaction([
      prisma.reservation.update({ where: { id: reservationId }, data: { status: 'RELEASED' } }),
      prisma.stockLevel.updateMany({
        where: { skuId: fresh.skuId, deletedAt: null },
        data: { available: { increment: fresh.quantity }, reserved: { decrement: fresh.quantity } },
      }),
    ]);
  });
}

/**
 * Marks a HELD reservation as sold. `available` was already decremented at
 * reserve time, so only `reserved` moves (down) here. Idempotent, same
 * double-check pattern as `release`.
 */
export async function commit(reservationId: string): Promise<void> {
  const existing = await prisma.reservation.findFirst({ where: { id: reservationId } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Reservation not found');
  }
  if (existing.status !== 'HELD') {
    return;
  }

  await withStockLock(existing.skuId, async () => {
    const fresh = await prisma.reservation.findFirst({ where: { id: reservationId } });
    if (!fresh || fresh.status !== 'HELD') {
      return;
    }

    await prisma.$transaction([
      prisma.reservation.update({ where: { id: reservationId }, data: { status: 'COMMITTED' } }),
      prisma.stockLevel.updateMany({
        where: { skuId: fresh.skuId, deletedAt: null },
        data: { reserved: { decrement: fresh.quantity } },
      }),
    ]);
  });
}

/**
 * Releases every still-HELD reservation for an order. Used by
 * order-service's checkout rollback (a partial reserve failure must leave
 * NO dangling reservations for the order) and, later, for payment-failure/
 * expiry cleanup. Reservation ids aren't stored in the orders schema (no
 * schema changes) - `reservation.order_id` (set via `reserve(..., orderId)`)
 * is the only link, so this looks reservations up by that instead. Each
 * line goes through `release()`'s own idempotent, per-SKU-locked path.
 */
export async function releaseByOrder(orderId: string): Promise<void> {
  const reservations = await prisma.reservation.findMany({
    where: { orderId, status: 'HELD' },
  });
  for (const reservation of reservations) {
    await release(reservation.id);
  }
}

/**
 * Commits every still-HELD reservation for an order (payment success,
 * Ch4.6). Not called anywhere in Ch4.5b itself - checkout only reserves;
 * this is wired now so 4.6 doesn't need any new inventory-service plumbing.
 */
export async function commitByOrder(orderId: string): Promise<void> {
  const reservations = await prisma.reservation.findMany({
    where: { orderId, status: 'HELD' },
  });
  for (const reservation of reservations) {
    await commit(reservation.id);
  }
}
