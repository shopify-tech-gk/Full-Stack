'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { PROMO_BANNER_SLIDES, PROMO_SLIDER_INTERVAL_MS } from '@youmart/shared-client';
import { DESKTOP_QUERY, REDUCED_MOTION_QUERY, useMedia, usePageHidden } from '@/lib/useMedia';

const ARROW =
  'absolute top-1/2 z-10 flex size-[46px] -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-brand opacity-0 shadow-[0_8px_24px_rgba(1,66,170,0.22)] backdrop-blur transition-[opacity,background-color,color,transform] duration-300 hover:scale-105 hover:bg-brand hover:text-white focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 group-hover:opacity-100 motion-reduce:transition-none';

/**
 * DESKTOP ONLY (>= 1025px): the promo banners as a sliding carousel - pairs glide in, auto-advance
 * with a progress dot, arrows and dots to navigate, pause on hover/focus or with the pause button.
 * Never auto-advances or animates for prefers-reduced-motion. Below 1025px PromoBanners is unchanged.
 */
export function PromoSlider() {
  const slides = PROMO_BANNER_SLIDES;
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [stopped, setStopped] = useState(false);
  const hidden = usePageHidden();
  const desktop = useMedia(DESKTOP_QUERY);
  const reduced = useMedia(REDUCED_MOTION_QUERY);
  const running = desktop && !reduced && !stopped && !hovering && !hidden && count > 1;

  // Restarts on every slide change, so manual navigation gets a full interval too.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(
      () => setIndex((current) => (current + 1) % count),
      PROMO_SLIDER_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [running, index, count]);

  const go = (next: number) => setIndex((next + count) % count);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Offers"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovering(false);
      }}
      className="hidden px-[12px] pb-[6px] pt-[14px] lg:block"
    >
      <div className="group relative mx-auto max-w-[1440px]">
        <div className="-m-[12px] overflow-hidden p-[12px]">
          <ul
            aria-live={running ? 'off' : 'polite'}
            className="flex gap-[16px] transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{ transform: `translateX(calc(${-index} * (100% + 16px)))` }}
          >
            {slides.map((pair, slide) => {
              const current = slide === index;
              return (
                <li
                  key={pair[0].id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${slide + 1} of ${count}`}
                  aria-hidden={!current}
                  className="grid w-full shrink-0 grid-cols-2 gap-[16px]"
                >
                  {pair.map((banner) => (
                    <Link
                      key={banner.id}
                      href={banner.href}
                      tabIndex={current ? undefined : -1}
                      className="group/banner relative block overflow-hidden rounded-[22px] shadow-[0_10px_30px_-12px_rgba(1,66,170,0.35)] ring-1 ring-brand/10 transition-[box-shadow,transform] duration-500 hover:-translate-y-[2px] hover:shadow-[0_18px_40px_-14px_rgba(1,66,170,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                    >
                      <Image
                        src={banner.poster}
                        alt={banner.title}
                        width={1536}
                        height={480}
                        sizes="(min-width: 1440px) 704px, 50vw"
                        className="h-auto w-full transition-transform duration-[1200ms] ease-out group-hover/banner:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/banner:scale-100"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-500 group-hover/banner:opacity-100"
                      />
                      <span
                        aria-hidden="true"
                        className="absolute bottom-[16px] right-[16px] inline-flex translate-y-[6px] items-center gap-[6px] rounded-full bg-white px-[16px] py-[8px] font-ui text-[13px] font-semibold text-brand opacity-0 shadow-[0_6px_18px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-500 group-hover/banner:translate-y-0 group-hover/banner:opacity-100 group-focus-visible/banner:translate-y-0 group-focus-visible/banner:opacity-100"
                      >
                        Shop now
                        <ArrowRight className="size-[14px]" strokeWidth={2.5} />
                      </span>
                    </Link>
                  ))}
                </li>
              );
            })}
          </ul>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous offers"
              className={`${ARROW} left-[14px]`}
            >
              <ChevronLeft aria-hidden="true" className="size-[22px]" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next offers"
              className={`${ARROW} right-[14px]`}
            >
              <ChevronRight aria-hidden="true" className="size-[22px]" strokeWidth={2.5} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-[12px] flex items-center justify-center gap-[10px]">
          <div className="flex items-center gap-[8px]">
            {slides.map((pair, slide) => {
              const current = slide === index;
              return (
                <button
                  key={pair[0].id}
                  type="button"
                  onClick={() => go(slide)}
                  aria-label={`Show offers ${slide + 1} of ${count}`}
                  aria-current={current ? 'true' : undefined}
                  className={`relative h-[8px] overflow-hidden rounded-full transition-[width,background-color] duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none ${
                    current ? 'w-[40px] bg-brand/20' : 'w-[8px] bg-brand/25 hover:bg-brand/50'
                  }`}
                >
                  {current && (
                    <span
                      key={`${index}-${running}`}
                      aria-hidden="true"
                      className={`absolute inset-0 origin-left rounded-full bg-brand ${
                        running ? 'animate-slide-progress' : ''
                      }`}
                      style={
                        running ? { animationDuration: `${PROMO_SLIDER_INTERVAL_MS}ms` } : undefined
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>
          {!reduced && (
            <button
              type="button"
              onClick={() => setStopped((value) => !value)}
              aria-label={stopped ? 'Play offers slideshow' : 'Pause offers slideshow'}
              className="flex size-[24px] items-center justify-center rounded-full text-brand transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {stopped ? (
                <Play aria-hidden="true" className="size-[11px]" fill="currentColor" />
              ) : (
                <Pause aria-hidden="true" className="size-[11px]" fill="currentColor" />
              )}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
