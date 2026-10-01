'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderListItem } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { Notice } from './Notice';
import { OrdersTable } from './OrdersTable';
import { FORM_BUTTON, TEXT_LINK } from './formStyles';

interface OrdersListProps {
  /** Dashboard shows a short "recent orders" list without paging. */
  limit?: number;
  paged?: boolean;
  emptyText?: string | null;
}

/** The signed-in customer's own orders (GET /api/orders, newest first, cursor-paged). */
export function OrdersList({ limit = 10, paged = true, emptyText }: OrdersListProps) {
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(
    async (after?: string) => {
      setFailed(false);
      try {
        const page = await api.orders.list({ limit, ...(after ? { cursor: after } : {}) });
        setOrders((current) => (after && current ? [...current, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch {
        setFailed(true);
      }
    },
    [limit],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (failed && !orders) {
    return (
      <Notice tone="error">
        We could not load your orders.{' '}
        <button type="button" onClick={() => void load()} className={TEXT_LINK}>
          Try again
        </button>
      </Notice>
    );
  }
  if (!orders) {
    return <div aria-busy="true" aria-label="Loading your orders" className="min-h-[160px]" />;
  }
  if (orders.length === 0) {
    return emptyText === null ? null : (
      <Notice tone="info">{emptyText ?? 'No order has been made yet.'}</Notice>
    );
  }

  return (
    <>
      <OrdersTable orders={orders} />
      {paged && cursor && (
        <p className="mt-[20px]">
          <button
            type="button"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              await load(cursor);
              setLoadingMore(false);
            }}
            className={FORM_BUTTON}
          >
            {loadingMore ? 'Loading\u2026' : 'Older orders'}
          </button>
        </p>
      )}
    </>
  );
}
