import { z } from 'zod';
import { PaginationQuery } from '@youmart/shared-types';

const SettlementStatusEnum = z.enum(['PENDING', 'PROCESSING', 'PAID', 'FAILED']);

export const RunSettlementBody = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  sellerId: z.string().uuid().optional(),
});
export type RunSettlementBody = z.infer<typeof RunSettlementBody>;

export const ListSettlementsQuery = PaginationQuery.extend({
  sellerId: z.string().uuid().optional(),
  status: SettlementStatusEnum.optional(),
});
export type ListSettlementsQuery = z.infer<typeof ListSettlementsQuery>;
