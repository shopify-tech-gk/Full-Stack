'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  CheckCheck,
  MessageCircle,
  Package,
  Tag,
  Trash2,
  Undo2,
  UserRound,
  Wallet,
} from 'lucide-react';
import { ROUTES, orderHref, type InboxKind, type InboxMessage } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { refreshUnread, setUnread } from '@/lib/inbox';
import { Notice } from './Notice';
import { BODY_TEXT, TEXT_LINK } from './formStyles';

// v1.15: Account > Notifications (the bell) - order updates, refunds, returns and support
// replies, newest first. Clicking one marks it read and opens what it is about.

const KIND: Record<InboxKind, { icon: typeof Bell; className: string }> = {
  ORDER: { icon: Package, className: 'bg-[#e9f0ff] text-brand' },
  REFUND: { icon: Wallet, className: 'bg-[#e8f7ee] text-[#137a3f]' },
  RETURN: { icon: Undo2, className: 'bg-[#fff6e0] text-[#9a6200]' },
  SUPPORT: { icon: MessageCircle, className: 'bg-[#f2edff] text-[#5b35c4]' },
  OFFER: { icon: Tag, className: 'bg-[#fff1e6] text-[#c2410c]' },
  ACCOUNT: { icon: UserRound, className: 'bg-[#f1f3f7] text-ink-strong' },
};

const FILTERS: Array<{ value: InboxKind | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ORDER', label: 'Orders' },
  { value: 'REFUND', label: 'Refunds' },
  { value: 'RETURN', label: 'Returns' },
  { value: 'SUPPORT', label: 'Support' },
];

function when(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2 * 86_400) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function target(m: InboxMessage): string | null {
  if (m.kind === 'SUPPORT') return ROUTES.customerCare;
  if (m.orderNumber) return orderHref(m.orderNumber);
  return null;
}

export function NotificationsView() {
  const session = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<InboxKind | 'ALL'>('ALL');
  const [items, setItems] = useState<InboxMessage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnreadLocal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const page = await api.notifications.list({
        limit: 20,
        ...(filter === 'ALL' ? {} : { kind: filter }),
      });
      setItems(page.items);
      setCursor(page.nextCursor);
      setUnreadLocal(page.unread);
      setUnread(page.unread);
    } catch {
      setFailed(true);
    }
  }, [filter]);

  useEffect(() => {
    if (session.status !== 'authenticated') return;
    setItems(null);
    void load();
  }, [session.status, load]);

  if (session.status === 'loading') return <div aria-busy="true" className="min-h-[240px]" />;
  if (session.status === 'anonymous') {
    return (
      <p className={BODY_TEXT}>
        <Link href={ROUTES.account} className={TEXT_LINK}>
          Sign in
        </Link>{' '}
        to see updates about your orders, refunds and help requests.
      </p>
    );
  }

  const markOne = (m: InboxMessage) => {
    if (m.read) return;
    setItems((prev) => prev?.map((x) => (x.id === m.id ? { ...x, read: true } : x)) ?? prev);
    setUnreadLocal((n) => Math.max(0, n - 1));
    setUnread(unread - 1);
    api.notifications.markRead(m.id).catch(() => void refreshUnread());
  };

  const open = (m: InboxMessage) => {
    markOne(m);
    const href = target(m);
    if (href) router.push(href);
  };

  const readAll = () => {
    setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? prev);
    setUnreadLocal(0);
    setUnread(0);
    api.notifications.markAllRead().catch(() => void refreshUnread());
  };

  const remove = (m: InboxMessage) => {
    setItems((prev) => prev?.filter((x) => x.id !== m.id) ?? prev);
    if (!m.read) {
      setUnreadLocal((n) => Math.max(0, n - 1));
      setUnread(unread - 1);
    }
    api.notifications.remove(m.id).catch(() => void load());
  };

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await api.notifications.list({
        limit: 20,
        cursor,
        ...(filter === 'ALL' ? {} : { kind: filter }),
      });
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="font-ui">
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-[10px]">
        <div role="tablist" className="flex flex-wrap gap-[6px]">
          {FILTERS.map((f) => {
            const on = f.value === filter;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.value)}
                className={`h-[32px] rounded-full px-[14px] text-[13px] font-semibold transition ${
                  on
                    ? 'bg-brand text-white'
                    : 'border border-catalog-rule bg-white text-ink-strong hover:border-brand'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={readAll}
            className="flex items-center gap-[6px] text-[13.5px] font-semibold text-brand hover:underline"
          >
            <CheckCheck aria-hidden="true" className="size-[16px]" />
            Mark all as read ({unread})
          </button>
        )}
      </div>

      {failed ? (
        <Notice tone="error">We could not load your notifications. Please try again.</Notice>
      ) : !items ? (
        <div aria-busy="true" className="min-h-[240px]" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center rounded-[14px] border border-catalog-rule bg-white px-[20px] py-[48px] text-center">
          <span className="mb-[12px] flex size-[60px] items-center justify-center rounded-full bg-[#e9f0ff] text-brand">
            <Bell aria-hidden="true" className="size-[26px]" />
          </span>
          <p className="text-[17px] font-semibold text-heading">You&rsquo;re all caught up</p>
          <p className="mt-[4px] max-w-[340px] text-[14px] text-ink-muted">
            Updates about your orders, refunds and help requests will show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-[10px]">
          {items.map((m) => {
            const k = KIND[m.kind];
            const Icon = k.icon;
            const href = target(m);
            return (
              <li
                key={m.id}
                className={`group relative flex gap-[14px] rounded-[14px] border p-[14px] transition ${
                  m.read
                    ? 'border-catalog-rule bg-white'
                    : 'border-[#bcd0f7] bg-[#f5f8ff] shadow-[0_2px_10px_rgba(1,66,170,0.07)]'
                }`}
              >
                <span
                  className={`flex size-[42px] shrink-0 items-center justify-center rounded-full ${k.className}`}
                >
                  <Icon aria-hidden="true" className="size-[19px]" />
                </span>
                <button
                  type="button"
                  onClick={() => open(m)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-[8px]">
                    <span
                      className={`flex-1 truncate text-[15px] text-heading ${m.read ? 'font-semibold' : 'font-bold'}`}
                    >
                      {m.title}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-muted">{when(m.createdAt)}</span>
                  </span>
                  <span className="mt-[3px] block text-[14px] leading-[1.5] text-ink-body">
                    {m.body}
                  </span>
                  {href && (
                    <span className="mt-[5px] block text-[13px] font-semibold text-brand group-hover:underline">
                      {m.kind === 'SUPPORT' ? 'View in Customer Care' : `View order ${m.orderNumber}`}{' '}
                      &rsaquo;
                    </span>
                  )}
                </button>
                <div className="flex flex-col items-end justify-between">
                  {!m.read ? (
                    <span aria-label="Unread" className="mt-[6px] size-[9px] rounded-full bg-brand" />
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    aria-label="Delete notification"
                    className="flex size-[30px] items-center justify-center rounded-full text-ink-muted opacity-0 transition hover:bg-white hover:text-woo-error focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 aria-hidden="true" className="size-[15px]" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cursor && items && (
        <div className="mt-[16px] flex justify-center">
          <button
            type="button"
            onClick={() => void more()}
            disabled={loadingMore}
            className="h-[38px] rounded-[10px] border border-catalog-rule bg-white px-[18px] text-[14px] font-semibold text-brand disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Show older'}
          </button>
        </div>
      )}
    </div>
  );
}
