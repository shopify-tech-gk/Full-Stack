import { z } from 'zod';
import { Money } from '@youmart/shared-types';

export const WalletTransactionsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** "Add money": the amount in rupees, 2 decimals (limits checked in wallet.service.ts). */
export const CreateTopupBody = z.object({ amount: Money });

/** v1.17 Refer & Earn (SERVICE-ONLY): a reward credited, or taken back after a return. */
export const ReferralEntryBody = z.object({
  direction: z.enum(['CREDIT', 'DEBIT']),
  amount: Money,
  idempotencyKey: z.string().min(4).max(120),
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().max(40).optional(),
});
