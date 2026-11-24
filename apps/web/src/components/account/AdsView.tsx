'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Image as ImageIcon, Loader2, Megaphone, Plus, Rocket, ShieldCheck, Video, Wallet } from 'lucide-react';
import { ApiError, ROUTES, formatMoney, type AdState, type AdView } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { adUrl } from '@/lib/ads';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_SMALL, Banner, Dialog, EmptyState, PageHeader, Panel, Pill, Skeleton, dateTime, type PillTone } from './ui';

export const AD_STATE: Record<AdState, { label: string; tone: PillTone }> = {
  IN_REVIEW: { label: 'In review', tone: 'orange' },
  AWAITING_PAYMENT: { label: 'Approved · pay to book', tone: 'blue' },
  SCHEDULED: { label: 'Scheduled', tone: 'violet' },
  LIVE: { label: 'Live now', tone: 'green' },
  ENDED: { label: 'Ended', tone: 'grey' },
  REJECTED: { label: 'Not approved', tone: 'red' },
  EXPIRED: { label: 'Expired · not paid', tone: 'grey' },
  CANCELLED: { label: 'Cancelled', tone: 'grey' },
  REMOVED: { label: 'Taken down', tone: 'red' },
};

const STEPS = [
  { Icon: Megaphone, title: 'Create your ad', text: 'Photos or a video, a headline and a link.' },
  { Icon: CalendarDays, title: 'Pick your days', text: 'Choose a start time and how many days.' },
  { Icon: ShieldCheck, title: 'We review it', text: 'Usually within a few hours.' },
  { Icon: Wallet, title: 'Pay & go live', text: 'Pay from your YouMart Wallet once approved.' },
];

