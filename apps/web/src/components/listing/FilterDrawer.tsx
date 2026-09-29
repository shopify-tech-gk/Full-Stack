'use client';

import { useCallback, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  LISTING_PRICE_LIMIT,
  LISTING_RATING_OPTIONS,
  LISTING_SORT_OPTIONS,
  listingQueryString,
  type ListingQuery,
  type ListingSort,
} from '@youmart/shared-client';
import { useModal } from '@/lib/useModal';

interface FilterDrawerProps {
  basePath: string;
  query: ListingQuery;
}

const inr = new Intl.NumberFormat('en-IN');

// Live filter: right-hand 340px panel >768px, bottom sheet <=768px; applies via the URL
// (orderby/min_price/max_price/rating_filter) like live's GET form, resetting to page 1.
export function FilterDrawer({ basePath, query }: FilterDrawerProps) {
  const router = useRouter();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<ListingSort>(query.sort);
  const [min, setMin] = useState(query.minPrice);
  const [max, setMax] = useState(query.maxPrice);
  const [rating, setRating] = useState(query.minRating);
  const close = useCallback(() => setOpen(false), []);
  useModal(open, close, closeRef);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setOpen(false);
    router.push(
      `${basePath}${listingQueryString({ ...query, sort, minPrice: min, maxPrice: max, minRating: rating })}`,
    );
  };

  const select =
    'mb-[8px] h-[34px] w-full rounded-[8px] bg-white px-[14px] font-sans text-[16px] font-semibold text-ink-input focus:outline-none focus-visible:ring-2 focus-visible:ring-brand min-[769px]:mb-[14px] min-[769px]:h-[48px]';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center font-sans text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <svg
          viewBox="0 0 512 512"
          aria-hidden="true"
          className="mr-[10px] size-[24px]"
          fill="currentColor"
        >
          <path d="M488.3 36.5H23.7C10.6 36.5 0 47.1 0 60.2v30.4c0 8.1 4.1 15.5 10.9 19.8l173.1 110.4v194.2c0 6.6 3.1 12.8 8.4 16.7l96.1 70.4c10.3 7.5 24.9.2 24.9-12.5V220.7l187.7-111.3c6.7-4 10.9-11.2 10.9-19.1V60.2c0-13.1-10.6-23.7-23.7-23.7zm-215.1 169.1c-4.1 2.4-6.6 6.9-6.6 11.7v200.7l-64-46.9V217.3c0-4.8-2.5-9.2-6.5-11.7L54.1 98.2h400.3l-181.2 107.4z" />
          <rect x="340" y="280" width="140" height="30" rx="15" />
          <rect x="340" y="350" width="140" height="30" rx="15" />
          <rect x="340" y="420" width="140" height="30" rx="15" />
        </svg>
        <span className="text-[13px] leading-[1.1]">Filters</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/45"
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-[20px] bg-filter-panel px-[16px] pb-[4px] pt-[8px] min-[769px]:inset-y-0 min-[769px]:left-auto min-[769px]:max-h-none min-[769px]:w-[340px] min-[769px]:rounded-none min-[769px]:p-[20px]"
          >
            {/* Live: white header text on #6ec1e4 (~2:1); dark text is the flagged fix. */}
            <div className="mb-[12px] flex items-center justify-between font-sans text-[20px] font-bold leading-[25.6px] text-heading min-[769px]:mb-[16px] min-[769px]:text-[16px]">
              <h2 id={titleId}>Filters</h2>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close filters"
                className="rounded-[5px] text-[18px] font-semibold leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                &#x2715;
              </button>
            </div>

            <form onSubmit={apply}>
              <select
                aria-label="Sort products"
                value={sort}
                onChange={(event) => setSort(event.target.value as ListingSort)}
                className={select}
              >
                {LISTING_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div
                role="group"
                aria-labelledby={`${titleId}-price`}
                className="mb-[8px] rounded-[12px] bg-white px-[15px] min-[769px]:mb-[15px] min-[769px]:px-[20px] min-[769px]:pb-[22px] min-[769px]:pt-[18px]"
              >
                <div className="flex items-center justify-between gap-[10px] whitespace-nowrap font-sans leading-[25.6px]">
                  <span id={`${titleId}-price`} className="text-[15px] font-bold text-black">
                    Price
                  </span>
                  <span className="mb-[1px] text-[14px] text-filter-text min-[769px]:mb-[20px]">
                    &#8377;{inr.format(min)} &ndash; &#8377;{inr.format(max)}
                  </span>
                </div>
                <div className="relative flex h-[20px] items-center min-[769px]:h-[30px]">
                  <span className="pointer-events-none absolute inset-x-0 h-[4px] rounded-[4px] bg-filter-track" />
                  <span
                    className="pointer-events-none absolute h-[4px] rounded-[4px] bg-filter-thumb"
                    style={{
                      left: `${(min / LISTING_PRICE_LIMIT) * 100}%`,
                      right: `${100 - (max / LISTING_PRICE_LIMIT) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    aria-label="Minimum price"
                    min={0}
                    max={LISTING_PRICE_LIMIT}
                    value={min}
                    onChange={(event) => setMin(Math.min(Number(event.target.value), max))}
                    className="dual-range"
                  />
                  <input
                    type="range"
                    aria-label="Maximum price"
                    min={0}
                    max={LISTING_PRICE_LIMIT}
                    value={max}
                    onChange={(event) => setMax(Math.max(Number(event.target.value), min))}
                    className="dual-range"
                  />
                </div>
              </div>

              <select
                aria-label="Filter by rating"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className={select}
              >
                {LISTING_RATING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="h-[46px] w-full rounded-[10px] bg-filter-apply font-sans text-[16px] font-bold text-white hover:bg-filter-applyHover focus:outline-none focus-visible:ring-2 focus-visible:ring-white min-[769px]:h-[50px] min-[769px]:text-[18px]"
              >
                Apply Filters
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
