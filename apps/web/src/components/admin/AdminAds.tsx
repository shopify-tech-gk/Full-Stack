'use client';

import { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Images,
  Megaphone,
  OctagonX,
  Video,
  XCircle,
} from 'lucide-react';
import { API_URL } from '@/lib/api';
import { adminFetch, fmtDateTime, timeAgo, type AdminAd, type Tone } from '@/lib/admin';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  Tabs,
  useAdminData,
  useToast,
} from './ui';

// v1.19 Admin -> Advertisements: review ads people booked in the app (photos carousel or one
// video). Approve -> the advertiser pays from their wallet -> it runs in its slot. One ad per
// format at a time, so approving checks the slot is still free.

type State = AdminAd['state'];
type Tab =
  'IN_REVIEW' | 'AWAITING_PAYMENT' | 'SCHEDULED' | 'LIVE' | 'ENDED' | 'REJECTED' | 'CLOSED' | 'ALL';

const STATE: Record<State, { label: string; tone: Tone }> = {
  IN_REVIEW: { label: 'In review', tone: 'amber' },
  AWAITING_PAYMENT: { label: 'Approved · awaiting payment', tone: 'blue' },
  SCHEDULED: { label: 'Scheduled', tone: 'violet' },
  LIVE: { label: 'Live', tone: 'green' },
  ENDED: { label: 'Ended', tone: 'grey' },
  REJECTED: { label: 'Rejected', tone: 'red' },
  EXPIRED: { label: 'Expired (not paid)', tone: 'grey' },
  CANCELLED: { label: 'Cancelled', tone: 'grey' },
  REMOVED: { label: 'Taken down', tone: 'red' },
};

const TABS: { value: Tab; label: string }[] = [
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'LIVE', label: 'Live' },
  { value: 'ENDED', label: 'Ended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
];

