'use client';

import { useCallback, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  LISTING_PRICE_FALLBACK_LIMIT,
  LISTING_RATING_OPTIONS,
  LISTING_SORT_OPTIONS,
  listingQueryString,
  selectedValues,
  withFilter,
  type CategoryFilter,
  type CategoryFilters,
  type ListingQuery,
  type ListingSort,
} from '@youmart/shared-client';
import { useModal } from '@/lib/useModal';

interface FilterDrawerProps {
  basePath: string;
  query: ListingQuery;
  /** The category's filter definition + facets from the API; null = universal filters only. */
  filters: CategoryFilters | null;
}

const inr = new Intl.NumberFormat('en-IN');
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

const CARD =
  'mb-[8px] rounded-[12px] bg-white px-[15px] py-[10px] min-[769px]:mb-[15px] min-[769px]:px-[20px] min-[769px]:pb-[18px] min-[769px]:pt-[14px]';
const CARD_TITLE = 'font-sans text-[15px] font-bold leading-[25.6px] text-black';
const OPTION =
  'flex cursor-pointer items-center gap-[8px] py-[3px] font-sans text-[14px] leading-[1.4] text-filter-text';

/** Only filters with something to choose are shown (a range needs two distinct bounds). */
function hasChoices(filter: CategoryFilter): boolean {
  if (filter.type === 'range') {
    return filter.min != null && filter.max != null && filter.max > filter.min;
  }
  return (filter.values?.length ?? 0) > 0;
}

