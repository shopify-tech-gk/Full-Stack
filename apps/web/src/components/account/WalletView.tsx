'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Gift,
  Info,
  Loader2,
  Lock,
  Megaphone,
  MinusCircle,
  PlusCircle,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import {
  ApiError,
  colors,
  formatMoney,
  orderHref,
  razorpayCheckoutOptions,
  type WalletSummary,
  type WalletTransaction,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { useSession } from '@/lib/session';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  Banner,
  EmptyState,
  INPUT,
  PageHeader,
  Panel,
  Skeleton,
  dateTime,
} from './ui';

const TYPE: Record<WalletTransaction['type'], { label: string; Icon: typeof Wallet }> = {
  TOPUP: { label: 'Money added', Icon: PlusCircle },
  REFUND: { label: 'Refund', Icon: RotateCcw },
  ORDER_PAYMENT: { label: 'Order payment', Icon: ShoppingBag },
  FORFEIT: { label: 'Balance given up', Icon: MinusCircle },
  REFERRAL_REWARD: { label: 'Referral reward', Icon: Gift },
  AD_PAYMENT: { label: 'Ad payment', Icon: Megaphone },
};

const QUICK = ['500', '1000', '2000', '5000'];
type Filter = 'ALL' | 'CREDIT' | 'DEBIT';
type TopupPhase = 'idle' | 'starting' | 'paying' | 'confirming' | 'done';

