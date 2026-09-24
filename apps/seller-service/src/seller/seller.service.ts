import type { Prisma } from '@youmart/db';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { config } from '../config';
import { assertMarketplaceOpen } from './marketplace-gate';
import { hashBankAccountNumber } from './hash.util';
import type { RegisterSellerBody, SubmitKycBody } from './seller.schema';

export type SellerStatusValue = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type KycStatusValue = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface SellerView {
  id: string;
  displayName: string;
  legalName: string | null;
  status: SellerStatusValue;
  isDefaultSeller: boolean;
  commissionRatePercent: string;
  ownerUserId: string | null;
  createdAt: string;
}

export interface KycView {
  sellerId: string;
  kycStatus: KycStatusValue;
  gstin: string | null;
  pan: string | null;
  bankIfsc: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
}

function decimalToPercent(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

function toSellerView(seller: {
  id: string;
  displayName: string;
  legalName: string | null;
  status: SellerStatusValue;
  isDefaultSeller: boolean;
  commissionRatePercent: Prisma.Decimal;
  ownerUserId: string | null;
  createdAt: Date;
}): SellerView {
  return {
    id: seller.id,
    displayName: seller.displayName,
    legalName: seller.legalName,
    status: seller.status,
    isDefaultSeller: seller.isDefaultSeller,
    commissionRatePercent: decimalToPercent(seller.commissionRatePercent),
    ownerUserId: seller.ownerUserId,
    createdAt: seller.createdAt.toISOString(),
  };
}

function toKycView(kyc: {
  sellerId: string;
  kycStatus: KycStatusValue;
  gstin: string | null;
  pan: string | null;
  bankIfsc: string | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
}): KycView {
  return {
    sellerId: kyc.sellerId,
    kycStatus: kyc.kycStatus,
    gstin: kyc.gstin,
    pan: kyc.pan,
    bankIfsc: kyc.bankIfsc,
    submittedAt: kyc.submittedAt ? kyc.submittedAt.toISOString() : null,
    verifiedAt: kyc.verifiedAt ? kyc.verifiedAt.toISOString() : null,
  };
}

async function findActiveSellerByOwner(userId: string) {
  return prisma.seller.findFirst({ where: { ownerUserId: userId, deletedAt: null } });
}

async function findLatestKyc(sellerId: string) {
  return prisma.sellerKyc.findFirst({
    where: { sellerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Onboards a REAL (non-default) seller. GATED by the marketplace hard-off
 * flag - see marketplace-gate.ts. A user may own at most one seller;
 * `displayName` uniqueness is a hand-added partial unique index (WHERE
 * deleted_at IS NULL) - checked here (best-effort, documented small race,
 * same convention as catalog-service's slug/SKU-code checks) with the DB
 * index as the real backstop.
 */
export async function registerSeller(
  userId: string,
  input: RegisterSellerBody,
): Promise<SellerView> {
  await assertMarketplaceOpen();

  const existingByOwner = await findActiveSellerByOwner(userId);
  if (existingByOwner) {
    throw new AppError('CONFLICT', 409, 'You already own a seller account');
  }

  const existingByName = await prisma.seller.findFirst({
    where: { displayName: input.displayName, deletedAt: null },
  });
  if (existingByName) {
    throw new AppError('CONFLICT', 409, `Display name "${input.displayName}" is already in use`);
  }

  const seller = await prisma.$transaction(async (tx) => {
    const created = await tx.seller.create({
      data: {
        displayName: input.displayName,
        legalName: input.legalName,
        status: 'PENDING',
        isDefaultSeller: false,
        commissionRatePercent: config.defaultCommissionPercent,
        ownerUserId: userId,
      },
    });

    await tx.sellerKyc.create({
      data: { sellerId: created.id, kycStatus: 'NOT_SUBMITTED' },
    });

    return created;
  });

  return toSellerView(seller);
}

export async function getMySeller(userId: string): Promise<SellerView> {
  const seller = await findActiveSellerByOwner(userId);
  if (!seller) {
    throw new AppError('NOT_FOUND', 404, 'You do not have a seller account');
  }
  return toSellerView(seller);
}

/**
 * Submits (or resubmits, after a rejection) KYC data for the caller's own
 * seller. `seller_kyc` is a one-to-many HISTORY table (a seller may
 * resubmit) - the first-ever submission fills in the NOT_SUBMITTED row
 * created at registration time; any submission after a REJECTED verdict
 * creates a NEW row instead (preserving the rejected one for audit). A
 * submission is refused while a previous one is still PENDING or already
 * VERIFIED (must wait for admin action, or there's nothing to redo).
 *
 * The raw bank account number is HASHED here and never touches the
 * database or any log line - only `hashBankAccountNumber`'s output
 * (`bank_account_number_hash`) is persisted.
 *
 * STUB: real external KYC verification (GSTIN/PAN validation, bank
 * penny-drop) is a pending integration (Cleartax etc., real credentials
 * needed) - this only records the submission and marks it PENDING for an
 * admin's `verifyKyc`/`rejectKyc` call (admin.service.ts) to resolve, the
 * same honest "don't fake an external success" discipline as
 * payment-service's Razorpay integration.
 */
export async function submitKyc(userId: string, input: SubmitKycBody): Promise<KycView> {
  const seller = await findActiveSellerByOwner(userId);
  if (!seller) {
    throw new AppError('NOT_FOUND', 404, 'You do not have a seller account');
  }

  const latest = await findLatestKyc(seller.id);
  const bankAccountNumberHash = hashBankAccountNumber(input.bankAccountNumber);
  const now = new Date();

  if (!latest || latest.kycStatus === 'NOT_SUBMITTED') {
    const target = latest ?? (await prisma.sellerKyc.create({ data: { sellerId: seller.id } }));
    const updated = await prisma.sellerKyc.update({
      where: { id: target.id },
      data: {
        gstin: input.gstin,
        pan: input.pan,
        bankAccountNumberHash,
        bankIfsc: input.bankIfsc,
        kycStatus: 'PENDING',
        submittedAt: now,
      },
    });
    return toKycView(updated);
  }

  if (latest.kycStatus === 'REJECTED') {
    const created = await prisma.sellerKyc.create({
      data: {
        sellerId: seller.id,
        gstin: input.gstin,
        pan: input.pan,
        bankAccountNumberHash,
        bankIfsc: input.bankIfsc,
        kycStatus: 'PENDING',
        submittedAt: now,
      },
    });
    return toKycView(created);
  }

  throw new AppError(
    'CONFLICT',
    409,
    `Cannot submit KYC while the current submission is ${latest.kycStatus}`,
  );
}

export async function getMyKyc(userId: string): Promise<KycView> {
  const seller = await findActiveSellerByOwner(userId);
  if (!seller) {
    throw new AppError('NOT_FOUND', 404, 'You do not have a seller account');
  }
  const latest = await findLatestKyc(seller.id);
  if (!latest) {
    throw new AppError('NOT_FOUND', 404, 'No KYC record for this seller');
  }
  return toKycView(latest);
}

export interface SellerIdentityView {
  sellerId: string;
  status: SellerStatusValue;
  kycStatus: KycStatusValue;
  active: boolean;
  isDefaultSeller: boolean;
}

/**
 * Resolves "who is this caller's seller, and are they allowed to act" -
 * the one call catalog/order need (via @youmart/service-client's
 * `getByOwnerMe`) to scope seller-owned actions, since neither can read
 * the sellers schema directly (cross-schema isolation). Same
 * APPROVED-AND-KYC-VERIFIED rule as `isSellerActive` (admin.service.ts).
 */
export async function getMySellerIdentity(userId: string): Promise<SellerIdentityView> {
  const seller = await findActiveSellerByOwner(userId);
  if (!seller) {
    throw new AppError('NOT_FOUND', 404, 'You do not have a seller account');
  }
  const latest = await findLatestKyc(seller.id);
  const kycStatus = latest?.kycStatus ?? 'NOT_SUBMITTED';
  return {
    sellerId: seller.id,
    status: seller.status,
    kycStatus,
    active: seller.status === 'APPROVED' && kycStatus === 'VERIFIED',
    isDefaultSeller: seller.isDefaultSeller,
  };
}

export { toSellerView, toKycView, findLatestKyc };
