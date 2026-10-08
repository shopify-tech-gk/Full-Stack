import type { Metadata } from 'next';
import { CategoryBar } from '@/components/category/CategoryBar';
import { InfiniteProductGrid } from '@/components/listing/InfiniteProductGrid';
import { searchProductsPage } from '@/lib/catalog';
import { categoryBarMains } from '@/lib/category-taxonomy';

interface SearchPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function queryOf(searchParams: SearchPageProps['searchParams']): string {
  const raw = searchParams.q;
  return ((Array.isArray(raw) ? raw[0] : raw) ?? '').trim().slice(0, 100);
}

export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const q = queryOf(searchParams);
  return { title: q ? `Search results for “${q}” - You Mart` : 'Search - You Mart' };
}

// Header search target. Infinite-scrolls like the category listing.
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = queryOf(searchParams);
  const { products, total } = await searchProductsPage(q, 1);

  async function loadMore(page: number) {
    'use server';
    const res = await searchProductsPage(q, page);
    return res.products;
  }

  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      <div className="mx-auto max-w-[1240px] px-[10px] py-[20px] lg:mb-[64px] lg:mt-[44px] lg:px-[20px]">
        <h1 className="mb-[20px] font-ui text-[20px] font-semibold leading-[1.3] text-heading lg:text-[25px]">
          {q ? (
            <>
              Search results for: &ldquo;{q}&rdquo;{' '}
              <span className="font-sans text-[15px] font-normal text-ink-body">
                ({total} {total === 1 ? 'result' : 'results'})
              </span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        {products.length > 0 ? (
          <InfiniteProductGrid
            initial={products}
            total={total}
            loadMore={loadMore}
            gridClassName="grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-5"
            priorityCount={5}
          />
        ) : (
          <p className="my-[30px] font-ui text-[16px] text-ink-body">
            {q
              ? 'No products were found matching your selection.'
              : 'Type a product or brand name in the search bar above.'}
          </p>
        )}
      </div>
    </>
  );
}
