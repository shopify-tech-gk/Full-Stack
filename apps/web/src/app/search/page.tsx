import type { Metadata } from 'next';
import { CategoryBar } from '@/components/category/CategoryBar';
import { InfiniteProductGrid } from '@/components/listing/InfiniteProductGrid';
import { SearchFilters, SearchToolbar } from '@/components/search/SearchFilters';
import { searchProductsFiltered, type SearchFilterParams } from '@/lib/catalog';
import { categoryBarMains } from '@/lib/category-taxonomy';

interface SearchPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? '';

function queryOf(searchParams: SearchPageProps['searchParams']): string {
  return first(searchParams.q).slice(0, 100);
}

const SORTS = new Set(['price_asc', 'price_desc', 'newest']);
const num = (v: string) => (/^\d+(\.\d+)?$/.test(v) ? Number(v) : undefined);

/** The filters in the URL, as search-service takes them (unknown / bad values are dropped). */
function filtersOf(searchParams: SearchPageProps['searchParams']): SearchFilterParams {
  const f: SearchFilterParams = {};
  const brand = first(searchParams.brand).slice(0, 1000);
  const categories = first(searchParams.categories).slice(0, 1000);
  if (brand) f.brand = brand;
  if (categories) f.categories = categories;
  const minPrice = num(first(searchParams.minPrice));
  const maxPrice = num(first(searchParams.maxPrice));
  if (minPrice !== undefined) f.minPrice = minPrice;
  if (maxPrice !== undefined) f.maxPrice = maxPrice;
  const minRating = num(first(searchParams.minRating));
  if (minRating && minRating >= 1 && minRating <= 5) f.minRating = minRating;
  const minDiscount = num(first(searchParams.minDiscount));
  if (minDiscount && minDiscount >= 1 && minDiscount <= 99) f.minDiscount = Math.round(minDiscount);
  const sort = first(searchParams.sort);
  if (SORTS.has(sort)) f.sort = sort as SearchFilterParams['sort'];
  for (const [key, value] of Object.entries(searchParams)) {
    if (/^f_[a-z0-9_]{1,40}$/i.test(key)) {
      const v = first(value).slice(0, 500);
      if (v) f[key as `f_${string}`] = v;
    }
  }
  return f;
}

export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const q = queryOf(searchParams);
  return { title: q ? `Search results for “${q}” - You Mart` : 'Search - You Mart' };
}

// Header search target: a filter sidebar (price, rating, discount, brand, category, specs) and
// sorting beside the results, which infinite-scroll like the category listing.
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = queryOf(searchParams);
  const filters = filtersOf(searchParams);
  const { products, total, filters: groups, price } = await searchProductsFiltered(q, 1, filters);
  const filtered = Object.keys(filters).some((k) => k !== 'sort');

  async function loadMore(page: number) {
    'use server';
    const res = await searchProductsFiltered(q, page, filters);
    return res.products;
  }

  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      <div className="mx-auto max-w-[1440px] px-[10px] py-[20px] lg:mb-[64px] lg:mt-[28px] lg:px-[20px]">
        <h1 className="mb-[16px] font-ui text-[20px] font-semibold leading-[1.3] text-heading lg:text-[24px]">
          {q ? <>Search results for &ldquo;{q}&rdquo;</> : 'Search'}
        </h1>
        {q && (products.length > 0 || filtered) ? (
          <div className="lg:grid lg:grid-cols-[270px_1fr] lg:items-start lg:gap-[22px]">
            <div className="mb-[16px] lg:sticky lg:top-[90px] lg:mb-0 lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
              <SearchFilters groups={groups} price={price} />
            </div>
            <div className="min-w-0">
              <SearchToolbar total={total} q={q} />
              {products.length > 0 ? (
                <InfiniteProductGrid
                  key={JSON.stringify(filters)}
                  initial={products}
                  total={total}
                  loadMore={loadMore}
                  gridClassName="grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[16px] lg:grid-cols-4"
                  priorityCount={4}
                />
              ) : (
                <p className="my-[30px] rounded-[12px] border border-dashed border-catalog-rule bg-white p-[24px] text-center font-ui text-[15px] text-ink-body">
                  No products match these filters. Try removing one.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="my-[30px] font-ui text-[16px] text-ink-body">
            {q ? (
              <>
                No products were found for &ldquo;{q}&rdquo;.{' '}
                <a href="/youfind" className="font-semibold text-brand hover:underline">
                  Ask YouFind Bot
                </a>{' '}
                - it can request a restock for you.
              </>
            ) : (
              'Type a product or brand name in the search bar above.'
            )}
          </p>
        )}
      </div>
    </>
  );
}
