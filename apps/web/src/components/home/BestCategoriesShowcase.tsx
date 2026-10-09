'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { CATEGORY_TILE_PLACEHOLDER } from '@youmart/shared-client';
import type { BestCategorySlide } from '@/lib/category-taxonomy';
import { DESKTOP_QUERY, REDUCED_MOTION_QUERY, useMedia, usePageHidden } from '@/lib/useMedia';

/** How long each category stays before the next one rotates in. */
const ROTATE_MS = 7000;

const ROUND =
  'flex size-[38px] shrink-0 items-center justify-center rounded-full border border-card-border bg-white text-brand shadow-carousel-arrow transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-brand';

/**
 * DESKTOP ONLY (>= 1025px): live's "Best Categories Today" for EVERY category - the featured
 * category rotates automatically (pausing on hover/focus, off-screen, in a hidden tab, with the
 * pause button, and never for reduced motion) and only its sub-categories slide below.
 * Below 1025px BestCategoriesCarousel is unchanged. `slides` comes from the taxonomy (the same
 * categories/sub-categories Explore Categories uses), each item carrying its portrait artwork.
 */
export function BestCategoriesShowcase({ slides }: { slides: BestCategorySlide[] }) {
  const count = slides.length;
  const sectionRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [visible, setVisible] = useState(false);
  const [edges, setEdges] = useState({ left: false, right: false });
  const hidden = usePageHidden();
  const desktop = useMedia(DESKTOP_QUERY);
  const reduced = useMedia(REDUCED_MOTION_QUERY);
  const running = desktop && visible && !reduced && !stopped && !hovering && !hidden && count > 1;
  const slide = slides[index];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // A fresh full interval after every change, manual or automatic.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [running, index, count]);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  // New category: its slider starts at the beginning and its chip scrolls into view (the chip row
  // only - never the page).
  useEffect(() => {
    if (trackRef.current) trackRef.current.scrollLeft = 0;
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="true"]');
    if (row && chip) {
      row.scrollTo({
        left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
        behavior: reduced ? 'auto' : 'smooth',
      });
    }
    measure();
  }, [index, measure, reduced]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const go = (next: number) => setIndex((next + count) % count);
  const scroll = (direction: 1 | -1) =>
    trackRef.current?.scrollBy({
      left: direction * trackRef.current.clientWidth * 0.8,
      behavior: reduced ? 'auto' : 'smooth',
    });

  if (!slide) return null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="best-categories-showcase"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovering(false);
      }}
      className="hidden px-[12px] py-[26px] lg:block"
    >
      <div className="mx-auto max-w-[1440px] overflow-hidden rounded-[24px] border border-brand-popup-border bg-white shadow-cart-table">
        <div className="relative bg-gradient-to-br from-brand-popup-bg via-white to-white px-[24px] pb-[14px] pt-[22px]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-[60px] -top-[90px] size-[260px] rounded-full bg-brand/5"
          />
          <div className="relative flex items-end justify-between gap-[24px]">
            <div className="min-w-0">
              <p className="flex items-center gap-[10px] font-ui text-[12px] font-bold uppercase tracking-[0.18em] text-brand">
                <span aria-hidden="true" className="h-[3px] w-[26px] rounded-full bg-brand" />
                Best Categories Today
              </p>
              <h2
                id="best-categories-showcase"
                aria-live={running ? 'off' : 'polite'}
                className="mt-[8px] flex items-baseline gap-[12px] font-ui text-[30px] font-bold leading-[1.1] text-heading"
              >
                <span key={slide.slug} className="animate-rise-in motion-reduce:animate-none">
                  {slide.name}
                </span>
                <span className="font-sans text-[13px] font-normal text-ink-body">
                  {slide.items.length} sub-categories
                </span>
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-[10px]">
              <Link
                href={slide.href}
                className="mr-[6px] inline-flex h-[40px] items-center gap-[8px] rounded-full bg-brand px-[18px] font-ui text-[13.5px] font-semibold text-white transition-[opacity,box-shadow] hover:opacity-90 hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                Shop {slide.name}
                <ArrowRight aria-hidden="true" className="size-[15px]" strokeWidth={2.5} />
              </Link>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous category"
                className={ROUND}
              >
                <ChevronLeft aria-hidden="true" className="size-[19px]" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next category"
                className={ROUND}
              >
                <ChevronRight aria-hidden="true" className="size-[19px]" strokeWidth={2.5} />
              </button>
              {!reduced && (
                <button
                  type="button"
                  onClick={() => setStopped((value) => !value)}
                  aria-label={stopped ? 'Resume category rotation' : 'Pause category rotation'}
                  className="flex size-[30px] items-center justify-center rounded-full text-brand transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {stopped ? (
                    <Play aria-hidden="true" className="size-[12px]" fill="currentColor" />
                  ) : (
                    <Pause aria-hidden="true" className="size-[12px]" fill="currentColor" />
                  )}
                </button>
              )}
            </div>
          </div>

          <ul
            ref={chipsRef}
            aria-label="Categories"
            className="relative mt-[16px] flex gap-[8px] overflow-x-auto pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((s, i) => {
              const current = i === index;
              return (
                <li key={s.slug} className="shrink-0">
                  <button
                    type="button"
                    aria-current={current ? 'true' : undefined}
                    onClick={() => go(i)}
                    className={`relative h-[34px] overflow-hidden whitespace-nowrap rounded-full border px-[14px] font-ui text-[12.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      current
                        ? 'border-brand bg-brand text-white shadow-brand-button'
                        : 'border-cart-line bg-white text-heading hover:border-brand hover:text-brand'
                    }`}
                  >
                    {current && running && (
                      <span
                        key={`${index}-progress`}
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-[3px] origin-left animate-slide-progress bg-white/60"
                        style={{ animationDuration: `${ROTATE_MS}ms` }}
                      />
                    )}
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative px-[24px] pb-[24px] pt-[18px]">
          <ul
            ref={trackRef}
            onScroll={measure}
            aria-label={`${slide.name} sub-categories`}
            className="flex snap-x snap-proximity gap-[16px] overflow-x-auto overscroll-x-contain scroll-smooth px-[2px] pb-[10px] pt-[6px] [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
          >
            {slide.items.map((item, i) => (
              <li
                key={item.href}
                className="w-[176px] shrink-0 snap-start animate-rise-in motion-reduce:animate-none"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <Link
                  href={item.href}
                  className="group/tile block overflow-hidden rounded-[18px] border border-cart-line bg-white shadow-rail-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[4px] hover:border-brand hover:shadow-cart-table focus:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span className="relative block aspect-[2/3] overflow-hidden bg-brand-popup-bg">
                    <Image
                      src={item.image ?? CATEGORY_TILE_PLACEHOLDER}
                      alt=""
                      fill
                      unoptimized={!item.image}
                      sizes="176px"
                      className="object-cover transition-transform duration-500 ease-out group-hover/tile:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover/tile:scale-100"
                    />
                  </span>
                  <span className="flex items-center justify-between gap-[6px] border-t border-cart-line px-[12px] py-[10px]">
                    <span className="min-w-0 truncate font-ui text-[13.5px] font-semibold capitalize text-heading group-hover/tile:text-brand">
                      {item.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex size-[20px] shrink-0 items-center justify-center rounded-full border border-brand text-brand transition-colors group-hover/tile:bg-brand group-hover/tile:text-white"
                    >
                      <ChevronRight className="size-[12px]" strokeWidth={3} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {edges.left && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[24px] left-[24px] top-[18px] w-[40px] bg-gradient-to-r from-white to-transparent"
              />
              <button
                type="button"
                onClick={() => scroll(-1)}
                aria-label={`Scroll ${slide.name} sub-categories left`}
                className={`${ROUND} absolute left-[10px] top-[42%] -translate-y-1/2`}
              >
                <ChevronLeft aria-hidden="true" className="size-[19px]" strokeWidth={2.5} />
              </button>
            </>
          )}
          {edges.right && (
            <>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[24px] right-[24px] top-[18px] w-[40px] bg-gradient-to-l from-white to-transparent"
              />
              <button
                type="button"
                onClick={() => scroll(1)}
                aria-label={`Scroll ${slide.name} sub-categories right`}
                className={`${ROUND} absolute right-[10px] top-[42%] -translate-y-1/2`}
              >
                <ChevronRight aria-hidden="true" className="size-[19px]" strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
