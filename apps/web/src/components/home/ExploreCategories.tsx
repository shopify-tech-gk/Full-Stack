'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  EXPLORE_CATEGORY_PLACEHOLDER,
  ROUTES,
  taxonomyPages,
  type TaxonomyLeaf,
} from '@youmart/shared-client';
import { TileImage } from '@/components/category/TileImage';
import type { ExploreMain, ExploreSub } from '@/lib/category-taxonomy';

const ROUND_ARROW =
  'flex size-[34px] items-center justify-center rounded-full border border-card-border bg-white text-brand shadow-carousel-arrow transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-brand';

/**
 * DESKTOP ONLY (>= 1025px, `lg`): the client's "Explore Categories" redesign - 6 x 2 main-category
 * cards paged by the arrows (alphabetical), each with its own horizontally scrolling sub-category
 * row; a sub-category opens its sub-to-sub list in a panel anchored to the card.
 */
export function ExploreCategories({ mains }: { mains: readonly ExploreMain[] }) {
  const pages = taxonomyPages(mains);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const items = pages[page] ?? [];
  const first = page * (pages[0]?.length ?? 0) + 1;

  const go = (next: number) => {
    setOpen(null);
    setPage(next);
  };

  return (
    <section
      aria-labelledby="explore-categories"
      className="hidden px-[12px] pb-[6px] pt-[10px] lg:block"
    >
      <div className="mx-auto max-w-[1440px] rounded-[16px] border border-brand-popup-border bg-brand-popup-bg px-[14px] pb-[14px] pt-[14px]">
        <div className="flex items-center gap-[28px] px-[4px]">
          <h2
            id="explore-categories"
            className="flex shrink-0 items-center gap-[14px] font-ui text-[30px] font-bold leading-none text-heading"
          >
            <span aria-hidden="true" className="h-[4px] w-[34px] rounded-full bg-brand" />
            <span>
              Explore <span className="text-brand">Categories</span>
            </span>
          </h2>
          <p className="max-w-[390px] font-sans text-[12.5px] leading-[1.5] text-ink-body">
            Everything you need, in one place. Shop from our wide range of categories and find
            exactly what you&rsquo;re looking for.
          </p>
          <div className="ml-auto flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => go(page - 1)}
              disabled={page === 0}
              aria-label="Previous categories"
              className={ROUND_ARROW}
            >
              <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => go(page + 1)}
              disabled={page >= pages.length - 1}
              aria-label="Next categories"
              className={ROUND_ARROW}
            >
              <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2.5} />
            </button>
            <Link
              href={ROUTES.shop}
              className="ml-[26px] inline-flex h-[40px] items-center gap-[10px] rounded-full bg-brand px-[22px] font-ui text-[14px] font-semibold text-white transition-[opacity,box-shadow] hover:opacity-90 hover:shadow-brand-button focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              View All Categories
              <ArrowRight aria-hidden="true" className="size-[16px]" strokeWidth={2.25} />
            </Link>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          Showing categories {first} to {first + items.length - 1} of {mains.length}
        </p>
        <ul className="mt-[14px] grid grid-cols-6 gap-[10px]">
          {items.map((main) => (
            <MainCard
              key={main.slug}
              main={main}
              openSub={open?.startsWith(`${main.slug}/`) ? open.slice(main.slug.length + 1) : null}
              onOpenSub={(sub) => setOpen(sub ? `${main.slug}/${sub}` : null)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

interface MainCardProps {
  main: ExploreMain;
  openSub: string | null;
  onOpenSub: (subSlug: string | null) => void;
}

function MainCard({ main, openSub, onOpenSub }: MainCardProps) {
  const cardRef = useRef<HTMLLIElement>(null);
  const panelId = useId();
  const active = main.subcategories.find((s) => s.slug === openSub) ?? null;

  // The sub-to-sub panel closes on Escape or a click anywhere outside its card.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onOpenSub(null);
    const onDown = (event: MouseEvent) =>
      !cardRef.current?.contains(event.target as Node) && onOpenSub(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [active, onOpenSub]);

  return (
    <li
      ref={cardRef}
      className={`group relative flex min-w-0 flex-col rounded-[12px] border bg-white p-[6px] shadow-rail-card transition-shadow hover:shadow-cart-table ${
        active ? 'z-20 border-brand' : 'border-cart-line'
      }`}
    >
      <Link
        href={main.href}
        tabIndex={-1}
        aria-hidden="true"
        className="block overflow-hidden rounded-[9px] bg-brand-popup-bg"
      >
        {/* Lazy (no priority): the section is display:none below 1025px, so mobile never fetches these. */}
        <Image
          src={main.image.desktop ?? EXPLORE_CATEGORY_PLACEHOLDER}
          alt=""
          width={960}
          height={400}
          sizes="(min-width: 1440px) 225px, 16vw"
          className="aspect-[12/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </Link>

      <div className="flex items-center justify-between gap-[6px] px-[4px] pb-[7px] pt-[9px]">
        <h3 className="min-w-0 truncate font-ui text-[14.5px] font-semibold leading-[1.2] text-heading">
          <Link
            href={main.href}
            title={main.name}
            className="hover:text-brand focus:outline-none focus-visible:underline"
          >
            {main.name}
          </Link>
        </h3>
        <Link
          href={main.href}
          tabIndex={-1}
          aria-hidden="true"
          className="flex size-[19px] shrink-0 items-center justify-center rounded-full border border-brand text-brand transition-colors hover:bg-brand hover:text-white"
        >
          <ChevronRight className="size-[12px]" strokeWidth={3} />
        </Link>
      </div>

      <SubRow
        main={main}
        openSub={openSub}
        panelId={panelId}
        onToggle={(slug) => onOpenSub(openSub === slug ? null : slug)}
      />

      {active && (
        <SubPanel id={panelId} mainSlug={main.slug} sub={active} onClose={() => onOpenSub(null)} />
      )}
    </li>
  );
}

interface SubRowProps {
  main: ExploreMain;
  openSub: string | null;
  panelId: string;
  onToggle: (subSlug: string) => void;
}

/** The card's own horizontal scroller (never scrolls the page); fades + nudges show there's more. */
function SubRow({ main, openSub, panelId, onToggle }: SubRowProps) {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const nudge = (direction: 1 | -1) =>
    ref.current?.scrollBy({ left: direction * ref.current.clientWidth * 0.75, behavior: 'smooth' });

  return (
    <div className="relative">
      <ul
        ref={ref}
        onScroll={measure}
        aria-label={`${main.name} sub-categories`}
        className="flex snap-x snap-proximity gap-[4px] overflow-x-auto overscroll-x-contain scroll-smooth pb-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {main.subcategories.map((sub) => (
          <li key={sub.slug} className="w-[52px] shrink-0 snap-start">
            <SubTile
              sub={sub}
              open={openSub === sub.slug}
              panelId={panelId}
              onToggle={() => onToggle(sub.slug)}
            />
          </li>
        ))}
      </ul>
      {edges.left && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-[24px] bg-gradient-to-r from-white to-transparent"
          />
          <ScrollNudge
            direction={-1}
            onClick={() => nudge(-1)}
            label={`Scroll ${main.name} sub-categories left`}
          />
        </>
      )}
      {edges.right && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-[24px] bg-gradient-to-l from-white to-transparent"
          />
          <ScrollNudge
            direction={1}
            onClick={() => nudge(1)}
            label={`Scroll ${main.name} sub-categories right`}
          />
        </>
      )}
    </div>
  );
}