// Live filter: right-hand 340px panel >768px, bottom sheet <=768px; applies via the URL like live's
// GET form, resetting to page 1. The sections below sort/price come from the CATEGORY'S DATA
// (its filter definition + facet counts) - the same component renders any category.
export function FilterDrawer({ basePath, query, filters }: FilterDrawerProps) {
  const router = useRouter();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<ListingSort>(query.sort);
  const [rating, setRating] = useState(query.minRating);
  const [selection, setSelection] = useState<Record<string, string>>(query.filters);
  const priceLimit = filters?.price ? Math.max(1, filters.price.max) : LISTING_PRICE_FALLBACK_LIMIT;
  const [price, setPrice] = useState<[number, number]>([
    query.minPrice ?? 0,
    Math.min(query.maxPrice ?? priceLimit, priceLimit),
  ]);
  const close = useCallback(() => setOpen(false), []);
  useModal(open, close, closeRef);

  const shown = (filters?.filters ?? []).filter(hasChoices);
  const activeCount =
    Object.keys(query.filters).length +
    (query.minPrice !== null || query.maxPrice !== null ? 1 : 0);

  const apply = (event: FormEvent) => {
    event.preventDefault();
    setOpen(false);
    router.push(
      `${basePath}${listingQueryString({
        sort,
        minRating: rating,
        minPrice: price[0] > 0 ? price[0] : null,
        maxPrice: price[1] < priceLimit ? price[1] : null,
        filters: selection,
      })}`,
    );
  };

  const toggle = (key: string, value: string, multiple: boolean) => {
    const current = selectedValues({ filters: selection }, key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : multiple
        ? [...current, value]
        : [value];
    setSelection((s) => withFilter(s, key, next.join(',') || null));
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
        <span className="text-[13px] leading-[1.1]">
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </span>
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

              <RangeSlider
                label="Price"
                min={0}
                max={priceLimit}
                step={1}
                value={price}
                onChange={setPrice}
                format={(v) => `\u20b9${inr.format(v)}`}
              />

              {shown.map((filter) => (
                <FilterSection
                  key={filter.key}
                  filter={filter}
                  selection={selection}
                  onToggle={toggle}
                  onRange={(key, [lo, hi]) =>
                    setSelection((s) =>
                      withFilter(
                        withFilter(s, `${key}_min`, lo > (filter.min ?? lo) ? String(lo) : null),
                        `${key}_max`,
                        hi < (filter.max ?? hi) ? String(hi) : null,
                      ),
                    )
                  }
                />
              ))}

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
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push(
                      `${basePath}${listingQueryString({ sort, minRating: 0, minPrice: null, maxPrice: null, filters: {} })}`,
                    );
                  }}
                  className="mt-[10px] w-full py-[6px] font-sans text-[14px] font-semibold text-filter-text underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Clear all filters
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function FilterSection({
  filter,
  selection,
  onToggle,
  onRange,
}: {
  filter: CategoryFilter;
  selection: Record<string, string>;
  onToggle: (key: string, value: string, multiple: boolean) => void;
  onRange: (key: string, value: [number, number]) => void;
}) {
  const id = useId();
  if (filter.type === 'range') {
    const min = filter.min ?? 0;
    const max = filter.max ?? min;
    const lo = Number(selection[`${filter.key}_min`] ?? min);
    const hi = Number(selection[`${filter.key}_max`] ?? max);
    const unit = filter.unit ? ` ${filter.unit}` : '';
    return (
      <RangeSlider
        label={filter.label}
        min={min}
        max={max}
        // Step fine enough to reach the real bounds (6.1-6.78 in needs 0.01; 20-76 pcs needs 1).
        step={max - min <= 5 ? 0.01 : max - min <= 50 ? 0.1 : 1}
        value={[Math.max(min, Math.min(lo, max)), Math.max(min, Math.min(hi, max))]}
        onChange={(value) => onRange(filter.key, value)}
        format={(v) => `${num.format(v)}${unit}`}
      />
    );
  }

  const chosen = selectedValues({ filters: selection }, filter.key);
  const values =
    filter.type === 'boolean'
      ? (filter.values ?? []).filter((v) => v.value === 'true')
      : (filter.values ?? []);
  if (values.length === 0) return null;
  const multiple = filter.type === 'multi_select';
  const unit = filter.unit ? ` ${filter.unit}` : '';

  return (
    <fieldset className={CARD}>
      <legend className={`${CARD_TITLE} float-left mb-[4px] w-full`}>{filter.label}</legend>
      <div className="clear-both max-h-[220px] overflow-y-auto">
        {values.map((option) => (
          <label key={option.value} className={OPTION}>
            <input
              type={multiple || filter.type === 'boolean' ? 'checkbox' : 'radio'}
              name={`${id}-${filter.key}`}
              checked={chosen.includes(option.value)}
              onChange={() => onToggle(filter.key, option.value, multiple)}
              onClick={(event) => {
                // Radios can't be unchecked natively; a second click clears the single choice.
                if (!multiple && filter.type !== 'boolean' && chosen.includes(option.value)) {
                  event.preventDefault();
                  onToggle(filter.key, option.value, false);
                }
              }}
              className="size-[16px] accent-filter-thumb"
            />
            <span className="flex-1">
              {filter.type === 'boolean' ? 'Yes' : `${option.value}${unit}`}
            </span>
            <span className="text-[12px] text-ink-muted">({option.count})</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RangeSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  format: (value: number) => string;
}) {
  const id = useId();
  const span = max - min || 1;
  const [lo, hi] = value;
  const round = (v: number) => Number(v.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0));
  const emit = (next: [number, number]) => onChange([round(next[0]), round(next[1])]);
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="mb-[8px] rounded-[12px] bg-white px-[15px] min-[769px]:mb-[15px] min-[769px]:px-[20px] min-[769px]:pb-[22px] min-[769px]:pt-[18px]"
    >
      <div className="flex items-center justify-between gap-[10px] whitespace-nowrap font-sans leading-[25.6px]">
        <span id={`${id}-label`} className="text-[15px] font-bold text-black">
          {label}
        </span>
        <span className="mb-[1px] text-[14px] text-filter-text min-[769px]:mb-[20px]">
          {format(lo)} &ndash; {format(hi)}
        </span>
      </div>
      <div className="relative flex h-[20px] items-center min-[769px]:h-[30px]">
        <span className="pointer-events-none absolute inset-x-0 h-[4px] rounded-[4px] bg-filter-track" />
        <span
          className="pointer-events-none absolute h-[4px] rounded-[4px] bg-filter-thumb"
          style={{
            left: `${((lo - min) / span) * 100}%`,
            right: `${100 - ((hi - min) / span) * 100}%`,
          }}
        />
        <input
          type="range"
          aria-label={`Minimum ${label.toLowerCase()}`}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(event) => emit([Math.min(Number(event.target.value), hi), hi])}
          className="dual-range"
        />
        <input
          type="range"
          aria-label={`Maximum ${label.toLowerCase()}`}
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(event) => emit([lo, Math.max(Number(event.target.value), lo)])}
          className="dual-range"
        />
      </div>
    </div>
  );
}
