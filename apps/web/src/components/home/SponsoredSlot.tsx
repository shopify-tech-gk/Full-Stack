'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { adUrl, safeAdLink, useLiveAds } from '@/lib/ads';

const AUTO_MS = 4500;

/**
 * v1.19 Home "Sponsored" slot on the website: the live image ad (approved + paid) as a wide banner -
 * the advertiser's photos crossfading on their own, with the headline and caption beside them.
 * Nothing shows when no image ad is live.
 */
export function SponsoredSlot() {
  const { image: ad } = useLiveAds();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const photos = ad?.media ?? [];

  useEffect(() => setIndex(0), [ad?.adId]);
  useEffect(() => {
    if (photos.length < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % photos.length), AUTO_MS);
    return () => clearInterval(t);
  }, [photos.length, paused]);

  if (!ad || photos.length === 0) return null;
  const link = safeAdLink(ad);
  const go = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);

  const body = (
    <div className="grid overflow-hidden rounded-[18px] border border-catalog-rule bg-white shadow-rail-card md:grid-cols-[1.6fr_1fr]">
      <div className="relative aspect-[16/8] bg-[#0f172a]">
        {photos.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={adUrl(src)}
            alt={i === index ? ad.headline : ''}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        {photos.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.preventDefault();
                go(-1);
              }}
              className="absolute left-[12px] top-1/2 flex size-[36px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-heading shadow hover:bg-white"
            >
              <ChevronLeft aria-hidden="true" className="size-[18px]" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.preventDefault();
                go(1);
              }}
              className="absolute right-[12px] top-1/2 flex size-[36px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-heading shadow hover:bg-white"
            >
              <ChevronRight aria-hidden="true" className="size-[18px]" />
            </button>
            <div className="absolute bottom-[12px] left-1/2 flex -translate-x-1/2 gap-[6px]">
              {photos.map((src, i) => (
                <span key={src} className={`h-[6px] rounded-full transition-all ${i === index ? 'w-[20px] bg-white' : 'w-[6px] bg-white/55'}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      <div className="flex flex-col justify-center gap-[10px] p-[24px] font-ui">
        <span className="w-fit rounded-full bg-[#fff4d6] px-[10px] py-[3px] text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#92400e]">
          Sponsored
        </span>
        <p className="text-[13px] font-semibold text-brand">{ad.advertiserName}</p>
        <h2 className="text-[24px] font-semibold leading-[1.25] text-heading">{ad.headline}</h2>
        {ad.caption ? <p className="text-[14.5px] leading-[1.55] text-ink-muted">{ad.caption}</p> : null}
        {link ? (
          <span className="mt-[6px] inline-flex w-fit items-center gap-[8px] rounded-[10px] bg-brand px-[18px] py-[10px] text-[14px] font-semibold text-white">
            Visit <ExternalLink aria-hidden="true" className="size-[15px]" />
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <section
      aria-label="Sponsored"
      className="mx-auto mt-[28px] max-w-[1240px] px-[16px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer sponsored" className="block transition-transform hover:-translate-y-[1px]">
          {body}
        </a>
      ) : (
        body
      )}
    </section>
  );
}
