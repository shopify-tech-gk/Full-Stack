'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { ROUTES, type MyReviewListItem } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { skipImageOptimizer } from '@/lib/images';
import { Notice } from './Notice';
import { BODY_TEXT, TEXT_LINK } from './formStyles';

const STATUS: Record<MyReviewListItem['status'], string | null> = {
  PUBLISHED: null,
  PENDING: 'Under review',
  REJECTED: 'Not published',
};

/** My reviews: every review the customer has written, with a link to edit it on the product. */
export function MyReviewsView() {
  const [items, setItems] = useState<MyReviewListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.catalog
      .myReviews()
      .then((r) => setItems(r.items))
      .catch(() => setFailed(true));
  }, []);

  if (failed)
    return <Notice tone="error">We could not load your reviews. Please try again.</Notice>;
  if (!items) return <div aria-busy="true" className="min-h-[240px]" />;
  if (items.length === 0) {
    return (
      <p className={BODY_TEXT}>
        You haven&rsquo;t written any reviews yet. Once an order is delivered, rate it from{' '}
        <Link href={ROUTES.orders} className={TEXT_LINK}>
          your orders
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-[14px]">
      {items.map((review) => {
        const status = STATUS[review.status];
        const href = review.product ? `/product/${review.product.slug}#reviews` : null;
        return (
          <li
            key={review.id}
            className="rounded-[12px] border border-catalog-rule bg-white p-[16px] font-ui"
          >
            <div className="flex items-center gap-[12px]">
              {review.product?.imageUrl ? (
                <Image
                  src={review.product.imageUrl}
                  alt=""
                  width={48}
                  height={48}
                  unoptimized={skipImageOptimizer(review.product.imageUrl)}
                  className="size-[48px] rounded-[8px] border border-catalog-rule object-contain"
                />
              ) : null}
              <p className="min-w-0 flex-1 text-[14.5px] font-semibold text-heading">
                {review.product?.title ?? 'Product no longer available'}
              </p>
            </div>
            <div className="mt-[10px] flex items-center gap-[8px]">
              <span className="inline-flex items-center gap-[3px] rounded-[5px] bg-[#26a541] px-[6px] py-[1px] text-[12px] font-bold text-white">
                {review.rating}
                <Star aria-hidden="true" className="size-[11px] fill-white" />
              </span>
              {review.title ? (
                <span className="text-[14.5px] font-semibold text-heading">{review.title}</span>
              ) : null}
            </div>
            <p className="mt-[6px] whitespace-pre-line text-[14px] leading-[1.55] text-ink-body">
              {review.body}
            </p>
            <div className="mt-[8px] flex items-center justify-between text-[12.5px] text-ink-muted">
              <span>
                {new Date(review.updatedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {status ? ` · ${status}` : ''}
              </span>
              {href ? (
                <Link href={href} className={TEXT_LINK}>
                  Edit review
                </Link>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
