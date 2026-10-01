'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ApiError,
  loginHref,
  productHref,
  type MyReview,
  type Review,
  type ReviewPage,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { StarRating } from './StarRating';

const PER_PAGE = 10;

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});

export interface ProductReviewsState {
  reviews: Review[];
  total: number;
  hasMore: boolean;
  failed: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/** GET /api/catalog/products/:slug/reviews (published reviews, newest first). */
export function useProductReviews(slug: string): ProductReviewsState {
  const [pages, setPages] = useState<ReviewPage[]>([]);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const load = useCallback(
    async (page: number) => {
      try {
        const result = await api.catalog.listReviews(slug, { page, limit: PER_PAGE });
        setPages((current) => (page === 1 ? [result] : [...current, result]));
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    [slug],
  );

  useEffect(() => {
    void load(1);
  }, [load, version]);

  const last = pages[pages.length - 1];
  const reviews = pages.flatMap((page) => page.items);
  return {
    reviews,
    total: last?.total ?? 0,
    hasMore: last ? reviews.length < last.total : false,
    failed,
    loadMore: () => last && void load(last.page + 1),
    refresh: () => setVersion((v) => v + 1),
  };
}

export function ReviewList({ state }: { state: ProductReviewsState }) {
  if (state.failed && state.reviews.length === 0) {
    return (
      <p className="mb-[32px] font-ui text-[16px] text-ink-body">
        We could not load the reviews.{' '}
        <button type="button" onClick={state.refresh} className="text-brand hover:underline">
          Try again
        </button>
      </p>
    );
  }
  if (state.reviews.length === 0) {
    return (
      <p className="mb-[32px] font-ui text-[16px] leading-[25.6px] text-ink-body">
        There are no reviews yet.
      </p>
    );
  }
  return (
    <>
      <ol>
        {state.reviews.map((review) => (
          <li key={review.id} className="mb-[32px] flex">
            <Image
              src="/placeholders/avatar.svg"
              alt=""
              width={58}
              height={58}
              unoptimized
              className="size-[40px] shrink-0 rounded-full md:size-[57.6px]"
            />
            <div className="ml-[12px] min-w-0 flex-1 rounded-[4px] border border-catalog-reviewBorder p-[15px] md:ml-[20px]">
              <StarRating rating={review.rating} variant="woo" size={16} />
              <p className="mt-[16px] font-ui text-[16px] leading-[25.6px] text-catalog-reviewMeta md:text-[19.2px]">
                <strong className="font-medium">{review.author} </strong>
                {review.verifiedPurchase && <em>(verified owner)</em>}{' '}
                <span aria-hidden="true">&ndash;</span>{' '}
                <time dateTime={review.createdAt} className="pl-[7px] text-[14px]">
                  {dateFormat.format(new Date(review.createdAt))}
                </time>
              </p>
              {review.title && (
                <p className="mt-[7.2px] font-sans text-[16px] font-bold leading-[25.6px] text-ink-body">
                  {review.title}
                </p>
              )}
              <p className="mt-[7.2px] whitespace-pre-line break-words font-sans text-[16px] leading-[25.6px] text-ink-body">
                {review.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {state.hasMore && (
        <p className="mb-[32px]">
          <button
            type="button"
            onClick={state.loadMore}
            className="font-ui text-[16px] font-semibold text-brand hover:underline"
          >
            Show more reviews
          </button>
        </p>
      )}
    </>
  );
}

const BOX = 'rounded-[10px] border border-catalog-rule p-[20px] md:p-[26.72px]';
const BOX_TITLE = 'font-sans text-[21.44px] font-medium leading-[1.4] text-ink-body';
const COPY = 'mt-[8px] font-ui text-[16px] leading-[25.6px] text-ink-body';

/**
 * "Add a review": signed-in customers who bought the product (POST .../reviews checks the purchase
 * server-side; one review per customer, re-submitting edits it).
 */
export function ReviewForm({
  slug,
  title,
  onSaved,
}: {
  slug: string;
  title: string;
  onSaved: () => void;
}) {
  const session = useSession();
  const [mine, setMine] = useState<MyReview | null>(null);
  const [failed, setFailed] = useState(false);
  const userId = session.status === 'authenticated' ? session.user.id : null;

  useEffect(() => {
    setMine(null);
    setFailed(false);
    if (!userId) return;
    let active = true;
    api.catalog
      .myReview(slug)
      .then((result) => active && setMine(result))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [slug, userId]);

  if (session.status === 'loading') return null;
  if (session.status === 'anonymous') {
    return (
      <div className={BOX}>
        <h3 className={BOX_TITLE}>Add a review</h3>
        <p className={COPY}>
          Please{' '}
          <Link href={loginHref(productHref(slug))} className="text-brand hover:underline">
            log in
          </Link>{' '}
          to review this product. Only customers who have bought it can leave a review.
        </p>
      </div>
    );
  }
  if (failed) {
    return (
      <div className={BOX}>
        <h3 className={BOX_TITLE}>Add a review</h3>
        <p className={COPY}>We could not check your purchase. Please refresh the page.</p>
      </div>
    );
  }
  if (!mine) return <div aria-busy="true" className="min-h-[120px]" />;
  if (!mine.canReview) {
    return (
      <div className={BOX}>
        <h3 className={BOX_TITLE}>Add a review</h3>
        <p className={COPY}>
          Only logged in customers who have purchased this product may leave a review.
        </p>
      </div>
    );
  }
  return (
    <ReviewEditor
      slug={slug}
      title={title}
      existing={mine.review}
      defaultName={session.user.name ?? ''}
      onSaved={(review) => {
        setMine({ canReview: true, review });
        onSaved();
      }}
    />
  );
}

function ReviewEditor({
  slug,
  title,
  existing,
  defaultName,
  onSaved,
}: {
  slug: string;
  title: string;
  existing: Review | null;
  defaultName: string;
  onSaved: (review: Review) => void;
}) {
  const id = useId();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [heading, setHeading] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [name, setName] = useState(existing?.author ?? defaultName);
  const [errors, setErrors] = useState<Partial<Record<'rating' | 'body' | 'name', string>>>({});
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (rating < 1) found.rating = 'Please select a rating.';
    if (body.trim().length < 10) found.body = 'Please write at least 10 characters.';
    if (name.trim().length > 60) found.name = 'Please keep your name under 60 characters.';
    setErrors(found);
    setStatus(null);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      const saved = await api.catalog.submitReview(slug, {
        rating,
        body: body.trim(),
        ...(heading.trim() ? { title: heading.trim() } : {}),
        ...(name.trim() ? { authorName: name.trim() } : {}),
      });
      setStatus({
        ok: true,
        text: existing
          ? 'Your review has been updated.'
          : 'Thank you! Your review has been published.',
      });
      onSaved(saved);
    } catch (error) {
      setStatus({
        ok: false,
        text:
          error instanceof ApiError && [400, 403, 409, 429].includes(error.status)
            ? error.message
            : 'We could not save your review. Please try again.',
      });
    } finally {
      setPending(false);
    }
  };

  const field =
    'w-full border border-catalog-rule bg-white p-[12px] font-ui text-[16px] leading-[18.4px] text-ink-input focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';
  const bigLabel = 'pr-[9.6px] font-sans text-[19.2px] font-medium leading-[25.6px] text-ink-body';
  const error = 'mt-[4px] block font-ui text-[13px] leading-[1.4] text-woo-error';

  return (
    <div className={BOX}>
      <h3 className={BOX_TITLE}>{existing ? 'Edit your review' : 'Add a review'}</h3>
      <form
        onSubmit={onSubmit}
        noValidate
        className="font-ui text-[16px] leading-[25.6px] text-ink-body"
      >
        <p className="mb-[6px] mt-[2px]">Required fields are marked *</p>
        <div className="mb-[6px]">
          <div
            role="radiogroup"
            aria-label={`Your rating for ${title}`}
            aria-describedby={errors.rating ? `${id}-rating-error` : undefined}
            className="flex flex-wrap items-center"
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
                className={`px-[2px] text-[24px] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  value <= rating ? 'text-catalog-starFill' : 'text-[#cccccc]'
                }`}
              >
                &#9733;
              </button>
            ))}
          </div>
          {errors.rating && (
            <span id={`${id}-rating-error`} className={error}>
              {errors.rating}
            </span>
          )}
        </div>
        <p className="mb-[6px] mt-[2px]">
          <label htmlFor={`${id}-title`} className={`block ${bigLabel}`}>
            Title <span className="text-[16px] font-normal">(optional)</span>
          </label>
          <input
            id={`${id}-title`}
            value={heading}
            maxLength={120}
            onChange={(e) => setHeading(e.target.value)}
            className={`${field} h-[43.7px] rounded-[10px]`}
          />
        </p>
        <p className="mb-[6px] mt-[2px]">
          <label htmlFor={`${id}-comment`} className={`block ${bigLabel}`}>
            Your review *
          </label>
          <textarea
            id={`${id}-comment`}
            rows={4}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-invalid={Boolean(errors.body)}
            aria-describedby={errors.body ? `${id}-comment-error` : undefined}
            className={`${field} min-h-[90px] rounded-[10px]`}
          />
          {errors.body && (
            <span id={`${id}-comment-error`} className={error}>
              {errors.body}
            </span>
          )}
        </p>
        <p className="mb-[16px] mt-[2px] md:max-w-[50%]">
          <label htmlFor={`${id}-author`} className="block">
            Name shown with your review
          </label>
          <input
            id={`${id}-author`}
            autoComplete="name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${id}-author-error` : undefined}
            className={`${field} h-[43.7px]`}
          />
          {errors.name && (
            <span id={`${id}-author-error`} className={error}>
              {errors.name}
            </span>
          )}
        </p>
        <p className="mb-[6px] mt-[16px]">
          <button
            type="submit"
            disabled={pending}
            className="h-[48px] rounded-[5px] bg-brand px-[34px] font-ui text-[14px] font-semibold uppercase leading-none text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
          >
            {pending ? 'Submitting\u2026' : existing ? 'Update review' : 'Submit'}
          </button>
        </p>
        <p
          role="status"
          className={`text-[14px] ${status && !status.ok ? 'text-woo-error' : 'text-woo-success'}`}
        >
          {status?.text ?? ''}
        </p>
      </form>
    </div>
  );
}
