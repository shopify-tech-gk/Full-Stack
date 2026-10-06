'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { EXPLORE_CATEGORY_PLACEHOLDER, ROUTES, type TaxonomyMain } from '@youmart/shared-client';
import type { CategoryBarMain } from '@/lib/category-taxonomy';
import { TileImage } from './TileImage';

const ROUND_ARROW =
  'flex size-[32px] shrink-0 items-center justify-center rounded-full border border-card-border bg-white text-brand shadow-carousel-arrow transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-brand';

const HOVER_OPEN_MS = 180;
const HOVER_CLOSE_MS = 250;

/**
 * DESKTOP ONLY (>= 1025px): the redesign's category navigation for every page except the homepage
 * (which has the full Explore Categories grid) - a scrolling row of main categories, each opening a
 * mega panel of its sub-categories and their sub-to-sub tiles.
 */
export function CategoryBar({
  mains,
  activeSlug,
}: {
  mains: readonly CategoryBarMain[];
  activeSlug?: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState<string | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const openMain = mains.find((m) => m.slug === open) ?? null;

  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[data-active]');
    if (active) el.scrollLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(null);
    const onDown = (event: MouseEvent) =>
      !navRef.current?.contains(event.target as Node) && setOpen(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  const scroll = (direction: 1 | -1) =>
    listRef.current?.scrollBy({
      left: direction * listRef.current.clientWidth * 0.75,
      behavior: 'smooth',
    });

  return (
    <nav
      ref={navRef}
      aria-label="Shop by category"
      onMouseEnter={() => open && clearTimeout(timer.current)}
      onMouseLeave={() => later(() => setOpen(null), HOVER_CLOSE_MS)}
      className="hidden px-[12px] pt-[10px] lg:block"
    >
      <div className="relative mx-auto max-w-[1440px] rounded-[16px] border border-brand-popup-border bg-brand-popup-bg p-[8px]">
        <div className="flex items-center gap-[10px]">
          <Link
            href={ROUTES.shop}
            className="inline-flex h-[38px] shrink-0 items-center gap-[8px] rounded-full bg-brand px-[16px] font-ui text-[13.5px] font-semibold text-white transition-[opacity,box-shadow] hover:opacity-90 hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <LayoutGrid aria-hidden="true" className="size-[16px]" strokeWidth={2.25} />
            All Categories
          </Link>
          <button
            type="button"
            onClick={() => scroll(-1)}
            disabled={!edges.left}
            aria-label="Scroll categories left"
            className={ROUND_ARROW}
          >
            <ChevronLeft aria-hidden="true" className="size-[17px]" strokeWidth={2.5} />
          </button>
          <div className="relative min-w-0 flex-1">
            <ul
              ref={listRef}
              onScroll={measure}
              className="relative flex gap-[8px] overflow-x-auto overscroll-x-contain scroll-smooth py-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {mains.map((main) => {
                const isOpen = open === main.slug;
                const current = main.slug === activeSlug;
                return (
                  <li key={main.slug} data-active={current || undefined} className="shrink-0">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? 'category-bar-panel' : undefined}
                      aria-current={current ? 'page' : undefined}
                      onClick={() => {
                        clearTimeout(timer.current);
                        setOpen(isOpen ? null : main.slug);
                      }}
                      onMouseEnter={() => later(() => setOpen(main.slug), open ? 0 : HOVER_OPEN_MS)}
                      onMouseLeave={() => !open && clearTimeout(timer.current)}
                      className={`flex h-[38px] items-center gap-[8px] whitespace-nowrap rounded-full border bg-white pl-[4px] pr-[10px] font-ui text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        isOpen || current
                          ? 'border-brand text-brand'
                          : 'border-cart-line text-heading hover:border-brand hover:text-brand'
                      }`}
                    >
                      <Image
                        src={main.image ?? EXPLORE_CATEGORY_PLACEHOLDER}
                        alt=""
                        width={960}
                        height={300}
                        sizes="72px"
                        className="h-[28px] w-[56px] rounded-full object-cover"
                      />
                      {main.name}
                      <ChevronDown
                        aria-hidden="true"
                        className={`size-[13px] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        strokeWidth={2.75}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            {edges.left && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-[28px] bg-gradient-to-r from-brand-popup-bg to-transparent"
              />
            )}
            {edges.right && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-[28px] bg-gradient-to-l from-brand-popup-bg to-transparent"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => scroll(1)}
            disabled={!edges.right}
            aria-label="Scroll categories right"
            className={ROUND_ARROW}
          >
            <ChevronRight aria-hidden="true" className="size-[17px]" strokeWidth={2.5} />
          </button>
        </div>

        {openMain && <MegaPanel key={openMain.slug} main={openMain} />}
      </div>
    </nav>
  );
}

/** One main's sub-categories (left) and the hovered sub's sub-to-sub tiles (right). */
function MegaPanel({ main }: { main: CategoryBarMain }) {
  const [full, setFull] = useState<TaxonomyMain | null | undefined>(undefined);
  const [subSlug, setSubSlug] = useState<string | null>(null);
  const sub = full?.subcategories.find((s) => s.slug === subSlug) ?? null;

  // The taxonomy is its own chunk, fetched on the first open (never on mobile).
  useEffect(() => {
    let alive = true;
    import('@/lib/category-taxonomy')
      .then(({ taxonomyMain }) => {
        if (!alive) return;
        const found = taxonomyMain(main.slug);
        setFull(found);
        setSubSlug(found?.subcategories[0]?.slug ?? null);
      })
      .catch(() => alive && setFull(null));
    return () => {
      alive = false;
    };
  }, [main.slug]);

  return (
    <div
      id="category-bar-panel"
      role="region"
      aria-label={`${main.name} categories`}
      className="absolute inset-x-0 top-full z-40 mt-[6px] flex h-[420px] overflow-hidden rounded-[16px] border border-brand bg-white shadow-menu"
    >
      <div className="flex w-[290px] shrink-0 flex-col border-r border-cart-line bg-brand-popup-bg">
        <Link
          href={main.href}
          className="group m-[10px] mb-[6px] flex items-center gap-[10px] rounded-[10px] border border-cart-line bg-white p-[5px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Image
            src={main.image ?? EXPLORE_CATEGORY_PLACEHOLDER}
            alt=""
            width={960}
            height={300}
            sizes="96px"
            className="aspect-[16/5] w-[96px] shrink-0 rounded-[7px] object-cover"
          />
          <span className="min-w-0">
            <span className="line-clamp-2 font-ui text-[14px] font-semibold leading-[1.2] text-heading group-hover:text-brand">
              {main.name}
            </span>
            <span className="mt-[3px] inline-flex items-center gap-[3px] font-ui text-[11.5px] font-semibold text-brand">
              View all
              <ArrowRight aria-hidden="true" className="size-[11px]" strokeWidth={2.5} />
            </span>
          </span>
        </Link>
        {full === undefined ? (
          <p aria-busy="true" className="px-[14px] py-[10px] font-sans text-[12px] text-ink-body">
            Loading&hellip;
          </p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[10px] pb-[10px]">
            {full?.subcategories.map((item) => {
              const active = item.slug === subSlug;
              return (
                <li key={item.slug}>
                  <Link
                    href={item.href}
                    onMouseEnter={() => setSubSlug(item.slug)}
                    onFocus={() => setSubSlug(item.slug)}
                    className={`flex items-center gap-[10px] rounded-[8px] px-[5px] py-[4px] font-sans text-[12.5px] leading-[1.3] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      active
                        ? 'bg-white font-semibold text-brand shadow-rail-card'
                        : 'text-ink-body'
                    }`}
                  >
                    <span className="relative block h-[39px] w-[26px] shrink-0 overflow-hidden rounded-[5px] border border-cart-line bg-white">
                      <TileImage src={item.image} sizes="26px" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    {item.children.length > 0 && (
                      <ChevronRight
                        aria-hidden="true"
                        className="size-[12px] shrink-0 opacity-60"
                        strokeWidth={2.5}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-[16px]">
        {sub && (
          <>
            <div className="flex items-center justify-between gap-[12px] border-b border-cart-line pb-[10px]">
              <p className="min-w-0 truncate font-ui text-[17px] font-bold leading-[1.2] text-heading">
                {sub.name}
              </p>
              <Link
                href={sub.href}
                className="inline-flex shrink-0 items-center gap-[4px] font-ui text-[12.5px] font-semibold text-brand hover:underline"
              >
                View all {sub.name}
                <ArrowRight aria-hidden="true" className="size-[12px]" strokeWidth={2.5} />
              </Link>
            </div>
            <ul className="mt-[12px] grid min-h-0 grid-cols-[repeat(auto-fill,minmax(84px,1fr))] content-start gap-x-[12px] gap-y-[14px] overflow-y-auto overscroll-contain pr-[4px]">
              {(sub.children.length > 0 ? sub.children : [sub]).map((child) => (
                <li key={child.slug}>
                  <Link
                    href={child.href}
                    title={child.name}
                    className="group/tile flex flex-col items-center rounded-[8px] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="relative block aspect-[2/3] w-full max-w-[72px] overflow-hidden rounded-[8px] border border-cart-line transition-colors group-hover/tile:border-brand">
                      <TileImage src={child.image} sizes="72px" />
                    </span>
                    <span className="mt-[6px] line-clamp-2 font-sans text-[11.5px] leading-[1.25] text-ink-body group-hover/tile:text-brand">
                      {child.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
