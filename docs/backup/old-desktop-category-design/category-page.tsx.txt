import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoryHref, listingQueryString, parseListingQuery } from '@youmart/shared-client';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { BrandSlider } from '@/components/listing/BrandSlider';
import { CategorySidebar } from '@/components/listing/CategorySidebar';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { FilterDrawer } from '@/components/listing/FilterDrawer';
import { Pagination } from '@/components/listing/Pagination';
import { ProductCard } from '@/components/product/ProductCard';
import { getCategoryListing, resolveCategoryPath } from '@/lib/catalog';
import { storeCategories } from '@/lib/categories';

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
  const listing = await getCategoryListing(path, query);
  if (query.page > listing.totalPages) {
    notFound();
  }
  const basePath = categoryHref(...path);
  // `brand` is the one conventional attribute key (IMPORT-SPEC.md) - shown as live's brand strip.
  const brandFilter = listing.filters?.filters.find((f) => f.key === 'brand' && f.type !== 'range');

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      <div className="mt-[10px] flex pr-[20px] lg:mx-auto lg:mt-0 lg:max-w-[1260px]">
        <CategorySidebar category={node.root} activeSlug={path[1]} />
        <div className="min-w-0 flex-1 lg:border-l lg:border-catalog-rule lg:pl-[60px]">
          <h1 className="sr-only">{node.name}</h1>
          <CheckoutSteps current={node.name} />
          <FilterDrawer
            key={listingQueryString(query)}
            basePath={basePath}
            query={query}
            filters={listing.filters}
          />
          {brandFilter && <BrandSlider filter={brandFilter} basePath={basePath} query={query} />}

          {listing.products.length > 0 ? (
            <ul className="mb-[16px] mt-[10px] grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-4">
              {listing.products.map((product, index) => (
                <li key={product.id} className="mb-[10px]">
                  <ProductCard product={product} variant="listing" priority={index < 4} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="my-[30px] font-ui text-[16px] text-ink-body">
              No products were found matching your selection.
            </p>
          )}

          <Pagination
            current={query.page}
            totalPages={listing.totalPages}
            basePath={basePath}
            query={listingQueryString(query)}
          />
        </div>
      </div>
    </>
  );
}
