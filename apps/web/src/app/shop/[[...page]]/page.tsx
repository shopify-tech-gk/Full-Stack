import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listingQueryString, parseListingQuery } from '@youmart/shared-client';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { FilterDrawer } from '@/components/listing/FilterDrawer';
import { Pagination } from '@/components/listing/Pagination';
import { ProductCard } from '@/components/product/ProductCard';
import { getCategoryListing } from '@/lib/catalog';
import { storeCategories } from '@/lib/categories';

export const metadata: Metadata = { title: 'Products Archive - You Mart' };

interface ShopPageProps {
  params: { page?: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}

/** `/shop` and `/shop/page/<n>` (live's pagination scheme). */
function pageNumber(segments: readonly string[] | undefined): number | null {
  if (!segments || segments.length === 0) return 1;
  if (segments.length !== 2 || segments[0] !== 'page') return null;
  const page = Number(segments[1]);
  return Number.isInteger(page) && page >= 1 ? page : null;
}

// All-products listing: the category listing template without the category sidebar.
export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const page = pageNumber(params.page);
  if (page === null) notFound();
  const query = parseListingQuery(searchParams, page);
  const listing = await getCategoryListing([], query);
  if (query.page > listing.totalPages) notFound();

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      <div className="mx-auto mt-[10px] max-w-[1240px] px-[10px] lg:mt-0 lg:px-[20px]">
        <h1 className="sr-only">Shop</h1>
        <CheckoutSteps current="Shop" />
        <FilterDrawer
          key={listingQueryString(query)}
          basePath="/shop"
          query={query}
          filters={listing.filters}
        />
        <ul className="mb-[16px] mt-[10px] grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-5">
          {listing.products.map((product, index) => (
            <li key={product.id} className="mb-[10px]">
              <ProductCard product={product} variant="listing" priority={index < 5} />
            </li>
          ))}
        </ul>
        <Pagination
          current={query.page}
          totalPages={listing.totalPages}
          basePath="/shop"
          query={listingQueryString(query)}
        />
      </div>
    </>
  );
}