function ScrollNudge({
  direction,
  onClick,
  label,
}: {
  direction: 1 | -1;
  onClick: () => void;
  label: string;
}) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={onClick}
      className={`absolute top-[24px] flex size-[20px] items-center justify-center rounded-full border border-card-border bg-white text-brand opacity-0 shadow-carousel-arrow transition-opacity group-hover:opacity-100 ${
        direction === 1 ? 'right-[-2px]' : 'left-[-2px]'
      }`}
    >
      <Icon aria-hidden="true" className="size-[12px]" strokeWidth={3} />
    </button>
  );
}

const TILE =
  'group/tile flex w-full flex-col items-center rounded-[7px] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

function SubTile({
  sub,
  open,
  panelId,
  onToggle,
}: {
  sub: ExploreSub;
  open: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const body = (
    <>
      <span
        className={`relative block h-[69px] w-[46px] overflow-hidden rounded-[7px] border ${
          open ? 'border-brand ring-1 ring-brand' : 'border-cart-line'
        }`}
      >
        <TileImage src={sub.image} sizes="46px" />
      </span>
      <span
        className={`mt-[4px] line-clamp-2 block w-full hyphens-auto font-sans text-[8.5px] font-medium leading-[10px] [overflow-wrap:anywhere] ${
          open ? 'text-brand' : 'text-ink-body group-hover/tile:text-brand'
        }`}
      >
        {sub.name}
      </span>
    </>
  );

  if (sub.direct) {
    return (
      <Link href={sub.href} title={sub.name} className={`${TILE} hover:text-brand`}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      title={sub.name}
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={onToggle}
      className={TILE}
    >
      {body}
    </button>
  );
}

/** Sub-to-sub reveal: a panel hanging from the card, list loaded on first open (desktop chunk). */
function SubPanel({
  id,
  mainSlug,
  sub,
  onClose,
}: {
  id: string;
  mainSlug: string;
  sub: ExploreSub;
  onClose: () => void;
}) {
  const [children, setChildren] = useState<TaxonomyLeaf[] | null>(null);

  useEffect(() => {
    let active = true;
    setChildren(null);
    import('@/lib/category-taxonomy')
      .then(({ taxonomyChildren }) => active && setChildren(taxonomyChildren(mainSlug, sub.slug)))
      .catch(() => active && setChildren([]));
    return () => {
      active = false;
    };
  }, [mainSlug, sub.slug]);

  return (
    <div
      id={id}
      role="region"
      aria-label={`${sub.name} categories`}
      className="absolute inset-x-[-1px] top-full z-30 mt-[6px] rounded-[12px] border border-brand bg-white p-[10px] shadow-menu"
    >
      <div className="flex items-start justify-between gap-[8px] border-b border-cart-line pb-[8px]">
        <div className="min-w-0">
          <p className="truncate font-ui text-[13.5px] font-semibold leading-[1.2] text-heading">
            {sub.name}
          </p>
          <Link
            href={sub.href}
            className="mt-[3px] inline-flex items-center gap-[3px] font-ui text-[11.5px] font-semibold text-brand hover:underline"
          >
            View all
            <ArrowRight aria-hidden="true" className="size-[11px]" strokeWidth={2.5} />
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${sub.name}`}
          className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-ink-body hover:bg-brand-popup-bg hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X aria-hidden="true" className="size-[14px]" strokeWidth={2.5} />
        </button>
      </div>
      {children === null ? (
        <p aria-busy="true" className="py-[10px] font-sans text-[12px] text-ink-body">
          Loading&hellip;
        </p>
      ) : (
        <ul className="mt-[6px] max-h-[252px] overflow-y-auto overscroll-contain pr-[2px]">
          {children.map((child) => (
            <li key={child.slug}>
              <Link
                href={child.href}
                className="flex items-center gap-[10px] rounded-[8px] px-[4px] py-[4px] font-sans text-[12.5px] leading-[1.3] text-ink-body hover:bg-brand-popup-bg hover:text-brand focus:outline-none focus-visible:bg-brand-popup-bg focus-visible:text-brand"
              >
                <span className="relative block h-[45px] w-[30px] shrink-0 overflow-hidden rounded-[5px] border border-cart-line">
                  <TileImage src={child.image} sizes="30px" />
                </span>
                <span className="min-w-0 flex-1 truncate">{child.name}</span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-[12px] shrink-0 opacity-60"
                  strokeWidth={2.5}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
