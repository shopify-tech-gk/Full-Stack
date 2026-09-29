import type { Metadata } from 'next';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { ProductCard } from '@/components/product/ProductCard';
import { searchProducts } from '@/lib/catalog';
import { storeCategories } from '@/lib/categories';

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

// Header search target. Layout follows the listing grid (live's results page is not measured).
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const q = queryOf(searchParams);
  const products = await searchProducts(q);

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      <div className="mx-auto max-w-[1240px] px-[10px] py-[20px] lg:mb-[64px] lg:mt-[44px] lg:px-[20px]">
        <h1 className="mb-[20px] font-ui text-[20px] font-semibold leading-[1.3] text-heading lg:text-[25px]">
          {q ? <>Search results for: &ldquo;{q}&rdquo;</> : 'Search'}
        </h1>
        {products.length > 0 ? (
          <ul className="grid grid-cols-2 gap-x-[10px] md:grid-cols-3 md:gap-x-[20px] lg:grid-cols-5">
            {products.map((product, index) => (
              <li key={product.id} className="mb-[10px]">
                <ProductCard product={product} variant="listing" priority={index < 5} />
              </li>
            ))}
          </ul>
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
