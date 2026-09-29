'use client';

import { useCallback, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { listingQueryString, type ListingBrand, type ListingQuery } from '@youmart/shared-client';
import { useModal } from '@/lib/useModal';

interface BrandSliderProps {
  brands: readonly ListingBrand[];
  basePath: string;
  query: ListingQuery;
}

const VISIBLE = 5;

// Live "Shop by brand": first brands in a scrolling row + "View All" opening an All Brands popup.
export function BrandSlider({ brands, basePath, query }: BrandSliderProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useModal(open, close, closeRef);

  // Clicking the active brand clears the brand filter.
  const href = (slug: string) =>
    `${basePath}${listingQueryString({ ...query, brand: query.brand === slug ? null : slug })}`;

  const box = (brand: ListingBrand, popup: boolean) => {
    const active = query.brand === brand.slug;
    return (
      <Link
        key={brand.slug}
        href={href(brand.slug)}
        aria-current={active ? 'true' : undefined}
        aria-label={brand.name}
        onClick={popup ? close : undefined}
        className={`flex shrink-0 items-center justify-center border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
          popup
            ? `h-[60.4px] w-[93px] rounded-[8px] bg-white ${active ? 'border-brand' : 'border-brand-popup-border'}`
            : `mx-[4px] h-[60px] w-[90px] rounded-[6px] ${active ? 'border-brand' : 'border-transparent'}`
        }`}
      >
        <Image
          src={brand.logo}
          alt=""
          width={132}
          height={100}
          unoptimized={brand.logo.endsWith('.svg')}
          className="h-[50px] w-[66px] object-contain"
        />
      </Link>
    );
  };

  return (
    <>
      <h2 className="mb-[5px] mt-[15px] font-ui text-[14px] font-medium leading-[1.1] text-black">
        Shop by brand
      </h2>
      <div className="scrollbar-none flex overflow-x-auto">
        {brands.slice(0, VISIBLE).map((brand) => box(brand, false))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="mx-[4px] my-[10px] flex h-[40px] w-[68px] shrink-0 items-center justify-center rounded-[10px] text-center font-sans text-[10px] font-semibold uppercase leading-[11.5px] tracking-[0.8px] text-[#444444] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          View All
        </button>
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
                All Brands
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
