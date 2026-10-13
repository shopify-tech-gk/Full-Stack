import { z } from 'zod';
import { Money } from '@youmart/shared-types';

export const WalletTransactionsQuery = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** "Add money": the amount in rupees, 2 decimals (limits checked in wallet.service.ts). */
export const CreateTopupBody = z.object({ amount: Money });
