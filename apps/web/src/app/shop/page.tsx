import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ROUTES, listingQueryString, parseListingQuery } from '@youmart/shared-client';
import { CategoryBar } from '@/components/category/CategoryBar';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { FilterDrawer } from '@/components/listing/FilterDrawer';
import { Pagination } from '@/components/listing/Pagination';
import { ProductCard } from '@/components/product/ProductCard';
import { getCategoryListing } from '@/lib/catalog';
import { categoryBarMains } from '@/lib/category-taxonomy';

export const metadata: Metadata = { title: 'Products Archive - You Mart' };

interface ShopPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

// All-products listing: the category listing template without the category sidebar.
export default async function ShopPage({ searchParams }: ShopPageProps) {
  const query = parseListingQuery(searchParams);
  const listing = await getCategoryListing([], query);
  if (query.page > listing.totalPages) notFound();

  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      <div className="mx-auto mt-[10px] max-w-[1240px] px-[10px] lg:mt-0 lg:px-[20px]">
        <h1 className="sr-only">Shop</h1>
        <CheckoutSteps current="Shop" />
        <FilterDrawer
          key={listingQueryString(query)}
          basePath={ROUTES.shop}
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
          basePath={ROUTES.shop}
          query={listingQueryString(query)}
        />
      </div>
    </>
  );
}
