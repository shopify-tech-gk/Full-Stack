'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, PackageOpen, RotateCcw, Wallet, XCircle } from 'lucide-react';
import {
  ROUTES,
  formatMoney,
  fromPaise,
  orderHref,
  toPaise,
  type ReturnStatus,
  type ReturnView,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  Banner,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  Skeleton,
  dateOnly,
  type PillTone,
} from './ui';

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: PillTone }> = {
  REQUESTED: { label: 'Requested', tone: 'orange' },
  APPROVED: { label: 'Approved - pickup pending', tone: 'blue' },
  PICKED_UP: { label: 'Picked up - refund in progress', tone: 'violet' },
  REFUNDED: { label: 'Refunded to wallet', tone: 'green' },
  REJECTED: { label: 'Not approved', tone: 'red' },
};

const STEPS: { key: ReturnStatus; label: string }[] = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'PICKED_UP', label: 'Picked up' },
  { key: 'REFUNDED', label: 'Refunded' },
];

/** The four-step return tracker (Requested -> Approved -> Picked up -> Refunded). */
export function ReturnTracker({ status }: { status: ReturnStatus }) {
  if (status === 'REJECTED') {
    return (
      <p className="flex items-center gap-[8px] font-ui text-[13.5px] text-[#b91c1c]">
        <XCircle aria-hidden="true" className="size-[16px]" />
        This return wasn&rsquo;t approved. Contact the Help Center if you think it&rsquo;s a mistake.
      </p>
    );
  }
  const at = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-start font-ui" aria-label="Return progress">
      {STEPS.map((step, i) => {
        const done = i <= at;
        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-[11px] h-[3px] w-full -translate-y-1/2 ${
                  i <= at ? 'bg-brand' : 'bg-[#e2e8f0]'
                }`}
              />
            ) : null}
            <span
              className={`relative z-[1] flex size-[22px] items-center justify-center rounded-full border-2 ${
                done ? 'border-brand bg-brand text-white' : 'border-[#cbd5e1] bg-white'
              }`}
            >
              {done ? <Check aria-hidden="true" className="size-[13px]" strokeWidth={3} /> : null}
            </span>
            <span
              className={`mt-[6px] text-[12.5px] ${done ? 'font-semibold text-heading' : 'text-ink-muted'}`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** W9 on the website: My Returns & Refunds - every return and where it stands. */
export function ReturnsView() {
  const [items, setItems] = useState<ReturnView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (from?: string) => {
    const res = await api.returns.list({ limit: 20, ...(from ? { cursor: from } : {}) });
    setCursor(res.nextCursor);
    return res.items;
  }, []);

  useEffect(() => {
    load()
      .then((list) => {
        setItems(list);
        setError(false);
      })
      .catch(() => {
        setItems([]);
        setError(true);
      });
  }, [load]);

  const more = async () => {
    setLoadingMore(true);
    try {
      if (!cursor) return;
      const list = await load(cursor);
      setItems((cur) => [...(cur ?? []), ...list]);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  const refunded = (items ?? [])
    .filter((r) => r.status === 'REFUNDED' && r.refundAmount)
    .reduce((n, r) => n + toPaise(r.refundAmount!), 0);
  const open = (items ?? []).filter((r) => r.status !== 'REFUNDED' && r.status !== 'REJECTED').length;

  return (
    <>
      <PageHeader
        title="Returns & refunds"
        subtitle="Follow every return from request to refund. Refunds are added to your YouMart Wallet."
        actions={
          <Link href={ROUTES.orders} className={BTN_SECONDARY}>
            <RotateCcw aria-hidden="true" className="size-[16px]" />
            Return an item
          </Link>
        }
      />

      <div className="mb-[20px] grid gap-[14px] sm:grid-cols-3">
        {[
          { label: 'Returns in progress', value: items ? String(open) : '—', Icon: PackageOpen },
          {
            label: 'Refunded so far',
            value: items ? formatMoney(fromPaise(refunded)) : '—',
            Icon: Wallet,
          },
          { label: 'Total returns', value: items ? String(items.length) : '—', Icon: RotateCcw },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-[14px] rounded-[14px] border border-catalog-rule bg-white p-[16px] shadow-rail-card">
            <span className="flex size-[42px] items-center justify-center rounded-[12px] bg-[#eef3fc] text-brand">
              <Icon aria-hidden="true" className="size-[20px]" />
            </span>
            <div className="font-ui">
              <p className="text-[12.5px] text-ink-muted">{label}</p>
              <p className="text-[20px] font-bold tabular-nums text-heading">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {error ? <Banner tone="error">Some returns couldn&rsquo;t be loaded. Please refresh the page.</Banner> : null}

      {items === null ? (
        <div className="space-y-[14px]">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[140px] w-full rounded-[14px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={RotateCcw}
            title="No returns yet"
            action={
              <Link href={ROUTES.orders} className={BTN_PRIMARY}>
                Go to my orders
              </Link>
            }
          >
            Need to send something back? Open a delivered order and choose &ldquo;Return item&rdquo;.
          </EmptyState>
        </Panel>
      ) : (
        <>
          {items.map((r) => {
            const status = RETURN_STATUS[r.status];
            return (
              <Panel key={r.id}>
                <div className="flex flex-wrap items-start justify-between gap-[12px]">
                  <div className="min-w-0 font-ui">
                    <p className="text-[16px] font-semibold leading-[1.4] text-heading">
                      {r.title ?? 'Returned item'}
                      {r.quantity && r.quantity > 1 ? (
                        <span className="font-normal text-ink-muted"> × {r.quantity}</span>
                      ) : null}
                    </p>
                    <p className="mt-[4px] text-[13.5px] text-ink-muted">
                      Requested {dateOnly(r.createdAt)}
                      {r.orderNumber ? (
                        <>
                          {' · Order '}
                          <Link href={orderHref(r.orderNumber)} className="font-semibold text-brand hover:underline">
                            #{r.orderNumber}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="mt-[6px] text-[13.5px] text-heading">
                      <span className="text-ink-muted">Reason:</span> {r.reason}
                    </p>
                  </div>
                  <div className="text-right font-ui">
                    <Pill tone={status.tone}>{status.label}</Pill>
                    {r.refundAmount ? (
                      <p className="mt-[8px] text-[13px] text-ink-muted">
                        Refund{' '}
                        <strong className="text-[15px] tabular-nums text-[#15803d]">
                          {formatMoney(r.refundAmount)}
                        </strong>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-[18px] border-t border-catalog-rule pt-[16px]">
                  <ReturnTracker status={r.status} />
                </div>
              </Panel>
            );
          })}
          {cursor ? (
            <div className="text-center">
              <button type="button" onClick={() => void more()} disabled={loadingMore} className={BTN_SECONDARY}>
                {loadingMore ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
                Show more returns
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
