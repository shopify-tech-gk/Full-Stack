'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, ShoppingBag, Volume2, VolumeX, X } from 'lucide-react';
import { todaysVideo } from '@youmart/shared-client';
import { adUrl, safeAdLink, useLiveAds } from '@/lib/ads';

const HIDE_KEY = 'ym:video-hidden';

/**
 * v1.18 / v1.19 Home on the website: today's brand video (the brand's own YouTube Short, through
 * YouTube's embedded player) or a paid video ad, playing muted in a loop in a floating portrait
 * window in the bottom corner. Closing it hides it for the rest of the day.
 */
export function BrandVideoWindow() {
  const youtube = useMemo(() => todaysVideo(), []);
  const { video: ad } = useLiveAds();
  const [hidden, setHidden] = useState(true);
  const [muted, setMuted] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const today = new Date().toDateString();

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(HIDE_KEY) === today);
    } catch {
      setHidden(false);
    }
  }, [today]);

  const source = ad?.media[0] ? { kind: 'ad' as const, src: adUrl(ad.media[0]) } : youtube ? { kind: 'yt' as const, id: youtube.youtubeId } : null;
  if (hidden || !source) return null;

  const close = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(HIDE_KEY, today);
    } catch {
      // ignore
    }
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    if (source.kind === 'ad' && videoEl.current) videoEl.current.muted = next;
    if (source.kind === 'yt') {
      frame.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: next ? 'mute' : 'unMute', args: [] }),
        'https://www.youtube-nocookie.com',
      );
    }
  };

  const link = ad ? safeAdLink(ad) : null;
  const shop = !ad && youtube ? `/search?${new URLSearchParams({ q: youtube.brand, brand: youtube.brand }).toString()}` : null;
  const label = ad ? ad.advertiserName : youtube?.brand;
  const caption = ad ? ad.headline : youtube?.title;

  return (
    <aside
      aria-label={ad ? 'Sponsored video' : 'Brand video'}
      className="fixed bottom-[24px] right-[24px] z-[70] hidden w-[200px] overflow-hidden rounded-[16px] bg-black font-ui shadow-[0_18px_48px_rgba(15,23,42,0.4)] ring-1 ring-black/10 lg:block"
    >
      <div className="relative aspect-[9/16]">
        {source.kind === 'ad' ? (
          <video ref={videoEl} src={source.src} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
        ) : (
          <iframe
            ref={frame}
            title={caption ?? 'Brand video'}
            src={`https://www.youtube-nocookie.com/embed/${source.id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${source.id}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            className="pointer-events-none absolute inset-0 size-full scale-[1.02] border-0"
          />
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-[8px]">
          <span className="rounded-full bg-black/55 px-[8px] py-[2px] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white">
            {ad ? 'Sponsored' : 'Brand video'}
          </span>
          <button type="button" onClick={close} aria-label="Close video" className="flex size-[26px] items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
            <X aria-hidden="true" className="size-[14px]" />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleSound}
          aria-label={muted ? 'Turn sound on' : 'Mute'}
          className="absolute bottom-[8px] right-[8px] flex size-[30px] items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75"
        >
          {muted ? <VolumeX aria-hidden="true" className="size-[15px]" /> : <Volume2 aria-hidden="true" className="size-[15px]" />}
        </button>
      </div>
      <div className="bg-white px-[10px] py-[8px]">
        <p className="truncate text-[12px] font-semibold text-heading">{label}</p>
        <p className="truncate text-[11.5px] text-ink-muted">{caption}</p>
        {shop ? (
          <a href={shop} className="mt-[6px] flex items-center justify-center gap-[6px] rounded-[8px] bg-brand py-[6px] text-[12.5px] font-semibold text-white">
            <ShoppingBag aria-hidden="true" className="size-[13px]" /> Shop {youtube?.brand}
          </a>
        ) : link ? (
          <a href={link} target="_blank" rel="noopener noreferrer sponsored" className="mt-[6px] flex items-center justify-center gap-[6px] rounded-[8px] bg-brand py-[6px] text-[12.5px] font-semibold text-white">
            Visit <ExternalLink aria-hidden="true" className="size-[13px]" />
          </a>
        ) : null}
      </div>
    </aside>
  );
}
