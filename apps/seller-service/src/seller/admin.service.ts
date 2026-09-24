import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import type { Prisma } from '@youmart/db';
import { logger } from '../logger';
import {
  toSellerView,
  toKycView,
  findLatestKyc,
  type SellerView,
  type KycView,
} from './seller.service';
import type { ListSellersQuery, SetCommissionBody } from './seller.schema';

export interface PaginatedSellers {
  items: SellerView[];
  nextCursor: string | null;
}

async function findActiveSellerById(sellerId: string) {
  const seller = await prisma.seller.findFirst({ where: { id: sellerId, deletedAt: null } });
  if (!seller) {
    throw new AppError('NOT_FOUND', 404, 'Seller not found');
  }
  return seller;
}

/**
 * Admin listing/approval workflow. NOT gated by the marketplace hard-off
 * flag (see marketplace-gate.ts) - an admin can manage any seller that
 * already exists regardless of whether self-registration is currently
 * open; in hard-off mode there simply won't be any real sellers to manage
 * yet (only the seeded default seller, which this workflow never touches).
 */
export async function listSellers(query: ListSellersQuery): Promise<PaginatedSellers> {
  const { cursor, limit, status } = query;

  const where: Prisma.SellerWhereInput = {
    deletedAt: null,
    ...(status ? { status } : {}),
  };

  const rows = await prisma.seller.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  return { items: pageRows.map(toSellerView), nextCursor };
}

/**
 * Ch7.2 hardening: admin previously had NO direct single-seller lookup -
 * only the list endpoint above (would need a full scan/filter to find one
 * seller, e.g. the default seller by id). Reuses the same
 * findActiveSellerById helper as every write op in this file.
 */
export async function getSellerById(sellerId: string): Promise<SellerView> {
  const seller = await findActiveSellerById(sellerId);
  return toSellerView(seller);
}

/**
 * APPROVE-VS-KYC RULE (locked, documented): account approval and KYC
 * verification are two INDEPENDENT gates, not a single combined step.
 * `approveSeller` only requires the seller to currently be PENDING - it
 * does NOT require KYC to already be VERIFIED. This mirrors a typical
 * real-world onboarding flow: a business's identity/eligibility can be
 * approved before its bank penny-drop/GSTIN check completes. A seller can
 * therefore be APPROVED while its KYC is still NOT_SUBMITTED/PENDING -
 * but it still cannot actually sell until BOTH are true (status APPROVED
 * AND kyc VERIFIED), enforced by `isSellerActive` below, which every
 * later "can this seller sell" check must go through.
 */
export async function approveSeller(sellerId: string): Promise<SellerView> {
  const seller = await findActiveSellerById(sellerId);
  if (seller.status !== 'PENDING') {
    throw new AppError('CONFLICT', 409, `Cannot approve a seller in status ${seller.status}`);
  }
  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { status: 'APPROVED' },
  });
  return toSellerView(updated);
}

// `reason` has nowhere to persist - the `seller` table has no rejection-
// reason column (no schema/migration changes in this prompt) - it's
// accepted and logged for operator visibility only, documented here
// rather than silently dropped.
export async function rejectSeller(sellerId: string, reason?: string): Promise<SellerView> {
  const seller = await findActiveSellerById(sellerId);
  if (seller.status !== 'PENDING') {
    throw new AppError('CONFLICT', 409, `Cannot reject a seller in status ${seller.status}`);
  }
  if (reason) {
    logger.info({ sellerId, reason }, 'seller rejected');
  }
  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { status: 'REJECTED' },
  });
  return toSellerView(updated);
}

export async function suspendSeller(sellerId: string): Promise<SellerView> {
  const seller = await findActiveSellerById(sellerId);
  if (seller.status !== 'APPROVED') {
    throw new AppError('CONFLICT', 409, `Cannot suspend a seller in status ${seller.status}`);
  }
  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { status: 'SUSPENDED' },
  });
  return toSellerView(updated);
}

export async function reinstateSeller(sellerId: string): Promise<SellerView> {
  const seller = await findActiveSellerById(sellerId);
  if (seller.status !== 'SUSPENDED') {
    throw new AppError('CONFLICT', 409, `Cannot reinstate a seller in status ${seller.status}`);
  }
  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { status: 'APPROVED' },
  });
  return toSellerView(updated);
}

