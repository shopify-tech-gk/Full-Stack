'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Compass,
  History,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  PRODUCT_RAIL_SLIDER_SIZE,
  railDiscountBadge,
  railProducts,
  type PersonalRailKey,
  type ProductCardData,
  type ProductRailKey,
  type ProductRailSlider,
} from '@youmart/shared-client';
import { usePersonalRails } from '@/lib/recently-viewed';
import { RailSlide } from './RailSlide';

type RailTab = Pick<
  ProductRailSlider,
  'key' | 'heading' | 'badge' | 'discountBadge' | 'viewAllHref' | 'source'
>;

const ICONS: Record<ProductRailKey, LucideIcon> = {
  'left-off': History,
  trending: TrendingUp,
  'top-deals': BadgePercent,
  recommended: Sparkles,
  explore: Compass,
};

const ROUND_ARROW =
  'flex size-[38px] items-center justify-center rounded-full border border-card-border bg-white text-brand shadow-carousel-arrow transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-brand';

/** Tabbed heading (WAI-ARIA tabs) over one contained horizontal slider per rail. */
export function RailTabs({
  tabs: serverTabs,
  panels: serverPanels,
  personalFallback,
}: {
  tabs: readonly RailTab[];
  panels: readonly ReactNode[];
  /** Personal rails' heading-matched products, to top up the shopper's own. */
  personalFallback: Partial<Record<string, ProductCardData[]>>;
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ left: false, right: false });
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollers = useRef<(HTMLUListElement | null)[]>([]);
  const personal = usePersonalRails();

  // A personal rail with the shopper's own products is re-rendered here; the rest stay as served.
  const tabs: RailTab[] = [];
  const panels: ReactNode[] = [];
  serverTabs.forEach((tab, index) => {
    const fallback = personalFallback[tab.key];
    const mine = fallback ? (personal?.[tab.key as PersonalRailKey] ?? null) : null;
    if (!fallback || !mine) {
      tabs.push(tab);
      panels.push(serverPanels[index]);
      return;
    }
    const { products, source } = railProducts(fallback, mine, PRODUCT_RAIL_SLIDER_SIZE);
    tabs.push({ ...tab, source, badge: tab.discountBadge ? railDiscountBadge(products) : null });
    panels.push(products.map((product) => <RailSlide key={product.id} product={product} />));
  });
  const current = tabs[active];

  const measure = useCallback(() => {
    const el = scrollers.current[active];
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [active]);

  useEffect(() => {
    measure();
    const el = scrollers.current[active];
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, active]);

  const select = (next: number, focus = false) => {
    const index = (next + tabs.length) % tabs.length;
    setActive(index);
    if (focus) tabRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const targets: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target, true);
  };

  const scroll = (direction: 1 | -1) => {
    const el = scrollers.current[active];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollBy({ left: direction * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  };

  if (!current) return null;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="hidden px-[12px] pb-[6px] pt-[18px] lg:block"
    >
      <div className="mx-auto max-w-[1440px] rounded-[22px] border border-brand-popup-border bg-white px-[18px] pb-[12px] pt-[16px] shadow-cart-table">
        <h2 id={`${id}-title`} className="sr-only">
          Picked for you
        </h2>
        <div className="flex items-center gap-[14px]">
          <div
            role="tablist"
            aria-label="Product picks"
            onKeyDown={onKeyDown}
            className="flex min-w-0 flex-1 gap-[4px] overflow-x-auto rounded-full bg-brand-popup-bg p-[5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((tab, index) => {
              const Icon = ICONS[tab.key];
              const selected = index === active;
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`${id}-panel-${index}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(index)}
                  className={`flex h-[40px] shrink-0 items-center gap-[8px] whitespace-nowrap rounded-full px-[14px] font-ui text-[13.5px] font-semibold transition-[background-color,color,box-shadow] duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 motion-reduce:transition-none ${
                    selected
                      ? 'bg-brand text-white shadow-brand-button'
                      : 'text-heading hover:bg-white hover:text-brand'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-[16px] shrink-0" strokeWidth={2.25} />
                  {tab.heading}
                  {tab.badge && (
                    <span
                      className={`rounded-full px-[8px] py-[2px] text-[11px] font-bold leading-[1.4] ${
                        selected
                          ? 'bg-white text-brand'
                          : 'bg-white text-price-discount ring-1 ring-cart-line'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Link
            href={current.viewAllHref}
            aria-label={`View all - ${current.heading}`}
            className="inline-flex h-[38px] shrink-0 items-center gap-[6px] rounded-full px-[12px] font-ui text-[13.5px] font-semibold text-brand transition-colors hover:bg-brand-popup-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            View all
            <ArrowRight aria-hidden="true" className="size-[15px]" strokeWidth={2.5} />
          </Link>
          <div className="flex shrink-0 items-center gap-[8px]">
            <button
              type="button"
              onClick={() => scroll(-1)}
              disabled={!edges.left}
              aria-label={`Scroll ${current.heading} left`}
              className={ROUND_ARROW}
            >
              <ChevronLeft aria-hidden="true" className="size-[19px]" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => scroll(1)}
              disabled={!edges.right}
              aria-label={`Scroll ${current.heading} right`}
              className={ROUND_ARROW}
            >
              <ChevronRight aria-hidden="true" className="size-[19px]" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {panels.map((panel, index) => {
          const tab = tabs[index]!;
          const shown = index === active;
          return (
            <div
              key={tab.key}
              role="tabpanel"
              id={`${id}-panel-${index}`}
              aria-labelledby={`${id}-tab-${index}`}
              data-source={tab.source}
              hidden={!shown}
              className="relative mt-[14px]"
            >
              <ul
                ref={(el) => {
                  scrollers.current[index] = el;
                }}
                onScroll={shown ? measure : undefined}
                aria-label={tab.heading}
                className="flex snap-x snap-mandatory gap-[14px] overflow-x-auto overscroll-x-contain scroll-smooth px-[2px] [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
              >
                {panel}
              </ul>
              {shown && edges.left && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 left-0 w-[36px] bg-gradient-to-r from-white to-transparent"
                />
              )}
              {shown && edges.right && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-[36px] bg-gradient-to-l from-white to-transparent"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
