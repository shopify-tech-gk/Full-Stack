import Image from 'next/image';
import Link from 'next/link';
import { categoryHref, categoryImagePath, type StoreCategory } from '@youmart/shared-client';

/**
 * Below 1025px only: the live category grid - 4 columns of 75px circles on mobile, 5 of 158px on
 * tablet. Desktop uses the redesign (ExploreCategories on the homepage, CategoryBar elsewhere); the
 * old desktop strip is kept in docs/backup/old-desktop-category-design/.
 */
export function CategoryMegaMenu({ categories }: { categories: readonly StoreCategory[] }) {
  return (
    <section aria-labelledby="shop-by-category">
      <h2 id="shop-by-category" className="sr-only">
        Shop by category
      </h2>

      <ul className="grid grid-cols-4 gap-y-[20px] md:grid-cols-5 lg:hidden">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={categoryHref(category.slug)}
              className="mx-auto flex w-[75px] flex-col items-center text-center md:w-[158px]"
            >
              <span className="relative block size-[75px] overflow-hidden rounded-full md:size-[158px]">
                <Image
                  src={categoryImagePath(category.slug)}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 158px, 75px"
                  className="object-cover"
                />
              </span>
              <span className="mt-[6px] font-sans text-[10px] font-bold leading-[13px] text-ink-body md:mt-[7px] md:text-[15px] md:leading-[23px]">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
