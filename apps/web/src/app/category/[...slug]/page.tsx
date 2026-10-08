import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryHref, listingQueryString, parseListingQuery } from '@youmart/shared-client';
import { CategoryBar } from '@/components/category/CategoryBar';
import {
  CategoryBreadcrumb,
  CategoryTaxonomySidebar,
} from '@/components/category/CategoryTaxonomySidebar';
import { BrandSlider } from '@/components/listing/BrandSlider';
import { CategorySidebar } from '@/components/listing/CategorySidebar';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { FilterDrawer } from '@/components/listing/FilterDrawer';
import { InfiniteProductGrid } from '@/components/listing/InfiniteProductGrid';
import { RelatedCategories } from '@/components/listing/RelatedCategories';
import { getCategoryListing, listMoreCategoryProducts, resolveCategoryPath } from '@/lib/catalog';
import { categoryBarMains, categoryContext } from '@/lib/category-taxonomy';

interface CategoryPageProps {
  params: { slug: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}

export function generateMetadata({ params }: CategoryPageProps): Metadata {
  const node = resolveCategoryPath(params.slug);
  return node ? { title: `Shop for ${node.name} | YouMart` } : {};
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const path = params.slug;
  const node = resolveCategoryPath(path);
  if (!node) {
    notFound();
  }
  const query = parseListingQuery(searchParams);
  const listing = await getCategoryListing(path, { ...query, page: 1 });
  const basePath = categoryHref(...path);
  // `brand` is the one conventional attribute key (IMPORT-SPEC.md) - shown as live's brand strip.
  const brandFilter = listing.filters?.filters.find((f) => f.key === 'brand' && f.type !== 'range');
  const context = categoryContext(path);
  const title = context?.trail[context.trail.length - 1]?.name ?? node.name;

  async function loadMore(page: number) {
    'use server';
    const res = await listMoreCategoryProducts(path, { ...query, page });
    return res.products;
  }

  return (
    <>
      <CategoryBar mains={categoryBarMains()} activeSlug={context?.main.slug} />
      <div className="mt-[10px] flex pr-[20px] lg:mx-auto lg:mt-[14px] lg:max-w-[1440px] lg:gap-[24px] lg:px-[12px]">
        {/* Below 1025px the live sidebar stays; desktop has the redesign's taxonomy sidebar. */}
        <div className="contents lg:hidden">
          <CategorySidebar category={node.root} activeSlug={path[1]} />
        </div>
        {context && <CategoryTaxonomySidebar main={context.main} currentHref={basePath} />}
        <div className="min-w-0 flex-1">
          <h1 className="sr-only lg:hidden">{node.name}</h1>
          {context && (
            <div className="mb-[12px] hidden rounded-[16px] border border-cart-line bg-white px-[18px] py-[14px] shadow-rail-card lg:block">
              <CategoryBreadcrumb trail={context.trail} />
              <div className="mt-[6px] flex items-baseline gap-[12px]">
                <h1 className="font-ui text-[26px] font-bold leading-[1.2] text-heading">
                  {title}
                </h1>
                <p className="font-sans text-[13px] text-ink-body">
                  {listing.total} product{listing.total === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )}
          <div className="lg:hidden">
            <CheckoutSteps current={node.name} />
          </div>
          <FilterDrawer
            key={listingQueryString(query)}
            basePath={basePath}
            query={query}
            filters={listing.filters}
          />
          {brandFilter && <BrandSlider filter={brandFilter} basePath={basePath} query={query} />}

          {listing.products.length > 0 ? (
            <div className="mt-[10px]">
              <InfiniteProductGrid
                initial={listing.products}
                total={listing.total}
                loadMore={loadMore}
                gridClassName="mb-[16px] grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-4"
                priorityCount={4}
              />
            </div>
          ) : (
            <p className="my-[30px] font-ui text-[16px] text-ink-body">
              No products were found matching your selection.
            </p>
          )}

          <RelatedCategories path={path} />
        </div>
      </div>
    </>
  );
}
