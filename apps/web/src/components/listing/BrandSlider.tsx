'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  listingQueryString,
  selectedValues,
  withFilter,
  type CategoryFilter,
  type ListingQuery,
} from '@youmart/shared-client';
import { useModal } from '@/lib/useModal';

interface BrandSliderProps {
  /** The category's `brand` filter (definition entry + facet counts). */
  filter: CategoryFilter;
  basePath: string;
  query: ListingQuery;
}

const VISIBLE = 5;

// Live "Shop by brand": first brands in a scrolling row + "View All" opening an All Brands popup.
// Brands are the category's real brand facet values; catalog data carries no logos, so the
// boxes show the brand name.
export function BrandSlider({ filter, basePath, query }: BrandSliderProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useModal(open, close, closeRef);
  const brands = filter.values ?? [];
  const chosen = selectedValues(query, filter.key);

  // Clicking a selected brand removes it; other selections are kept.
  const href = (value: string) => {
    const next = chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
    return `${basePath}${listingQueryString({
      ...query,
      filters: withFilter(query.filters, filter.key, next.join(',') || null),
    })}`;
  };

  const box = (brand: { value: string; count: number }, popup: boolean) => {
    const active = chosen.includes(brand.value);
    return (
      <Link
        key={brand.value}
        href={href(brand.value)}
        aria-current={active ? 'true' : undefined}
        aria-label={`${brand.value} (${brand.count})`}
        onClick={popup ? close : undefined}
        className={`flex shrink-0 items-center justify-center border-2 px-[6px] text-center font-sans text-[13px] font-bold leading-[1.15] text-heading focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          popup
            ? `h-[60.4px] w-[93px] rounded-[8px] bg-white ${active ? 'border-brand' : 'border-brand-popup-border'}`
            : `mx-[4px] h-[60px] w-[90px] rounded-[6px] bg-white ${active ? 'border-brand' : 'border-transparent'}`
        }`}
      >
        <span className="line-clamp-2">{brand.value}</span>
      </Link>
    );
  };

  if (brands.length === 0) return null;

  return (
    <>
      <h2 className="mb-[5px] mt-[15px] font-ui text-[14px] font-medium leading-[1.1] text-black">
        Shop by {filter.label.toLowerCase()}
      </h2>
      <div className="scrollbar-none flex overflow-x-auto">
        {brands.slice(0, VISIBLE).map((brand) => box(brand, false))}
        {brands.length > VISIBLE && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            className="mx-[4px] my-[10px] flex h-[40px] w-[68px] shrink-0 items-center justify-center rounded-[10px] text-center font-sans text-[10px] font-semibold uppercase leading-[11.5px] tracking-[0.8px] text-[#444444] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            View All
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-[16px]"
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="max-h-[85vh] w-full max-w-[576px] overflow-y-auto rounded-[14px] bg-brand-popup-bg p-[24px] shadow-brand-popup"
          >
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="font-sans text-[18px] font-bold text-brand-popup-title">
                All {filter.label}s
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-[5px] px-[6px] py-[4px] font-sans text-[30px] font-semibold leading-none text-brand-popup-title focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                &times;
              </button>
            </div>
            <div className="mt-[18.6px] flex flex-wrap gap-[10px]">
              {brands.map((brand) => box(brand, true))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
