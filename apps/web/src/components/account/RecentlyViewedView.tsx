'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProductCardData } from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';
import { clearRecentlyViewed, loadRecentlyViewed } from '@/lib/recently-viewed';
import { useSession } from '@/lib/session';
import { Notice } from './Notice';
import { BODY_TEXT, TEXT_LINK } from './formStyles';

const GRID = 'grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px]';

/** Account > Recently viewed: the full browsing history as product cards, with Clear. */
export function RecentlyViewedView() {
  const session = useSession();
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (session.status === 'loading') return;
    let active = true;
    loadRecentlyViewed()
      .then((list) => active && setItems(list))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [session.status]);

  if (failed)
    return <Notice tone="error">We could not load your history. Please try again.</Notice>;
  if (!items) return <div aria-busy="true" className="min-h-[240px]" />;
  if (items.length === 0) {
    return (
      <p className={BODY_TEXT}>
        Products you look at will show up here.{' '}
        <Link href="/" className={TEXT_LINK}>
          Start shopping
        </Link>
      </p>
    );
  }

  return (
    <>
      <div className="mb-[14px] flex items-center justify-between">
        <p className="font-ui text-[14px] text-ink-muted">{items.length} products</p>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm('Clear your recently viewed products?')) return;
            void clearRecentlyViewed().then(() => setItems([]));
          }}
          className={TEXT_LINK}
        >
          Clear history
        </button>
      </div>
      <ul className={GRID}>
        {items.map((product) => (
          <li key={product.id} className="mb-[10px]">
            <ProductCard product={product} variant="listing" />
          </li>
        ))}
      </ul>
    </>
  );
}
