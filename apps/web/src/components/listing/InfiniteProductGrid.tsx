'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductCardData } from '@youmart/shared-client';
import { ProductCard } from '@/components/product/ProductCard';

/**
 * Infinite-scroll product grid: server-renders the first page, then appends more via a server
 * action as a sentinel near the bottom scrolls into view (IntersectionObserver, prefetch early).
 */
export function InfiniteProductGrid({
  initial,
  total,
  loadMore,
  gridClassName,
  priorityCount = 0,
}: {
  initial: ProductCardData[];
  total: number;
  /** Server action: returns the products for `page` (1-based; page 1 is already in `initial`). */
  loadMore: (page: number) => Promise<ProductCardData[]>;
  gridClassName: string;
  priorityCount?: number;
}) {
  const [products, setProducts] = useState(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.length >= total || initial.length === 0);
  const sentinel = useRef<HTMLDivElement>(null);

  const fetchNext = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    try {
      const next = await loadMore(page + 1);
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = next.filter((p) => !seen.has(p.id));
        const merged = [...prev, ...fresh];
        if (fresh.length === 0 || merged.length >= total) setDone(true);
        return merged;
      });
      setPage((p) => p + 1);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, page, loadMore, total]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNext();
      },
      { rootMargin: '700px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchNext, done]);

  return (
    <>
      <ul className={gridClassName}>
        {products.map((product, i) => (
          <li key={product.id} className="mb-[10px]">
            <ProductCard product={product} variant="listing" priority={i < priorityCount} />
          </li>
        ))}
      </ul>
      {!done ? (
        <div ref={sentinel} className="flex justify-center py-[26px]">
          <span
            aria-label="Loading more products"
            className="h-[28px] w-[28px] animate-spin rounded-full border-[3px] border-brand border-t-transparent"
          />
        </div>
      ) : null}
    </>
  );
}
