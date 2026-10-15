'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PackageSearch } from 'lucide-react';
import { formatMoney } from '@youmart/shared-client';
import {
  adminFetch,
  fmtDateTime,
  orderStage,
  type AdminOrderListItem,
  type OrderStage,
  type Page,
} from '@/lib/admin';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
  td,
  useAdminData,
  useDebounced,
} from './ui';

const STAGES: Array<{ value: OrderStage; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'TO_PACK', label: 'To pack' },
  { value: 'TO_SHIP', label: 'To ship' },
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function AdminOrders() {
  const params = useSearchParams();
  const router = useRouter();
  const stage = (STAGES.find((s) => s.value === params.get('stage'))?.value ?? 'ALL') as OrderStage;
  const payment = params.get('payment') === 'COD' ? 'COD' : params.get('payment') === 'ONLINE' ? 'ONLINE' : '';
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [more, setMore] = useState<{ items: AdminOrderListItem[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const base = `/orders/admin/orders?limit=25&stage=${stage}${payment ? `&paymentMethod=${payment}` : ''}${
    query ? `&q=${encodeURIComponent(query)}` : ''
  }`;
  const list = useAdminData(async () => {
    setMore(null);
    return adminFetch<Page<AdminOrderListItem>>(base);
  }, [base]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== 'ALL') next.set(key, value);
    else next.delete(key);
    router.replace(`/admin/orders${next.size ? `?${next}` : ''}`);
  };

  const items = [...(list.data?.items ?? []), ...(more?.items ?? [])];
  const cursor = more ? more.cursor : (list.data?.nextCursor ?? null);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await adminFetch<Page<AdminOrderListItem>>(`${base}&cursor=${cursor}`);
      setMore((m) => ({ items: [...(m?.items ?? []), ...page.items], cursor: page.nextCursor }));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Pack, ship and deliver: open an order to work on it."
        actions={<SearchInput value={q} onChange={setQ} placeholder="Order no., customer name or phone" />}
      />
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
        <Tabs value={stage} onChange={(v) => setParam('stage', v)} tabs={STAGES} />
        <select
          value={payment}
          onChange={(e) => setParam('payment', e.target.value)}
          aria-label="Payment method"
          className="h-[38px] rounded-[10px] border border-[#d7deea] bg-white px-[10px] text-[13.5px] font-semibold text-[#24324d]"
        >
          <option value="">All payments</option>
          <option value="ONLINE">Paid online</option>
          <option value="COD">Cash on Delivery</option>
        </select>
      </div>
      {list.error && <ErrorNote message={list.error} />}
      <Card>
        {list.loading && !list.data ? (
          <Loading label="Loading orders" />
        ) : items.length === 0 ? (
          <Empty icon={PackageSearch} title="No orders here" text={query ? 'Try a different search.' : 'Orders in this stage will show up here.'} />
        ) : (
          <>
            <Table head={['Order', 'Placed', 'Customer', 'Items', 'Amount', 'Payment', 'Status']}>
              {items.map((o) => {
                const s = orderStage(o);
                return (
                  <tr
                    key={o.orderId}
                    onClick={() => router.push(`/admin/orders/${o.orderNumber}`)}
                    className="cursor-pointer hover:bg-[#fafbfe]"
                  >
                    <td className={td}>
                      <Link
                        href={`/admin/orders/${o.orderNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-[#0142aa] hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                      {o.couponCode && (
                        <span className="ml-[6px] rounded-[5px] bg-[#fff6e0] px-[5px] py-[1px] text-[11px] font-bold text-[#9a6200]">
                          {o.couponCode}
                        </span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap text-[#6b7891]`}>{fmtDateTime(o.createdAt)}</td>
                    <td className={td}>
                      <p className="font-medium text-[#0b1b3f]">{o.customerName ?? '—'}</p>
                      <p className="text-[12px] text-[#7a86a0]">
                        {[o.city, o.customerPhone].filter(Boolean).join(' · ')}
                      </p>
                    </td>
                    <td className={td}>{o.itemCount}</td>
                    <td className={`${td} font-semibold text-[#0b1b3f]`}>{formatMoney(o.grandTotal)}</td>
                    <td className={td}>
                      {o.paymentMethod === 'COD' ? (
                        <span className="text-[12.5px] font-semibold text-[#9a6200]">Cash on Delivery</span>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-[#137a3f]">Online</span>
                      )}
                    </td>
                    <td className={td}>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
            {cursor && (
              <div className="flex justify-center border-t border-[#eef1f6] p-[14px]">
                <Button onClick={() => void loadMore()} busy={loadingMore}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
