'use client';

import { useId, useState, type FormEvent } from 'react';
import Image from 'next/image';
import type { ProductReviewData } from '@youmart/shared-client';
import { StarRating } from './StarRating';

interface ProductTabsProps {
  description: string;
  /** Labelled attribute rows from the catalog (any category - no per-category layout). */
  specifications?: readonly { label: string; value: string }[];
  reviews: readonly ProductReviewData[];
  title: string;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

// Live WooCommerce tabs: 1px blue rule above, 3px brand bar over the active tab.
export function ProductTabs({
  description,
  specifications = [],
  reviews,
  title,
}: ProductTabsProps) {
  const id = useId();
  const [tab, setTab] = useState<'description' | 'reviews'>('description');
  const tabs = [
    { key: 'description' as const, label: 'Description' },
    { key: 'reviews' as const, label: `Reviews (${reviews.length})` },
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
        <ol>
          {reviews.map((review) => (
            <li key={review.id} className="mb-[32px] flex">
              <Image
                src="/placeholders/avatar.svg"
                alt=""
                width={58}
                height={58}
                unoptimized
                className="size-[57.6px] shrink-0 rounded-full"
              />
              <div className="ml-[20px] min-w-0 flex-1 rounded-[4px] border border-catalog-reviewBorder p-[15px]">
                <StarRating rating={review.rating} variant="woo" size={16} />
                <p className="mt-[16px] font-ui text-[19.2px] leading-[25.6px] text-catalog-reviewMeta">
                  <strong className="font-medium">{review.author} </strong>
                  {review.verified && <em>(verified owner)</em>}{' '}
                  <span aria-hidden="true">&ndash;</span>{' '}
                  <time dateTime={review.date} className="pl-[7px] text-[14px]">
                    {dateFormat.format(new Date(`${review.date}T00:00:00`))}
                  </time>
                </p>
                <p className="mt-[7.2px] font-sans text-[16px] leading-[25.6px] text-ink-body">
                  {review.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <ReviewForm title={title} />
      </div>
    </div>
  );
}

// DEMO: validates like live's form but doesn't submit anywhere yet.
function ReviewForm({ title }: { title: string }) {
  const id = useId();
  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSent(true);
  };

  const field =
    'w-full border border-catalog-rule bg-white p-[12px] font-ui text-[16px] leading-[18.4px] text-ink-input focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';
  const bigLabel = 'pr-[9.6px] font-sans text-[19.2px] font-medium leading-[25.6px] text-ink-body';

  return (
    <div className="rounded-[10px] border border-catalog-rule p-[26.72px]">
      <h3 className="font-sans text-[21.44px] font-medium leading-[1.4] text-ink-body">
        Add a review
      </h3>
      <form onSubmit={onSubmit} className="font-ui text-[16px] leading-[25.6px] text-ink-body">
        <p className="mb-[6px] mt-[2px]">
          Your email address will not be published. Required fields are marked *
        </p>
        <div
          role="radiogroup"
          aria-label={`Your rating for ${title}`}
          className="mb-[6px] flex items-center"
        >
          <span className={bigLabel}>Your rating *</span>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} of 5 stars`}
              onClick={() => setRating(value)}
              className={`px-[2px] text-[20px] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                value <= rating ? 'text-catalog-starFill' : 'text-[#cccccc]'
              }`}
            >
              &#9733;
            </button>
          ))}
        </div>
        <p className="mb-[6px] mt-[2px]">
          <label htmlFor={`${id}-comment`} className={`block ${bigLabel}`}>
            Your review *
          </label>
          <textarea
            id={`${id}-comment`}
            required
            rows={4}
            className={`${field} h-[90px] rounded-[10px]`}
          />
        </p>
        <div className="grid gap-x-[23px] md:grid-cols-2">
          <p className="mb-[16px] mt-[2px]">
            <label htmlFor={`${id}-author`} className="block">
              Name *
            </label>
            <input
              id={`${id}-author`}
              required
              autoComplete="name"
              className={`${field} h-[43.7px]`}
            />
          </p>
          <p className="mb-[16px] mt-[2px]">
            <label htmlFor={`${id}-email`} className="block">
              Email *
            </label>
            <input
              id={`${id}-email`}
              type="email"
              required
              autoComplete="email"
              className={`${field} h-[43.7px]`}
            />
          </p>
        </div>
        <p className="mb-[6px] mt-[2px] flex items-start gap-[3px]">
          <input id={`${id}-cookies`} type="checkbox" className="mt-[6px] size-[13px]" />
          <label htmlFor={`${id}-cookies`}>
            Save my name, email, and website in this browser for the next time I comment.
          </label>
        </p>
        <p className="mb-[6px] mt-[16px]">
          <button
            type="submit"
            className="h-[48px] rounded-[5px] bg-brand px-[34px] font-ui text-[14px] font-semibold uppercase leading-none text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Submit
          </button>
        </p>
        <p role="status" className="text-[14px]">
          {sent ? 'Thanks! (Demo - reviews are not saved yet.)' : ''}
        </p>
      </form>
    </div>
  );
}
