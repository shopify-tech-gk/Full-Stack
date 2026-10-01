'use client';

import { useEffect, useState } from 'react';
import type { OrderListItem } from '@youmart/shared-client';
import { api } from '@/lib/api';

/** The signed-in customer's recent orders for the cancel / notification pickers. */
export function useOwnOrders(): { orders: OrderListItem[] | null; failed: boolean } {
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    api.orders
      .list({ limit: 50 })
      .then((page) => active && setOrders(page.items))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  return { orders, failed };
}

/** Pre-selects `?order=<number>` when it is one of the customer's orders. */
export function initialOrderId(
  orders: readonly OrderListItem[],
  orderNumber: string | undefined,
): string {
  if (!orderNumber) return '';
  const wanted = orderNumber.toUpperCase();
  return orders.find((order) => order.orderNumber === wanted)?.orderId ?? '';
}