/** "500" / "499.5" -> "499.50"; null when not a positive amount with at most 2 decimals. */
function toAmount(input: string): string | null {
  const clean = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 ? value.toFixed(2) : null;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** W9 on the website: the YouMart Wallet - balance, add money (Razorpay) and every credit / debit. */
export function WalletView() {
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const focusAdd = useSearchParams().get('add') === '1';
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [items, setItems] = useState<WalletTransaction[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<TopupPhase>('idle');
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(
    null,
  );
  const amountRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [w, page] = await Promise.all([api.wallet.get(), api.wallet.transactions({ limit: 20 })]);
      setWallet(w);
      setItems(page.items);
      setCursor(page.nextCursor);
      setLoadError(false);
    } catch {
      setLoadError(true);
      setItems((cur) => cur ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusAdd) amountRef.current?.focus();
  }, [focusAdd]);

  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.wallet.transactions({ cursor, limit: 20 });
      setItems((cur) => [...(cur ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setMessage({ tone: 'error', text: 'Could not load more activity. Please try again.' });
    } finally {
      setLoadingMore(false);
    }
  };

  const amount = toAmount(input);
  const limits = wallet?.topupLimits;
  const busy = phase === 'starting' || phase === 'paying' || phase === 'confirming';

  const addMoney = async () => {
    setMessage(null);
    if (!amount) {
      setMessage({ tone: 'error', text: 'Enter the amount you want to add.' });
      amountRef.current?.focus();
      return;
    }
    if (limits && (Number(amount) < Number(limits.min) || Number(amount) > Number(limits.max))) {
      setMessage({
        tone: 'error',
        text: `You can add between ${formatMoney(limits.min)} and ${formatMoney(limits.max)} at a time.`,
      });
      return;
    }
    setPhase('starting');
    let topup;
    try {
      topup = await api.wallet.createTopup(amount);
    } catch (error) {
      setPhase('idle');
      setMessage({
        tone: 'error',
        text: error instanceof ApiError ? error.message : 'Could not start the payment. Please try again.',
      });
      return;
    }
    setPhase('paying');
    let result;
    try {
      const options = razorpayCheckoutOptions(
        {
          razorpayOrderId: topup.razorpayOrderId,
          razorpayKeyId: topup.razorpayKeyId,
          amount: topup.amountPaise,
          currency: topup.currency,
          orderId: topup.topupId,
        },
        { orderNumber: 'Wallet top-up' },
        {
          name: user?.name ?? undefined,
          email: user?.email ?? undefined,
          contact: user?.phone ?? undefined,
        },
        colors.brand.DEFAULT,
      );
      result = await openRazorpayCheckout({
        ...options,
        description: `Add ${formatMoney(topup.amount)} to YouMart Wallet`,
      });
    } catch {
      setPhase('idle');
      setMessage({
        tone: 'error',
        text: 'Razorpay could not be opened. Please check your connection and try again.',
      });
      return;
    }
    if (result.kind === 'dismissed') {
      setPhase('idle');
      setMessage(
        result.lastError
          ? { tone: 'error', text: `Payment failed: ${result.lastError} Nothing was added.` }
          : { tone: 'info', text: 'Payment was not completed. Nothing was added to your wallet.' },
      );
      return;
    }
    // Razorpay reported success: confirm straight away; the webhook is the backup (polled).
    setPhase('confirming');
    let paid = false;
    if (result.proof) {
      const verified = await api.payments.verify(result.proof).catch(() => null);
      paid = verified?.status === 'PAID';
    }
    for (let i = 0; !paid && i < 20; i += 1) {
      await wait(1500);
      const t = await api.wallet.getTopup(topup.topupId).catch(() => null);
      if (t?.status === 'PAID') paid = true;
      if (t?.status === 'FAILED') break;
    }
    await load();
    if (paid) {
      setPhase('done');
      setInput('');
      setMessage({ tone: 'success', text: `${formatMoney(topup.amount)} was added to your wallet.` });
    } else {
      setPhase('idle');
      setMessage({
        tone: 'info',
        text: 'Your payment is still being confirmed. The money will appear here within a few minutes - you won’t be charged twice.',
      });
    }
  };

  const shown = (items ?? []).filter((t) => filter === 'ALL' || t.direction === filter);
  const held = wallet && wallet.held !== '0.00';

  return (
    <>
      <PageHeader
        title="YouMart Wallet"
        subtitle="Refunds land here instantly. Pay for orders with it - on its own or with another method."
      />

      <div className="mb-[20px] grid gap-[20px] xl:grid-cols-[1.25fr_1fr]">
        <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(135deg,#0142aa_0%,#0d66ad_55%,#1e88e5_100%)] p-[26px] font-ui text-white shadow-[0_16px_40px_rgba(1,66,170,0.28)]">
          <span
            aria-hidden="true"
            className="absolute -right-[60px] -top-[60px] size-[220px] rounded-full bg-white/10"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-[80px] right-[40px] size-[180px] rounded-full bg-white/[0.07]"
          />
          <div className="relative">
            <p className="flex items-center gap-[8px] text-[14px] font-medium text-white/85">
              <Wallet aria-hidden="true" className="size-[18px]" /> Available balance
            </p>
            {wallet ? (
              <p className="mt-[10px] text-[42px] font-bold leading-none tracking-tight tabular-nums">
                {formatMoney(wallet.available)}
              </p>
            ) : (
              <Skeleton className="mt-[10px] h-[42px] w-[200px] bg-white/20" />
            )}
            <div className="mt-[22px] grid grid-cols-2 gap-[12px] border-t border-white/20 pt-[16px] text-[13px]">
              <div>
                <p className="text-white/70">Total balance</p>
                <p className="mt-[2px] text-[16px] font-semibold tabular-nums">
                  {wallet ? formatMoney(wallet.balance) : '—'}
                </p>
              </div>
              <div>
                <p className="text-white/70">Reserved for unpaid orders</p>
                <p className="mt-[2px] text-[16px] font-semibold tabular-nums">
                  {wallet ? formatMoney(wallet.held) : '—'}
                </p>
              </div>
            </div>
            {held ? (
              <p className="mt-[12px] text-[12.5px] text-white/80">
                Reserved money is released if the order isn&rsquo;t paid in time.
              </p>
            ) : null}
          </div>
        </div>

        <Panel title="Add money" className="!mb-0">
          <label htmlFor="wallet-amount" className="mb-[8px] block font-ui text-[13.5px] font-semibold text-heading">
            Amount
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-[14px] top-1/2 -translate-y-1/2 font-ui text-[16px] font-semibold text-ink-muted">
              ₹
            </span>
            <input
              ref={amountRef}
              id="wallet-amount"
              inputMode="decimal"
              autoComplete="off"
              value={input}
              disabled={busy}
              onChange={(e) => {
                setInput(e.target.value);
                if (phase === 'done') setPhase('idle');
              }}
              onKeyDown={(e) => e.key === 'Enter' && void addMoney()}
              placeholder="0"
              className={`${INPUT} pl-[30px] text-[18px] font-semibold tabular-nums`}
            />
          </div>
          <div className="mt-[10px] flex flex-wrap gap-[8px]">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => setInput(q)}
                className={`rounded-full border px-[14px] py-[5px] font-ui text-[13px] font-semibold transition-colors ${
                  toAmount(input) === Number(q).toFixed(2)
                    ? 'border-brand bg-[#eef3fc] text-brand'
                    : 'border-catalog-rule text-heading hover:border-brand hover:text-brand'
                }`}
              >
                +{formatMoney(Number(q).toFixed(2))}
              </button>
            ))}
          </div>
          {limits ? (
            <p className="mt-[10px] font-ui text-[12.5px] text-ink-muted">
              {formatMoney(limits.min)} – {formatMoney(limits.max)} at a time · wallet limit{' '}
              {formatMoney(limits.maxBalance)}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void addMoney()}
            disabled={busy}
            className={`${BTN_PRIMARY} mt-[16px] w-full`}
          >
            {busy ? (
              <>
                <Loader2 aria-hidden="true" className="size-[16px] animate-spin" />
                {phase === 'confirming' ? 'Confirming payment…' : 'Opening Razorpay…'}
              </>
            ) : (
              <>
                <Lock aria-hidden="true" className="size-[15px]" />
                {amount ? `Add ${formatMoney(amount)}` : 'Add money'}
              </>
            )}
          </button>
          <p className="mt-[10px] flex items-center justify-center gap-[6px] font-ui text-[12px] text-ink-muted">
            <CheckCircle2 aria-hidden="true" className="size-[14px] text-woo-success" />
            Secure payment by Razorpay - UPI, cards, net banking
          </p>
        </Panel>
      </div>

      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      <div className="mb-[20px] flex items-start gap-[10px] rounded-[12px] border border-[#c9d8f5] bg-[#f5f8fe] px-[16px] py-[12px] font-ui text-[13.5px] leading-[1.55] text-[#1e3a8a]">
        <Info aria-hidden="true" className="mt-[2px] size-[16px] shrink-0" />
        <span>
          Refunds for cancelled and returned items are added here as soon as they&rsquo;re approved.
          Wallet balance is store credit for shopping on YouMart and can&rsquo;t be withdrawn as cash.
          See our{' '}
          <Link href="/refund-policy" className="font-semibold underline-offset-2 hover:underline">
            refund policy
          </Link>
          .
        </span>
      </div>

      <Panel
        title="Wallet activity"
        padded={false}
        aside={
          <div role="tablist" aria-label="Filter activity" className="flex rounded-[10px] bg-[#f1f5f9] p-[3px]">
            {(
              [
                ['ALL', 'All'],
                ['CREDIT', 'Money in'],
                ['DEBIT', 'Money out'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-[8px] px-[12px] py-[5px] font-ui text-[13px] font-semibold transition-colors ${
                  filter === key ? 'bg-white text-brand shadow-rail-card' : 'text-ink-muted hover:text-heading'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {items === null ? (
          <div className="space-y-[12px] p-[20px]">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[44px] w-full" />
            ))}
          </div>
        ) : loadError && items.length === 0 ? (
          <div className="p-[20px]">
            <Banner tone="error">
              Couldn&rsquo;t load your wallet.{' '}
              <button type="button" onClick={() => void load()} className="font-semibold underline">
                Try again
              </button>
            </Banner>
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={Receipt} title="No wallet activity yet">
            Money you add, refunds and wallet payments will show up here.
          </EmptyState>
        ) : (
          <table className="w-full border-collapse font-ui text-[14px]">
            <thead>
              <tr className="border-b border-catalog-rule bg-[#fafbfc] text-left text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
                <th scope="col" className="px-[20px] py-[10px]">
                  Activity
                </th>
                <th scope="col" className="px-[12px] py-[10px]">
                  Date
                </th>
                <th scope="col" className="px-[12px] py-[10px] text-right">
                  Amount
                </th>
                <th scope="col" className="px-[20px] py-[10px] text-right">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const { label, Icon } = TYPE[t.type];
                const credit = t.direction === 'CREDIT';
                return (
                  <tr key={t.id} className="border-b border-catalog-rule last:border-0 hover:bg-[#fafcff]">
                    <td className="px-[20px] py-[12px]">
                      <div className="flex items-center gap-[12px]">
                        <span
                          className={`flex size-[36px] shrink-0 items-center justify-center rounded-full ${
                            credit ? 'bg-[#e8f7ee] text-[#15803d]' : 'bg-[#fff1e6] text-[#c2410c]'
                          }`}
                        >
                          <Icon aria-hidden="true" className="size-[17px]" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-heading">{label}</p>
                          <p className="truncate text-[13px] text-ink-muted">
                            {t.description}
                            {t.orderNumber ? (
                              <>
                                {' · '}
                                <Link href={orderHref(t.orderNumber)} className="font-semibold text-brand hover:underline">
                                  #{t.orderNumber}
                                </Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-[12px] py-[12px] text-[13px] text-ink-muted">
                      {dateTime(t.createdAt)}
                    </td>
                    <td
                      className={`whitespace-nowrap px-[12px] py-[12px] text-right font-semibold tabular-nums ${
                        credit ? 'text-[#15803d]' : 'text-heading'
                      }`}
                    >
                      <span className="inline-flex items-center gap-[4px]">
                        {credit ? (
                          <ArrowDownLeft aria-hidden="true" className="size-[14px]" />
                        ) : (
                          <ArrowUpRight aria-hidden="true" className="size-[14px]" />
                        )}
                        {credit ? '+' : '−'}
                        {formatMoney(t.amount)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-[20px] py-[12px] text-right tabular-nums text-ink-muted">
                      {formatMoney(t.balanceAfter)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {cursor ? (
          <div className="border-t border-catalog-rule p-[14px] text-center">
            <button type="button" onClick={() => void more()} disabled={loadingMore} className={BTN_SECONDARY}>
              {loadingMore ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              Show older activity
            </button>
          </div>
        ) : null}
      </Panel>
    </>
  );
}
