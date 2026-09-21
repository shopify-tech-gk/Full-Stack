import { z } from 'zod';
import { PaginationQuery } from '@youmart/shared-types';

export const RegisterSellerBody = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(300).optional(),
});
export type RegisterSellerBody = z.infer<typeof RegisterSellerBody>;

// Only a subset of a real KYC form (matches what's actually persisted) -
// at least one of gstin/pan is not required here since real GSTIN/PAN
// validation is an external stub (see seller.service.ts submitKyc).
export const SubmitKycBody = z.object({
  gstin: z.string().min(1).max(20).optional(),
  pan: z.string().min(1).max(20).optional(),
  bankAccountNumber: z.string().min(4).max(34),
  bankIfsc: z.string().min(1).max(20),
});
export type SubmitKycBody = z.infer<typeof SubmitKycBody>;

const SellerStatusEnum = z.enum(['PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED']);

export const ListSellersQuery = PaginationQuery.extend({
  status: SellerStatusEnum.optional(),
});
export type ListSellersQuery = z.infer<typeof ListSellersQuery>;

export const RejectBody = z.object({
  reason: z.string().min(1).max(1000).optional(),
});
export type RejectBody = z.infer<typeof RejectBody>;

export const SetCommissionBody = z.object({
  // Decimal(5,2) at the DB layer - validated 0..100 here (a commission rate
  // is a percentage, not an arbitrary Decimal(5,2) value).
  percent: z.coerce.number().min(0).max(100),
});
export type SetCommissionBody = z.infer<typeof SetCommissionBody>;
