'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, Plus, Send, Trash2, UploadCloud, Video } from 'lucide-react';
import { ApiError, ROUTES, formatMoney, type AdAvailability, type AdKind, type AdView, type Money } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { AD_MAX_DAYS, AD_MAX_IMAGES, uploadAdMedia } from '@/lib/ads';
import { BTN_PRIMARY, BTN_SECONDARY, Banner, INPUT, PageHeader, Panel, dateTime } from './ui';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const PRICE_FALLBACK = '1000.00';
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hourLabel = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

type Item = { key: string; preview: string; status: 'uploading' | 'done' | 'failed'; fileName?: string; url?: string; error?: string };

/** v1.19 Create an ad on the website: format -> media -> details -> schedule, beside a live preview. */
export function AdCreateView() {
  const [kind, setKind] = useState<AdKind>('IMAGE');
  const [items, setItems] = useState<Item[]>([]);
  const [advertiserName, setAdvertiserName] = useState('');
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [avail, setAvail] = useState<AdAvailability | null>(null);
  const [day, setDay] = useState<string>('');
  const [hour, setHour] = useState<number | null>(null);
  const [days, setDays] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AdView | null>(null);
  const [slide, setSlide] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Earliest start: the next whole hour at least an hour away (time for review).
  const earliest = useMemo(() => Math.ceil((Date.now() + HOUR) / HOUR) * HOUR, []);
  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => new Date(startOfDay(new Date()).getTime() + i * DAY)), []);

  const loadAvail = useCallback((k: AdKind) => {
    setAvail(null);
    api.ads
      .availability(k)
      .then(setAvail)
      .catch(() => setAvail({ kind: k, pricePerDay: PRICE_FALLBACK, maxDays: AD_MAX_DAYS, booked: [] }));
  }, []);
  useEffect(() => loadAvail(kind), [kind, loadAvail]);

  const booked = useMemo(
    () => (avail?.booked ?? []).map((b) => ({ from: new Date(b.startsAt).getTime(), to: new Date(b.endsAt).getTime() })),
    [avail],
  );
  const clashes = useCallback((start: number, n: number) => booked.some((b) => b.from < start + n * DAY && b.to > start), [booked]);
  const dayDate = day ? new Date(`${day}T00:00:00`) : null;
  const startOf = (d: Date, h: number) => d.getTime() + h * HOUR;
  const hourOk = (d: Date, h: number) => startOf(d, h) >= earliest && !clashes(startOf(d, h), days);
  const dayOk = (d: Date) => Array.from({ length: 24 }, (_, h) => h).some((h) => hourOk(d, h));

  useEffect(() => {
    if (dayDate && hour !== null && !hourOk(dayDate, hour)) setHour(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, booked]);

  const switchKind = (k: AdKind) => {
    if (k === kind) return;
    setKind(k);
    setItems([]);
    setHour(null);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const video = kind === 'VIDEO';
    const list = Array.from(files).slice(0, video ? 1 : AD_MAX_IMAGES - items.length);
    const added: Item[] = list.map((f) => ({ key: `${f.name}-${f.size}-${Math.random()}`, preview: URL.createObjectURL(f), status: 'uploading' }));
    setItems((cur) => (video ? added : [...cur, ...added]));
    await Promise.all(
      list.map(async (file, i) => {
        const key = added[i]!.key;
        try {
          const res = await uploadAdMedia(file);
          setItems((cur) => cur.map((x) => (x.key === key ? { ...x, status: 'done', fileName: res.fileName, url: res.url } : x)));
        } catch (err) {
          setItems((cur) => cur.map((x) => (x.key === key ? { ...x, status: 'failed', error: err instanceof Error ? err.message : 'Upload failed' } : x)));
        }
      }),
    );
    if (fileRef.current) fileRef.current.value = '';
  };

  const price = Number(avail?.pricePerDay ?? PRICE_FALLBACK);
  const start = dayDate && hour !== null ? startOf(dayDate, hour) : null;
  const uploading = items.some((x) => x.status === 'uploading');
  const uploaded = items.filter((x) => x.status === 'done' && x.fileName);
  const missing = [
    !uploaded.length && (kind === 'IMAGE' ? 'at least one photo' : 'a video'),
    !advertiserName.trim() && 'your brand name',
    !headline.trim() && 'a headline',
    start === null && 'a start time',
  ].filter(Boolean) as string[];
  const linkBad = linkUrl.trim() !== '' && !/^https:\/\/\S+\.\S+/.test(linkUrl.trim());

  const submit = async () => {
    if (missing.length || linkBad || uploading || start === null) return;
    setSending(true);
    setError(null);
    try {
      const { ad } = await api.ads.create({
        kind,
        advertiserName: advertiserName.trim(),
        headline: headline.trim(),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
        ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
        media: uploaded.map((x) => x.fileName!),
        startsAt: new Date(start).toISOString(),
        days,
      });
      setDone(ad);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your ad. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <>
        <PageHeader title="Ad sent for review" />
        <Panel>
          <div className="flex flex-col items-center py-[24px] text-center font-ui">
            <CheckCircle2 aria-hidden="true" className="mb-[12px] size-[56px] text-[#15803d]" />
            <p className="text-[20px] font-semibold text-heading">Thanks - we&rsquo;ve got your ad</p>
            <p className="mt-[6px] max-w-[460px] text-[14.5px] text-ink-muted">
              Reference <strong className="text-heading">{done.referenceCode}</strong>. We&rsquo;ll review it soon; once it&rsquo;s approved, pay{' '}
              <strong className="text-heading">{formatMoney(done.amount)}</strong> from your YouMart Wallet before {dateTime(done.startsAt)} to book the slot.
            </p>
            <div className="mt-[18px] flex gap-[10px]">
              <Link href={ROUTES.ads} className={BTN_PRIMARY}>
                See my ads
              </Link>
              <Link href={`${ROUTES.wallet}?add=1`} className={BTN_SECONDARY}>
                Add money to wallet
              </Link>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  const label = 'mb-[6px] block font-ui text-[13.5px] font-semibold text-heading';
  const previewPhotos = items;

  return (
    <>
      <PageHeader title="Create an ad" subtitle="Reviewed by our team before it goes live. You pay only after approval." />
      <div className="grid items-start gap-[20px] lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <Panel title="1. Format">
            <div className="grid grid-cols-2 gap-[10px] font-ui">
              {(
                [
                  ['IMAGE', 'Photo carousel', 'Up to 5 wide photos on the home page', ImageIcon],
                  ['VIDEO', 'Video', 'Portrait video in the floating window', Video],
                ] as const
              ).map(([k, title, sub, Icon]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => switchKind(k)}
                  className={`flex items-start gap-[12px] rounded-[12px] border p-[14px] text-left transition-colors ${
                    kind === k ? 'border-[#6d28d9] bg-[#f5f0ff]' : 'border-catalog-rule hover:border-cart-border'
                  }`}
                >
                  <Icon aria-hidden="true" className={`mt-[2px] size-[20px] ${kind === k ? 'text-[#6d28d9]' : 'text-ink-muted'}`} />
                  <span>
                    <span className="block text-[15px] font-semibold text-heading">{title}</span>
                    <span className="block text-[12.5px] text-ink-muted">{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title={kind === 'IMAGE' ? `2. Photos (${items.length}/${AD_MAX_IMAGES})` : '2. Video'}>
            <input
              ref={fileRef}
              type="file"
              multiple={kind === 'IMAGE'}
              accept={kind === 'IMAGE' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/quicktime'}
              className="sr-only"
              onChange={(e) => void addFiles(e.target.files)}
            />
            <div className="grid grid-cols-2 gap-[10px] md:grid-cols-3">
              {items.map((x) => (
                <div key={x.key} className="relative aspect-video overflow-hidden rounded-[10px] border border-catalog-rule bg-[#0f172a]">
                  {kind === 'IMAGE' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.preview} alt="" className="size-full object-cover" />
                  ) : (
                    <video src={x.preview} muted className="size-full object-cover" />
                  )}
                  {x.status === 'uploading' ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                      <Loader2 aria-hidden="true" className="size-[22px] animate-spin" />
                    </span>
                  ) : x.status === 'failed' ? (
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-[4px] bg-[#b91c1c] px-[6px] py-[3px] font-ui text-[11px] text-white">
                      <AlertCircle aria-hidden="true" className="size-[12px]" /> {x.error}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setItems((cur) => cur.filter((y) => y.key !== x.key))}
                    className="absolute right-[6px] top-[6px] flex size-[26px] items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Trash2 aria-hidden="true" className="size-[13px]" />
                  </button>
                </div>
              ))}
              {(kind === 'IMAGE' ? items.length < AD_MAX_IMAGES : items.length === 0) ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex aspect-video flex-col items-center justify-center gap-[6px] rounded-[10px] border-2 border-dashed border-catalog-rule font-ui text-[13px] font-semibold text-ink-muted transition-colors hover:border-[#6d28d9] hover:text-[#6d28d9]"
                >
                  {items.length ? <Plus aria-hidden="true" className="size-[22px]" /> : <UploadCloud aria-hidden="true" className="size-[24px]" />}
                  {kind === 'IMAGE' ? 'Add photos' : 'Upload video'}
                </button>
              ) : null}
            </div>
            <p className="mt-[10px] font-ui text-[12.5px] text-ink-muted">
              {kind === 'IMAGE'
                ? 'Wide photos (16:9) look best. JPG, PNG or WEBP, up to 8 MB each. They play in this order.'
                : 'Portrait (9:16) video, up to 60 seconds and 60 MB. It plays muted on loop.'}
            </p>
          </Panel>

          <Panel title="3. Details">
            <div className="grid gap-[14px] md:grid-cols-2">
              <div>
                <label htmlFor="ad-brand" className={label}>
                  Brand / business name *
                </label>
                <input id="ad-brand" value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} maxLength={60} className={INPUT} />
              </div>
              <div>
                <label htmlFor="ad-link" className={label}>
                  Link <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <input id="ad-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} maxLength={300} placeholder="https://" className={INPUT} />
                {linkBad ? <p className="mt-[4px] font-ui text-[12.5px] text-woo-error">Links must start with https://</p> : null}
              </div>
              <div className="md:col-span-2">
                <label htmlFor="ad-headline" className={label}>
                  Headline *
                </label>
                <input id="ad-headline" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={80} className={INPUT} />
                <p className="mt-[4px] text-right font-ui text-[12px] text-ink-muted">{headline.length}/80</p>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="ad-caption" className={label}>
                  Caption <span className="font-normal text-ink-muted">(optional)</span>
                </label>
                <textarea
                  id="ad-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="w-full resize-none rounded-[10px] border border-catalog-rule px-[14px] py-[10px] font-ui text-[15px] text-ink-input focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>
          </Panel>

          <Panel title="4. Schedule">
            <div className="grid gap-[14px] md:grid-cols-3">
              <div>
                <label htmlFor="ad-day" className={label}>
                  Start date
                </label>
                <select id="ad-day" value={day} onChange={(e) => setDay(e.target.value)} className={INPUT}>
                  <option value="">Choose a day</option>
                  {dates.map((d) => {
                    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return (
                      <option key={v} value={v} disabled={!dayOk(d)}>
                        {d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {dayOk(d) ? '' : ' - fully booked'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="ad-hour" className={label}>
                  Start time
                </label>
                <select
                  id="ad-hour"
                  value={hour ?? ''}
                  disabled={!dayDate}
                  onChange={(e) => setHour(e.target.value === '' ? null : Number(e.target.value))}
                  className={INPUT}
                >
                  <option value="">Choose a time</option>
                  {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                    <option key={h} value={h} disabled={!dayDate || !hourOk(dayDate, h)}>
                      {hourLabel(h)}
                      {dayDate && !hourOk(dayDate, h) ? ' - unavailable' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ad-days" className={label}>
                  How long: {days} day{days === 1 ? '' : 's'}
                </label>
                <input
                  id="ad-days"
                  type="range"
                  min={1}
                  max={avail?.maxDays ?? AD_MAX_DAYS}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-[12px] w-full accent-[#6d28d9]"
                />
              </div>
            </div>
            {booked.length ? (
              <p className="mt-[12px] font-ui text-[12.5px] text-ink-muted">
                One {kind === 'IMAGE' ? 'photo' : 'video'} ad runs at a time - booked times are greyed out.
              </p>
            ) : null}
          </Panel>
        </div>

        <aside className="space-y-[16px] lg:sticky lg:top-[96px]">
          <div className="overflow-hidden rounded-[16px] border border-catalog-rule bg-white font-ui shadow-rail-card">
            <p className="border-b border-catalog-rule px-[16px] py-[10px] text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Live preview</p>
            <div className={`relative bg-[#0f172a] ${kind === 'IMAGE' ? 'aspect-[16/9]' : 'mx-auto my-[12px] aspect-[9/16] w-[150px] rounded-[12px]'} overflow-hidden`}>
              {previewPhotos.length ? (
                kind === 'IMAGE' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewPhotos[slide % previewPhotos.length]!.preview} alt="" className="size-full object-cover" />
                ) : (
                  <video src={previewPhotos[0]!.preview} autoPlay muted loop playsInline className="size-full object-cover" />
                )
              ) : (
                <span className="flex size-full items-center justify-center text-[12.5px] text-white/60">Your {kind === 'IMAGE' ? 'photos' : 'video'} here</span>
              )}
              {kind === 'IMAGE' && previewPhotos.length > 1 ? (
                <button type="button" onClick={() => setSlide((s) => s + 1)} className="absolute bottom-[8px] right-[8px] rounded-full bg-white/85 px-[10px] py-[2px] text-[11.5px] font-semibold text-heading">
                  Next photo
                </button>
              ) : null}
            </div>
            <div className="p-[14px]">
              <span className="rounded-full bg-[#fff4d6] px-[8px] py-[2px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#92400e]">Sponsored</span>
              <p className="mt-[6px] text-[12.5px] font-semibold text-brand">{advertiserName || 'Your brand'}</p>
              <p className="text-[16px] font-semibold leading-[1.3] text-heading">{headline || 'Your headline'}</p>
              {caption ? <p className="mt-[4px] text-[13px] text-ink-muted">{caption}</p> : null}
            </div>
          </div>

          <div className="rounded-[16px] border border-catalog-rule bg-white p-[16px] font-ui shadow-rail-card">
            <dl className="space-y-[6px] text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Price per day</dt>
                <dd className="tabular-nums">{formatMoney(price.toFixed(2) as Money)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Days</dt>
                <dd className="tabular-nums">{days}</dd>
              </div>
              {start !== null ? (
                <div className="flex justify-between gap-[10px]">
                  <dt className="text-ink-muted">Runs</dt>
                  <dd className="text-right text-[13px]">
                    {dateTime(new Date(start).toISOString())} → {dateTime(new Date(start + days * DAY).toISOString())}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-dashed border-catalog-rule pt-[8px] text-[16px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMoney((price * days).toFixed(2) as Money)}</dd>
              </div>
            </dl>
            <p className="mt-[8px] text-[12px] text-ink-muted">Paid from your YouMart Wallet after approval.</p>
            {error ? <Banner tone="error">{error}</Banner> : null}
            {missing.length ? <p className="mt-[10px] text-[12.5px] text-ink-muted">Still needed: {missing.join(', ')}.</p> : null}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={sending || uploading || missing.length > 0 || linkBad}
              className="mt-[12px] inline-flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[10px] bg-[linear-gradient(135deg,#3b1a8f,#6d28d9)] font-ui text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {sending ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : <Send aria-hidden="true" className="size-[16px]" />}
              Send for review
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