const media = (path: string) => `${API_URL}${path}`;
const rupees = (m: string) => `₹${Number(m).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export function AdminAds() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('IN_REVIEW');
  const list = useAdminData(
    () =>
      adminFetch<{ items: AdminAd[]; counts: Record<Exclude<Tab, 'ALL'>, number> }>(
        `/admin/sellers/ads?state=${tab}`,
      ),
    [tab],
  );
  const items = list.data?.items ?? [];
  const counts = list.data?.counts;
  const [open, setOpen] = useState<AdminAd | null>(null);
  const [slide, setSlide] = useState(0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const show = (ad: AdminAd) => {
    setOpen(ad);
    setSlide(0);
    setReason('');
  };

  const act = async (action: 'approve' | 'reject' | 'remove', done: string) => {
    if (!open) return;
    setBusy(action);
    try {
      const res = await adminFetch<{ ad: AdminAd }>(`/admin/sellers/ads/${open.adId}/${action}`, {
        method: 'POST',
        ...(action === 'approve' ? {} : { body: { reason: reason.trim() } }),
      });
      setOpen({ ...res.ad, userId: open.userId });
      setReason('');
      toast.ok(done);
      await list.reload();
    } catch (failure) {
      toast.fail(failure);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Advertisements"
        subtitle="Ads people booked in the app. Approve or reject each one - the advertiser pays from their YouMart Wallet only after approval, then it runs in its slot (one photo ad and one video ad at a time)."
      />
      <div className="mb-[14px]">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={TABS.map((t) => ({
            value: t.value,
            label: t.label,
            count: t.value === 'ALL' ? undefined : counts?.[t.value],
          }))}
        />
      </div>

      {list.error && <ErrorNote message={list.error} />}
      {!list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Card>
          <Empty
            icon={Megaphone}
            title={tab === 'IN_REVIEW' ? 'Nothing to review' : 'Nothing here'}
            text={
              tab === 'IN_REVIEW'
                ? 'New ads from Account › Advertise on YouMart show up here for review.'
                : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-3">
          {items.map((ad) => (
            <button
              key={ad.adId}
              type="button"
              onClick={() => show(ad)}
              className="overflow-hidden rounded-[16px] border border-[#e6ebf3] bg-white text-left transition hover:border-[#0142aa]/40 hover:shadow-[0_6px_20px_rgba(11,27,63,0.08)]"
            >
              <div className="relative aspect-[16/9] bg-[#0f172a]">
                {ad.kind === 'IMAGE' && ad.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media(ad.media[0])} alt="" className="size-full object-cover" />
                ) : (
                  <video
                    src={media(ad.media[0] ?? '')}
                    muted
                    playsInline
                    preload="metadata"
                    className="size-full object-cover"
                  />
                )}
                <span className="absolute left-[10px] top-[10px] inline-flex items-center gap-[5px] rounded-[7px] bg-black/60 px-[7px] py-[3px] text-[11.5px] font-semibold text-white">
                  {ad.kind === 'IMAGE' ? (
                    <>
                      <Images aria-hidden="true" className="size-[13px]" /> {ad.media.length} photo
                      {ad.media.length === 1 ? '' : 's'}
                    </>
                  ) : (
                    <>
                      <Video aria-hidden="true" className="size-[13px]" /> Video
                    </>
                  )}
                </span>
              </div>
              <div className="flex flex-col gap-[6px] p-[14px]">
                <div className="flex items-center justify-between gap-[8px]">
                  <Badge tone={STATE[ad.state].tone}>{STATE[ad.state].label}</Badge>
                  <span className="text-[12px] text-[#6b7891]">{timeAgo(ad.createdAt)}</span>
                </div>
                <div className="truncate text-[15px] font-semibold text-[#0b1b3f]">
                  {ad.headline}
                </div>
                <div className="truncate text-[12.5px] text-[#5d6b85]">
                  {ad.advertiserName} · {ad.referenceCode}
                </div>
                <div className="mt-[2px] flex items-center justify-between text-[12.5px]">
                  <span className="flex items-center gap-[5px] text-[#475569]">
                    <CalendarClock aria-hidden="true" className="size-[14px]" />
                    {fmtDateTime(ad.startsAt)} · {ad.days}d
                  </span>
                  <span className="font-semibold text-[#0b1b3f]">{rupees(ad.amount)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Drawer open={!!open} title={open ? open.headline : ''} onClose={() => setOpen(null)}>
        {open && (
          <div className="flex flex-col gap-[18px]">
            <div className="overflow-hidden rounded-[14px] bg-[#0f172a]">
              {open.kind === 'IMAGE' ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media(open.media[slide] ?? open.media[0] ?? '')}
                    alt={`Photo ${slide + 1}`}
                    className="aspect-[16/9] w-full object-cover"
                  />
                  {open.media.length > 1 && (
                    <div className="flex gap-[6px] overflow-x-auto bg-[#0b1220] p-[8px]">
                      {open.media.map((m, i) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSlide(i)}
                          className={`h-[48px] w-[76px] shrink-0 overflow-hidden rounded-[8px] border-2 ${
                            i === slide ? 'border-[#ffd60a]' : 'border-transparent opacity-70'
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={media(m)} alt="" className="size-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <video
                  src={media(open.media[0] ?? '')}
                  controls
                  playsInline
                  className="mx-auto max-h-[420px] w-full bg-black"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-[8px]">
              <Badge tone={STATE[open.state].tone}>{STATE[open.state].label}</Badge>
              <span className="rounded-[8px] bg-[#f1f4f9] px-[8px] py-[3px] font-mono text-[12.5px] font-semibold text-[#0b1b3f]">
                {open.referenceCode}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-[16px] gap-y-[12px] rounded-[14px] border border-[#eef1f6] bg-[#f8fafd] p-[16px] text-[13.5px]">
              {(
                [
                  ['Advertiser', open.advertiserName],
                  [
                    'Format',
                    open.kind === 'IMAGE' ? `Photo carousel (${open.media.length})` : 'Video',
                  ],
                  ['Starts', fmtDateTime(open.startsAt)],
                  ['Ends', fmtDateTime(open.endsAt)],
                  ['Length', `${open.days} ${open.days === 1 ? 'day' : 'days'}`],
                  ['Amount', `${rupees(open.amount)} (${rupees(open.pricePerDay)}/day)`],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#6b7891]">
                    {k}
                  </dt>
                  <dd className="mt-[2px] text-[#0b1b3f]">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-[6px] text-[14px] text-[#24324d]">
              <div className="text-[16px] font-semibold text-[#0b1b3f]">{open.headline}</div>
              {open.caption && <p>{open.caption}</p>}
              {open.linkUrl && (
                <a
                  href={open.linkUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-[5px] break-all text-[13px] font-semibold text-[#0142aa] hover:underline"
                >
                  <ExternalLink aria-hidden="true" className="size-[14px] shrink-0" />
                  {open.linkUrl}
                </a>
              )}
              <p className="text-[12px] text-[#6b7891]">
                Customer ID {open.userId} · submitted {fmtDateTime(open.createdAt)}
                {open.paidAt ? ` · paid ${fmtDateTime(open.paidAt)}` : ''}
              </p>
            </div>

            {open.rejectReason && (
              <p className="rounded-[12px] bg-[#fef2f2] px-[14px] py-[10px] text-[13.5px] text-[#991b1b]">
                {open.state === 'REMOVED' ? 'Taken down: ' : 'Rejected: '}
                {open.rejectReason}
              </p>
            )}

            {(open.state === 'IN_REVIEW' ||
              open.state === 'AWAITING_PAYMENT' ||
              open.state === 'SCHEDULED' ||
              open.state === 'LIVE') && (
              <div className="flex flex-col gap-[10px] border-t border-[#eef1f6] pt-[16px]">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={
                    open.state === 'SCHEDULED' || open.state === 'LIVE'
                      ? 'Reason for taking it down (shown to the advertiser)'
                      : 'Reason if rejecting (shown to the advertiser)'
                  }
                  className="w-full resize-y rounded-[12px] border border-[#d7deea] px-[14px] py-[10px] text-[14px] text-[#0b1b3f] placeholder:text-[#8a95ab] focus:border-[#0142aa] focus:outline-none focus:ring-2 focus:ring-[#0142aa]/15"
                />
                <div className="flex flex-wrap justify-end gap-[8px]">
                  {open.state === 'SCHEDULED' || open.state === 'LIVE' ? (
                    <Button
                      icon={OctagonX}
                      busy={busy === 'remove'}
                      disabled={!reason.trim()}
                      onClick={() => void act('remove', 'Ad taken down')}
                    >
                      Take down
                    </Button>
                  ) : (
                    <>
                      <Button
                        icon={XCircle}
                        busy={busy === 'reject'}
                        disabled={!reason.trim()}
                        onClick={() => void act('reject', 'Ad rejected')}
                      >
                        Reject
                      </Button>
                      {open.state === 'IN_REVIEW' && (
                        <Button
                          variant="primary"
                          icon={CheckCircle2}
                          busy={busy === 'approve'}
                          onClick={() =>
                            void act('approve', 'Approved - the advertiser can now pay')
                          }
                        >
                          Approve
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <p className="text-[12px] text-[#6b7891]">
                  {open.state === 'IN_REVIEW'
                    ? 'Approving holds this slot; the advertiser must pay before the start time.'
                    : open.state === 'AWAITING_PAYMENT'
                      ? 'Approved and waiting for payment. Rejecting frees the slot.'
                      : 'Already paid. Taking it down stops it showing; any refund is handled separately.'}
                </p>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