/** v1.19 Advertise on YouMart: how it works, and the advertiser's ads - pay, cancel, see why one was rejected. */
export function AdsView() {
  const [ads, setAds] = useState<AdView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ad: AdView; action: 'pay' | 'cancel' } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setAds((await api.ads.mine()).items);
    } catch {
      setAds([]);
      setMessage({ tone: 'error', text: 'Couldn’t load your ads. Please refresh the page.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async () => {
    if (!confirm) return;
    const { ad, action } = confirm;
    setBusy(ad.adId);
    setMessage(null);
    try {
      if (action === 'pay') await api.ads.pay(ad.adId);
      else await api.ads.cancel(ad.adId);
      setConfirm(null);
      setMessage({
        tone: 'success',
        text: action === 'pay' ? `Paid ${formatMoney(ad.amount)} - your ad is booked.` : 'Your ad was cancelled.',
      });
      await load();
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Advertise on YouMart"
        subtitle="Put your brand in front of every shopper - on the home page of the app and the website."
        actions={
          <Link href={ROUTES.adsNew} className={BTN_PRIMARY}>
            <Plus aria-hidden="true" className="size-[16px]" /> Create an ad
          </Link>
        }
      />
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      <div className="mb-[20px] grid gap-[12px] md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ Icon, title, text }, i) => (
          <div key={title} className="rounded-[14px] border border-catalog-rule bg-white p-[16px] font-ui shadow-rail-card">
            <span className="mb-[10px] flex size-[40px] items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#3b1a8f,#6d28d9)] text-white">
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#6d28d9]">Step {i + 1}</p>
            <p className="text-[15px] font-semibold text-heading">{title}</p>
            <p className="mt-[2px] text-[13px] text-ink-muted">{text}</p>
          </div>
        ))}
      </div>

      <Panel title="My ads" padded={false}>
        {ads === null ? (
          <div className="space-y-[12px] p-[20px]">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[96px] w-full" />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No ads yet"
            action={
              <Link href={ROUTES.adsNew} className={BTN_PRIMARY}>
                Create your first ad
              </Link>
            }
          >
            Photo carousels show on the home page; videos play in the floating window. You only pay after we approve it.
          </EmptyState>
        ) : (
          <ul>
            {ads.map((ad) => {
              const st = AD_STATE[ad.state];
              const thumb = ad.media[0];
              return (
                <li key={ad.adId} className="flex flex-wrap gap-[16px] border-b border-catalog-rule px-[20px] py-[16px] font-ui last:border-0">
                  <span className="relative flex h-[90px] w-[140px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#0f172a]">
                    {thumb && ad.kind === 'IMAGE' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={adUrl(thumb)} alt="" className="size-full object-cover" />
                    ) : thumb ? (
                      <video src={adUrl(thumb)} muted className="size-full object-cover" />
                    ) : null}
                    <span className="absolute left-[6px] top-[6px] inline-flex items-center gap-[4px] rounded-full bg-black/60 px-[7px] py-[1px] text-[10.5px] font-semibold text-white">
                      {ad.kind === 'IMAGE' ? <ImageIcon aria-hidden="true" className="size-[11px]" /> : <Video aria-hidden="true" className="size-[11px]" />}
                      {ad.kind === 'IMAGE' ? `${ad.media.length} photo${ad.media.length === 1 ? '' : 's'}` : 'Video'}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-[8px]">
                      <div className="min-w-0">
                        <p className="truncate text-[15.5px] font-semibold text-heading">{ad.headline}</p>
                        <p className="text-[13px] text-ink-muted">
                          {ad.advertiserName} · Ref {ad.referenceCode}
                        </p>
                      </div>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    <p className="mt-[6px] text-[13px] text-heading">
                      {dateTime(ad.startsAt)} → {dateTime(ad.endsAt)} · {ad.days} day{ad.days === 1 ? '' : 's'} ·{' '}
                      <strong>{formatMoney(ad.amount)}</strong>
                    </p>
                    {ad.state === 'REJECTED' && ad.rejectReason ? (
                      <p className="mt-[6px] rounded-[8px] bg-[#fdf0f0] px-[10px] py-[6px] text-[13px] text-[#991b1b]">Reason: {ad.rejectReason}</p>
                    ) : ad.state === 'IN_REVIEW' ? (
                      <p className="mt-[6px] text-[13px] text-ink-muted">We&rsquo;ll review it soon. You pay only after it&rsquo;s approved.</p>
                    ) : ad.state === 'AWAITING_PAYMENT' ? (
                      <p className="mt-[6px] text-[13px] text-[#1d4ed8]">Approved! Pay before {dateTime(ad.startsAt)} to book your slot.</p>
                    ) : null}
                    {ad.state === 'AWAITING_PAYMENT' || ad.state === 'IN_REVIEW' ? (
                      <div className="mt-[10px] flex gap-[8px]">
                        {ad.state === 'AWAITING_PAYMENT' ? (
                          <button type="button" onClick={() => setConfirm({ ad, action: 'pay' })} disabled={busy !== null} className={`${BTN_SMALL} !border-brand !bg-brand !text-white`}>
                            <Wallet aria-hidden="true" className="size-[13px]" /> Pay {formatMoney(ad.amount)}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => setConfirm({ ad, action: 'cancel' })} disabled={busy !== null} className={`${BTN_SMALL} hover:!border-woo-error hover:!text-woo-error`}>
                          Cancel ad
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog
        open={confirm !== null}
        onClose={() => !busy && setConfirm(null)}
        title={confirm?.action === 'pay' ? 'Pay for this ad?' : 'Cancel this ad?'}
        description={
          confirm?.action === 'pay'
            ? `${formatMoney(confirm.ad.amount)} will be taken from your YouMart Wallet and your slot booked.`
            : 'It won’t be shown, and nothing is charged.'
        }
        footer={
          <>
            <button type="button" onClick={() => setConfirm(null)} disabled={busy !== null} className={BTN_SECONDARY}>
              Go back
            </button>
            <button type="button" onClick={() => void act()} disabled={busy !== null} className={BTN_PRIMARY}>
              {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              {confirm?.action === 'pay' ? 'Pay from wallet' : 'Cancel ad'}
            </button>
          </>
        }
      >
        {confirm?.action === 'pay' ? (
          <p className="text-[13.5px] text-ink-muted">
            Not enough in your wallet?{' '}
            <Link href={`${ROUTES.wallet}?add=1`} className="font-semibold text-brand hover:underline">
              Add money first
            </Link>
            .
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