/**
 * Stands in for the (pending, real) external KYC verification result -
 * see seller.service.ts submitKyc's STUB note. Verifies the seller's
 * LATEST kyc submission only.
 */
export async function verifyKyc(sellerId: string): Promise<KycView> {
  await findActiveSellerById(sellerId);
  const latest = await findLatestKyc(sellerId);
  if (!latest) {
    throw new AppError('NOT_FOUND', 404, 'No KYC submission for this seller');
  }
  if (latest.kycStatus !== 'PENDING') {
    throw new AppError('CONFLICT', 409, `Cannot verify KYC in status ${latest.kycStatus}`);
  }
  const updated = await prisma.sellerKyc.update({
    where: { id: latest.id },
    data: { kycStatus: 'VERIFIED', verifiedAt: new Date() },
  });
  return toKycView(updated);
}

// Same reason-has-no-column caveat as rejectSeller above.
export async function rejectKyc(sellerId: string, reason?: string): Promise<KycView> {
  await findActiveSellerById(sellerId);
  const latest = await findLatestKyc(sellerId);
  if (!latest) {
    throw new AppError('NOT_FOUND', 404, 'No KYC submission for this seller');
  }
  if (latest.kycStatus !== 'PENDING') {
    throw new AppError('CONFLICT', 409, `Cannot reject KYC in status ${latest.kycStatus}`);
  }
  if (reason) {
    logger.info({ sellerId, reason }, 'seller KYC rejected');
  }
  const updated = await prisma.sellerKyc.update({
    where: { id: latest.id },
    data: { kycStatus: 'REJECTED' },
  });
  return toKycView(updated);
}

export async function setCommission(
  sellerId: string,
  input: SetCommissionBody,
): Promise<SellerView> {
  await findActiveSellerById(sellerId);
  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { commissionRatePercent: input.percent.toFixed(2) },
  });
  return toSellerView(updated);
}

export interface SellerActiveView {
  active: boolean;
  status: SellerView['status'];
  kycStatus: KycView['kycStatus'];
  commissionRatePercent: string;
}

/**
 * THE "can this seller actually sell" check - a seller is active only when
 * BOTH gates have cleared: account status APPROVED AND its latest KYC
 * submission VERIFIED (see the approve-vs-KYC rule above). Used internally
 * today; catalog/order will call the internal HTTP endpoint that wraps
 * this once the marketplace is on. `commissionRatePercent` (Ch5.3) rides
 * along on the same call so settlement-service doesn't need a second
 * round-trip - it's the seller's OWN configured rate (set via
 * `setCommission`, defaulting to `DEFAULT_COMMISSION_PERCENT` at
 * registration); settlement-service falls back to its own platform default
 * only if this field is ever missing/unparseable.
 */
export async function isSellerActive(sellerId: string): Promise<SellerActiveView> {
  const seller = await findActiveSellerById(sellerId);
  const latest = await findLatestKyc(sellerId);
  const kycStatus = latest?.kycStatus ?? 'NOT_SUBMITTED';
  return {
    active: seller.status === 'APPROVED' && kycStatus === 'VERIFIED',
    status: seller.status,
    kycStatus,
    commissionRatePercent: seller.commissionRatePercent.toFixed(2),
  };
}

export interface ActiveSellerSummary {
  sellerId: string;
  commissionRatePercent: string;
}

/**
 * Every seller currently APPROVED + KYC VERIFIED (Ch5.3) - used by
 * settlement-service's `runSettlementForAllSellers` to iterate sellers
 * without settlement-service ever querying the sellers schema directly.
 * In hard-off mode, the seeded default seller is never returned here (it
 * has no owner and is never put through this approval workflow) - so a
 * hard-off settlement run naturally settles nothing, documented.
 */
export async function listActiveSellers(): Promise<ActiveSellerSummary[]> {
  const approved = await prisma.seller.findMany({
    where: { status: 'APPROVED', deletedAt: null },
  });

  const results: ActiveSellerSummary[] = [];
  for (const seller of approved) {
    const latest = await findLatestKyc(seller.id);
    if (latest?.kycStatus === 'VERIFIED') {
      results.push({
        sellerId: seller.id,
        commissionRatePercent: seller.commissionRatePercent.toFixed(2),
      });
    }
  }
  return results;
}
