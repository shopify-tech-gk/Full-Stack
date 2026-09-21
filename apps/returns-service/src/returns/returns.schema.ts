import { z } from 'zod';
import { PaginationQuery, Money } from '@youmart/shared-types';

const ReturnStatusEnum = z.enum(['REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'REFUNDED']);

export const RequestReturnBody = z.object({
  orderItemId: z.string().uuid(),
  reason: z.string().min(1).max(1000),
});
export type RequestReturnBody = z.infer<typeof RequestReturnBody>;

// Admin may specify a partial refund amount (<= the order_item's own
// line_total, validated in returns.service.ts); omitted = full line_total
// (the default - see approveReturn's doc comment).
export const ApproveReturnBody = z.object({
  refundAmount: Money.optional(),
});
export type ApproveReturnBody = z.infer<typeof ApproveReturnBody>;

export const RejectReturnBody = z.object({
  reason: z.string().min(1).max(1000).optional(),
});
export type RejectReturnBody = z.infer<typeof RejectReturnBody>;

export const ListReturnsQuery = PaginationQuery.extend({
  status: ReturnStatusEnum.optional(),
});
export type ListReturnsQuery = z.infer<typeof ListReturnsQuery>;
