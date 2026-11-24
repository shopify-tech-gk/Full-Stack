'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  CircleHelp,
  CreditCard,
  FileText,
  Loader2,
  MessageSquareText,
  PackageSearch,
  PackageX,
  RotateCcw,
  Send,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  ApiError,
  HELP_TOPIC_LABELS,
  ROUTES,
  formatMoney,
  orderHref,
  type HelpTicket,
  type HelpTopic,
  type OrderListItem,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { BTN_PRIMARY, BTN_SECONDARY, Banner, EmptyState, PageHeader, Panel, Pill, Skeleton, dateTime, type PillTone } from './ui';

const TOPIC_ICON: Record<HelpTopic, typeof CircleHelp> = {
  ORDER_STATUS: PackageSearch,
  CANCELLATION: XCircle,
  RETURN_REFUND: RotateCcw,
  DAMAGED_WRONG_ITEM: PackageX,
  PAYMENT_WALLET: CreditCard,
  ACCOUNT: UserRound,
  OTHER: CircleHelp,
};
const TOPICS = Object.keys(HELP_TOPIC_LABELS) as HelpTopic[];
/** Topics about an order: the order picker is shown first for these. */
const ORDER_TOPICS = new Set<HelpTopic>(['ORDER_STATUS', 'CANCELLATION', 'RETURN_REFUND', 'DAMAGED_WRONG_ITEM', 'PAYMENT_WALLET']);

