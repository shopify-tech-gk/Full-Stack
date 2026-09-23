import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { add, subtract, sum, percentageOf, compare } from '@youmart/shared-utils';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { orderClient, sellerClient } from '../serviceClients';
import { logger } from '../logger';

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

export type SettlementStatusValue = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';

export interface SettlementView {
  id: string;
  sellerId: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: Money;
  commissionAmount: Money;
  tcsAmount: Money;
  tdsAmount: Money;
  netPayable: Money;
  status: SettlementStatusValue;
  razorpayPayoutId: string | null;
  createdAt: string;
}

export interface SettlementLineView {
  id: string;
  orderItemId: string;
  amount: Money;
}

export interface SettlementDetailView extends SettlementView {
  lines: SettlementLineView[];
}

interface SettlementRow {
  id: string;
  sellerId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: Prisma.Decimal;
  commissionAmount: Prisma.Decimal;
  tcsAmount: Prisma.Decimal;
  tdsAmount: Prisma.Decimal;
  netPayable: Prisma.Decimal;
  status: SettlementStatusValue;
  razorpayPayoutId: string | null;
  createdAt: Date;
}

function toSettlementView(row: SettlementRow): SettlementView {
  return {
    id: row.id,
    sellerId: row.sellerId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    grossAmount: decimalToMoney(row.grossAmount),
    commissionAmount: decimalToMoney(row.commissionAmount),
    tcsAmount: decimalToMoney(row.tcsAmount),
    tdsAmount: decimalToMoney(row.tdsAmount),
    netPayable: decimalToMoney(row.netPayable),
    status: row.status,
    razorpayPayoutId: row.razorpayPayoutId,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Settlement rules (Ch5.3)
// ---------------------------------------------------------------------------

export interface SettlementRules {
  commission: { enabled: boolean; defaultPercent: string };
  tcs: { enabled: boolean; percent: string };
  tds: { enabled: boolean; percent: string };
}

/**
 * Returns the CURRENT settlement rule settings. Env-backed today (a
 * TEMPORARY source, same pattern as MARKETPLACE_MODE) - Ch6's admin
 * dashboard is expected to replace the BODY of this function with a real
 * settings-table lookup (+ a toggle UI) WITHOUT changing this shape or any
 * of computeSettlement's usage of it. Routing every rule read through this
 * one function (instead of scattering `config.x` reads through the engine)
 * is what makes that swap a one-function change later.
 */
export function getSettlementRules(): SettlementRules {
  return {
    commission: {
      enabled: config.commissionEnabled,
      defaultPercent: config.commissionDefaultPercent,
    },
    tcs: { enabled: config.tcsEnabled, percent: config.tcsPercent },
    tds: { enabled: config.tdsEnabled, percent: config.tdsPercent },
  };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export type ComputeSettlementResult =
  | { settled: true; settlement: SettlementView }
  | { settled: false; sellerId: string; reason: 'NOTHING_TO_SETTLE' };

/**
 * Commission rate resolution order (locked, documented): the seller's OWN
 * `commission_rate_percent` (via seller-service's `getActive`, which
 * always has a value - defaulted at registration, see 5.1) is used first;
 * `rules.commission.defaultPercent` (the PLATFORM default) is only a
 * defensive fallback for the improbable case that field is ever missing.
 */
async function resolveCommissionRate(sellerId: string, rules: SettlementRules): Promise<string> {
  const seller = await sellerClient.getActive(sellerId);
  return seller.commissionRatePercent || rules.commission.defaultPercent;
}

/**
 * Computes and persists ONE seller's settlement for `[periodStart,
 * periodEnd)`. Every money computation goes through @youmart/shared-utils
 * (`sum`, `percentageOf`, `add`, `subtract`) - never raw JS number math.
 *
 * IDEMPOTENCY (the core correctness property): "not-yet-settled" is
 * entirely THIS service's own knowledge - order-service has no concept of
 * settlement at all (cross-schema isolation forbids settlement-service
 * from adding a column there), so `orderClient.getSettleableItems` returns
 * every DELIVERED item in the period regardless of settlement history.
 * This function excludes any `orderItemId` already present in a
 * (non-deleted) `settlement_line` row BEFORE computing anything - so
 * re-running for the same seller/period is always safe: already-settled
 * items are silently skipped, never re-billed into a second settlement.
 * If nothing is left to settle (either no DELIVERED items at all, or all
 * of them were already settled), NO settlement row is created - a
 * documented no-op, not a zero-amount settlement record.
 *
 * net_payable >= 0 GUARD: if commission + tcs + tds together exceed the
 * gross settleable amount (a misconfiguration - e.g. rates summing past
 * 100%), this throws rather than silently clamping to zero or emitting a
 * negative net_payable - a settlement that would pay a seller a negative
 * amount must never be created.
 */
export async function computeSettlement(
  sellerId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<ComputeSettlementResult> {
  const settleable = await orderClient.getSettleableItems(
    sellerId,
    periodStart.toISOString(),
    periodEnd.toISOString(),
  );

  if (settleable.length === 0) {
    return { settled: false, sellerId, reason: 'NOTHING_TO_SETTLE' };
  }

  const orderItemIds = settleable.map((item) => item.orderItemId);
  const alreadySettled = await prisma.settlementLine.findMany({
    where: { orderItemId: { in: orderItemIds }, deletedAt: null },
  });
  const alreadySettledIds = new Set(alreadySettled.map((line) => line.orderItemId));
  const unsettled = settleable.filter((item) => !alreadySettledIds.has(item.orderItemId));

  if (unsettled.length === 0) {
    return { settled: false, sellerId, reason: 'NOTHING_TO_SETTLE' };
  }

  const gross = sum(unsettled.map((item) => item.lineTotal));
  const rules = getSettlementRules();

  let commission: Money = '0.00' as Money;
  if (rules.commission.enabled) {
    const rate = await resolveCommissionRate(sellerId, rules);
    commission = percentageOf(gross, rate);
  }

  // TCS/TDS base (documented approximation): both are computed on the
  // GROSS settleable sale value (sum of line_totals) for now. The exact
  // statutory base for Indian marketplace TCS/TDS (e.g. net-of-commission,
  // or a GST-exclusive taxable value) needs confirmation with the client
  // and can be refined later without changing this engine's shape.
  let tcs: Money = '0.00' as Money;
  if (rules.tcs.enabled) {
    tcs = percentageOf(gross, rules.tcs.percent);
  }

  let tds: Money = '0.00' as Money;
  if (rules.tds.enabled) {
    tds = percentageOf(gross, rules.tds.percent);
  }

  const totalDeductions = add(add(commission, tcs), tds);
  if (compare(totalDeductions, gross) > 0) {
    logger.error(
      { sellerId, gross, commission, tcs, tds, totalDeductions },
      'settlement misconfiguration: commission + tcs + tds exceed the gross settleable amount',
    );
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'Settlement rules are misconfigured - deductions exceed the gross settleable amount',
      { sellerId, gross, commission, tcs, tds },
    );
  }
  const netPayable = subtract(subtract(subtract(gross, commission), tcs), tds);

  const created = await prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        sellerId,
        periodStart,
        periodEnd,
        grossAmount: gross,
        commissionAmount: commission,
        tcsAmount: tcs,
        tdsAmount: tds,
        netPayable,
        status: 'PENDING',
      },
    });

    for (const item of unsettled) {
      await tx.settlementLine.create({
        data: {
          settlementId: settlement.id,
          orderItemId: item.orderItemId,
          amount: item.lineTotal,
        },
      });
    }

    return settlement;
  });

  return { settled: true, settlement: toSettlementView(created) };
}

