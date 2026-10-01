'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReviewForm, ReviewList, useProductReviews } from './ProductReviews';

interface ProductTabsProps {
  slug: string;
  description: string;
  /** Labelled attribute rows from the catalog (any category - no per-category layout). */
  specifications?: readonly { label: string; value: string }[];
  title: string;
}

// Live WooCommerce tabs: 1px blue rule above, 3px brand bar over the active tab.
export function ProductTabs({ slug, description, specifications = [], title }: ProductTabsProps) {
  const id = useId();
  const router = useRouter();
  const reviews = useProductReviews(slug);
  const [tab, setTab] = useState<'description' | 'reviews'>('description');
  const tabs = [
    { key: 'description' as const, label: 'Description' },
    { key: 'reviews' as const, label: `Reviews (${reviews.total})` },
  ];

  return (
    <div className="clear-both mb-[64px] pt-[32px]">
      <div
        role="tablist"
        aria-label="Product information"
        className="relative mb-[16px] flex flex-wrap before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-catalog-rule"
      >
        {tabs.map((item) => {
          const active = item.key === tab;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${id}-${item.key}-tab`}
              aria-selected={active}
              aria-controls={`${id}-${item.key}`}
              onClick={() => setTab(item.key)}
              className={`relative mr-[20.4px] py-[8px] font-ui text-[16px] font-bold leading-[25.6px] text-catalog-tab focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                active
                  ? "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-brand before:content-['']"
                  : ''
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${id}-description`}
        aria-labelledby={`${id}-description-tab`}
        hidden={tab !== 'description'}
      >
        <p className="font-ui text-[16px] leading-[25.6px] text-ink-body">{description}</p>
        {specifications.length > 0 && (
          // WooCommerce "Additional information" table look.
          <table className="mt-[24px] w-full max-w-[720px] border-collapse font-ui text-[15px] leading-[1.5] text-ink-body">
            <caption className="mb-[8px] text-left font-sans text-[16px] font-bold text-heading">
              Specifications
            </caption>
            <tbody>
              {specifications.map((row) => (
                <tr key={row.label} className="border-b border-catalog-rule">
                  <th scope="row" className="w-[40%] py-[8px] pr-[16px] text-left font-semibold">
                    {row.label}
                  </th>
                  <td className="py-[8px]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        role="tabpanel"
        id={`${id}-reviews`}
        aria-labelledby={`${id}-reviews-tab`}
        hidden={tab !== 'reviews'}
      >
        <ReviewList state={reviews} />
        <ReviewForm
          slug={slug}
          title={title}
          onSaved={() => {
            reviews.refresh();
            // The server-rendered star rating above reflects the new review.
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}