const STATUS: Record<HelpTicket['status'], { label: string; tone: PillTone }> = {
  OPEN: { label: 'Open', tone: 'orange' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
};

/** W9 on the website: Help Center - raise a request (optionally about an order) and follow it. */
export function HelpCenterView() {
  const params = useSearchParams();
  const orderParam = params.get('order');
  const topicParam = params.get('topic') as HelpTopic | null;
  const [tickets, setTickets] = useState<HelpTicket[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [topic, setTopic] = useState<HelpTopic | null>(
    topicParam && topicParam in HELP_TOPIC_LABELS ? topicParam : orderParam ? 'ORDER_STATUS' : null,
  );
  const [orderId, setOrderId] = useState<string>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const loadTickets = useCallback(async (from?: string) => {
    const page = await api.support.listTickets({ limit: 20, ...(from ? { cursor: from } : {}) });
    setCursor(page.nextCursor);
    return page.items;
  }, []);

  useEffect(() => {
    loadTickets()
      .then(setTickets)
      .catch(() => setTickets([]));
    api.orders
      .list({ limit: 30 })
      .then((page) => {
        setOrders(page.items);
        if (orderParam) {
          const hit = page.items.find((o) => o.orderNumber === orderParam || o.orderId === orderParam);
          if (hit) setOrderId(hit.orderId);
        }
      })
      .catch(() => setOrders([]));
  }, [loadTickets, orderParam]);

  const chosenOrder = useMemo(() => orders?.find((o) => o.orderId === orderId) ?? null, [orders, orderId]);

  const submit = async () => {
    setMessage(null);
    if (!topic) {
      setMessage({ tone: 'error', text: 'Choose what you need help with.' });
      return;
    }
    if (text.trim().length < 10) {
      setMessage({ tone: 'error', text: 'Tell us a little more (at least 10 characters).' });
      return;
    }
    setBusy(true);
    try {
      const ticket = await api.support.createTicket({
        topic,
        message: text.trim(),
        ...(orderId ? { orderId } : {}),
      });
      setTickets((cur) => [ticket, ...(cur ?? [])]);
      setOpenTicket(ticket.ticketId);
      setText('');
      setMessage({
        tone: 'success',
        text: `Request ${ticket.reference} sent. Our team usually replies within 24 hours - you’ll get a notification.`,
      });
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof ApiError ? error.message : 'Could not send your request. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Help Center"
        subtitle="Get help with an order, a refund or your account. We reply in your notifications and by email."
      />

      <div className="mb-[20px] grid gap-[14px] md:grid-cols-3">
        <Link
          href={ROUTES.customerCare}
          className="group flex items-center gap-[14px] rounded-[14px] bg-[linear-gradient(135deg,#4c1d95,#6d28d9_60%,#8b5cf6)] p-[16px] font-ui text-white shadow-[0_10px_28px_rgba(109,40,217,0.28)] transition-transform hover:-translate-y-[1px]"
        >
          <span className="flex size-[42px] items-center justify-center rounded-[12px] bg-white/15">
            <Sparkles aria-hidden="true" className="size-[20px]" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold">Ask YouMart AI</span>
            <span className="block text-[12.5px] text-white/80">Instant answers, any time</span>
          </span>
        </Link>
        <Link
          href={ROUTES.returns}
          className="flex items-center gap-[14px] rounded-[14px] border border-catalog-rule bg-white p-[16px] font-ui shadow-rail-card transition-shadow hover:shadow-product-card"
        >
          <span className="flex size-[42px] items-center justify-center rounded-[12px] bg-[#eef3fc] text-brand">
            <RotateCcw aria-hidden="true" className="size-[20px]" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-heading">Returns & refunds</span>
            <span className="block text-[12.5px] text-ink-muted">Track a return</span>
          </span>
        </Link>
        <Link
          href="/faq"
          className="flex items-center gap-[14px] rounded-[14px] border border-catalog-rule bg-white p-[16px] font-ui shadow-rail-card transition-shadow hover:shadow-product-card"
        >
          <span className="flex size-[42px] items-center justify-center rounded-[12px] bg-[#eef3fc] text-brand">
            <FileText aria-hidden="true" className="size-[20px]" />
          </span>
          <span>
            <span className="block text-[15px] font-semibold text-heading">FAQs & policies</span>
            <span className="block text-[12.5px] text-ink-muted">Shipping, refunds, terms</span>
          </span>
        </Link>
      </div>

      <div className="grid items-start gap-[20px] xl:grid-cols-[1.1fr_1fr]">
        <Panel title="Raise a request">
          <p className="mb-[10px] font-ui text-[13.5px] font-semibold text-heading">What do you need help with?</p>
          <div className="mb-[18px] grid grid-cols-2 gap-[8px] sm:grid-cols-3">
            {TOPICS.map((t) => {
              const Icon = TOPIC_ICON[t];
              const on = topic === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTopic(t)}
                  className={`flex flex-col items-start gap-[6px] rounded-[12px] border p-[12px] text-left font-ui text-[13.5px] font-semibold transition-colors ${
                    on
                      ? 'border-brand bg-[#eef3fc] text-brand'
                      : 'border-catalog-rule text-heading hover:border-cart-border'
                  }`}
                >
                  <Icon aria-hidden="true" className={`size-[18px] ${on ? 'text-brand' : 'text-ink-muted'}`} />
                  {HELP_TOPIC_LABELS[t]}
                </button>
              );
            })}
          </div>

          {topic && ORDER_TOPICS.has(topic) ? (
            <div className="mb-[16px]">
              <label htmlFor="help-order" className="mb-[6px] block font-ui text-[13.5px] font-semibold text-heading">
                Which order?
              </label>
              <div className="relative">
                <select
                  id="help-order"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="h-[44px] w-full appearance-none rounded-[10px] border border-catalog-rule bg-white pl-[14px] pr-[36px] font-ui text-[14.5px] text-ink-input focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">{orders === null ? 'Loading your orders…' : 'Not about a specific order'}</option>
                  {(orders ?? []).map((o) => (
                    <option key={o.orderId} value={o.orderId}>
                      #{o.orderNumber} · {formatMoney(o.grandTotal)} · {dateTime(o.createdAt)}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-[12px] top-1/2 size-[16px] -translate-y-1/2 text-ink-muted" />
              </div>
              {chosenOrder ? (
                <p className="mt-[6px] font-ui text-[12.5px] text-ink-muted">
                  <Link href={orderHref(chosenOrder.orderNumber)} className="font-semibold text-brand hover:underline">
                    View order #{chosenOrder.orderNumber}
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <label htmlFor="help-message" className="mb-[6px] block font-ui text-[13.5px] font-semibold text-heading">
            Describe the problem
          </label>
          <textarea
            id="help-message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Tell us what happened - the more detail, the faster we can help."
            className="w-full resize-y rounded-[10px] border border-catalog-rule px-[14px] py-[10px] font-ui text-[14.5px] text-ink-input placeholder:text-ink-placeholder focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <p className="mb-[14px] mt-[4px] text-right font-ui text-[12px] text-ink-muted">{text.length}/2000</p>
          {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
          <button type="button" onClick={() => void submit()} disabled={busy} className={`${BTN_PRIMARY} w-full`}>
            {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : <Send aria-hidden="true" className="size-[15px]" />}
            Send request
          </button>
        </Panel>

        <Panel title="My requests" padded={false}>
          {tickets === null ? (
            <div className="space-y-[10px] p-[20px]">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[64px] w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState icon={MessageSquareText} title="No requests yet">
              Requests you raise appear here with our team&rsquo;s replies.
            </EmptyState>
          ) : (
            <ul>
              {tickets.map((t) => {
                const s = STATUS[t.status];
                const expanded = openTicket === t.ticketId;
                return (
                  <li key={t.ticketId} className="border-b border-catalog-rule last:border-0">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenTicket(expanded ? null : t.ticketId)}
                      className="flex w-full items-start justify-between gap-[12px] px-[20px] py-[14px] text-left font-ui transition-colors hover:bg-[#fafcff]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-semibold text-heading">{t.topicLabel}</span>
                        <span className="mt-[2px] block text-[12.5px] text-ink-muted">
                          {t.reference} · {dateTime(t.createdAt)}
                          {t.orderNumber ? ` · #${t.orderNumber}` : ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-[8px]">
                        {t.adminReply && t.status !== 'RESOLVED' ? (
                          <span className="rounded-full bg-brand px-[8px] py-[1px] text-[11px] font-semibold text-white">Reply</span>
                        ) : null}
                        <Pill tone={s.tone}>{s.label}</Pill>
                        <ChevronDown aria-hidden="true" className={`size-[16px] text-ink-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {expanded ? (
                      <div className="space-y-[10px] px-[20px] pb-[16px] font-ui text-[14px] leading-[1.55]">
                        <div className="rounded-[12px] bg-[#f6f8fb] px-[14px] py-[10px]">
                          <p className="mb-[2px] text-[12px] font-semibold text-ink-muted">You wrote</p>
                          <p className="whitespace-pre-line text-heading">{t.message}</p>
                        </div>
                        {t.adminReply ? (
                          <div className="rounded-[12px] border border-[#c9d8f5] bg-[#f1f6fe] px-[14px] py-[10px]">
                            <p className="mb-[2px] text-[12px] font-semibold text-brand">
                              YouMart Support{t.repliedAt ? ` · ${dateTime(t.repliedAt)}` : ''}
                            </p>
                            <p className="whitespace-pre-line text-heading">{t.adminReply}</p>
                          </div>
                        ) : (
                          <p className="text-[13px] text-ink-muted">Our team hasn&rsquo;t replied yet - we&rsquo;ll notify you when they do.</p>
                        )}
                        {t.orderNumber ? (
                          <Link href={orderHref(t.orderNumber)} className="inline-block text-[13px] font-semibold text-brand hover:underline">
                            View order #{t.orderNumber}
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {cursor ? (
            <div className="border-t border-catalog-rule p-[12px] text-center">
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() =>
                  void loadTickets(cursor).then((more) => setTickets((cur) => [...(cur ?? []), ...more]))
                }
              >
                Show older requests
              </button>
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