/**
 * Runs `computeSettlement` for every APPROVED+VERIFIED seller (via
 * seller-service's `getActiveList` - never queries the sellers schema
 * directly). In hard-off mode this list is always empty (the seeded
 * default seller has no owning user and is never put through the
 * approval workflow), so a hard-off run settles nothing for anyone -
 * documented, expected behavior, not a bug.
 */
export async function runSettlementForAllSellers(
  periodStart: Date,
  periodEnd: Date,
): Promise<ComputeSettlementResult[]> {
  const sellers = await sellerClient.getActiveList();
  const results: ComputeSettlementResult[] = [];
  for (const seller of sellers) {
    results.push(await computeSettlement(seller.sellerId, periodStart, periodEnd));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Views (admin + seller)
// ---------------------------------------------------------------------------

export interface PaginatedSettlements {
  items: SettlementView[];
  nextCursor: string | null;
}

export interface ListSettlementsAdminQuery {
  cursor?: string;
  limit: number;
  sellerId?: string;
  status?: SettlementStatusValue;
}

export async function listSettlementsAdmin(
  query: ListSettlementsAdminQuery,
): Promise<PaginatedSettlements> {
  const { cursor, limit, sellerId, status } = query;

  const where: Prisma.SettlementWhereInput = {
    deletedAt: null,
    ...(sellerId ? { sellerId } : {}),
    ...(status ? { status } : {}),
  };

  const rows = await prisma.settlement.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  return { items: pageRows.map(toSettlementView), nextCursor };
}

async function loadSettlementDetail(
  id: string,
  sellerId: string | undefined,
): Promise<SettlementDetailView> {
  const settlement = await prisma.settlement.findFirst({
    where: { id, deletedAt: null, ...(sellerId ? { sellerId } : {}) },
  });
  // 404 (not 403) whether the settlement doesn't exist OR belongs to a
  // different seller - "exists but not yours" must be indistinguishable.
  if (!settlement) {
    throw new AppError('NOT_FOUND', 404, 'Settlement not found');
  }

  const lines = await prisma.settlementLine.findMany({
    where: { settlementId: id, deletedAt: null },
  });

  return {
    ...toSettlementView(settlement),
    lines: lines.map((line) => ({
      id: line.id,
      orderItemId: line.orderItemId,
      amount: decimalToMoney(line.amount),
    })),
  };
}

export async function getSettlementDetailAdmin(id: string): Promise<SettlementDetailView> {
  return loadSettlementDetail(id, undefined);
}

export interface ListSellerSettlementsQuery {
  cursor?: string;
  limit: number;
}

export async function listSellerSettlements(
  sellerId: string,
  query: ListSellerSettlementsQuery,
): Promise<PaginatedSettlements> {
  const { cursor, limit } = query;

  const rows = await prisma.settlement.findMany({
    where: { sellerId, deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  return { items: pageRows.map(toSettlementView), nextCursor };
}

export async function getSellerSettlementDetail(
  sellerId: string,
  id: string,
): Promise<SettlementDetailView> {
  return loadSettlementDetail(id, sellerId);
}
