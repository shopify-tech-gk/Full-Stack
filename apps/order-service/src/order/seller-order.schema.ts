import { z } from 'zod';
import { PaginationQuery } from '@youmart/shared-types';

const OrderItemStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
]);

export const ListSellerItemsQuery = PaginationQuery.extend({
  sellerStatus: OrderItemStatusEnum.optional(),
});
export type ListSellerItemsQuery = z.infer<typeof ListSellerItemsQuery>;

// Shape validation only (any real order_item status) - whether THIS
// specific transition is one a seller may make is a business rule enforced
// in seller-order.service.ts (409, not 400, on an illegal transition).
export const UpdateSellerItemStatusBody = z.object({
  status: OrderItemStatusEnum,
});
export type UpdateSellerItemStatusBody = z.infer<typeof UpdateSellerItemStatusBody>;
