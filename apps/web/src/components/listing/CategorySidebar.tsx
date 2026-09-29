import Image from 'next/image';
import Link from 'next/link';
import {
  SUBCATEGORY_PLACEHOLDER_IMAGE,
  categoryHref,
  type StoreCategory,
} from '@youmart/shared-client';

interface CategorySidebarProps {
  category: StoreCategory;
  activeSlug?: string;
}

// Live: sticky, viewport-tall scrollable column of 60x61 subcategory thumbs (310px incl. 60px
// gutter on desktop; a quarter of the row below 1025px, where it stays beside the grid).
export function CategorySidebar({ category, activeSlug }: CategorySidebarProps) {
  return (
    <aside
      aria-labelledby="sidebar-category"
      className="sticky top-0 max-h-screen w-1/4 shrink-0 self-start overflow-y-auto pb-[100px] lg:w-[310px] lg:pb-0 lg:pr-[60px] [&::-webkit-scrollbar]:w-[2px]"
    >
      <h2
        id="sidebar-category"
        className="mb-[18px] mt-[12px] text-center font-ui text-[18px] font-semibold leading-[1.3] text-black"
      >
        Category
      </h2>
      <ul>
        {category.subcategories.map((sub) => {
          const active = sub.slug === activeSlug;
          return (
            <li key={sub.slug} className="flex justify-center p-[10px]">
              <Link
                href={categoryHref(category.slug, sub.slug)}
                aria-current={active ? 'page' : undefined}
                className="block w-[60px] text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Image
                  src={SUBCATEGORY_PLACEHOLDER_IMAGE}
                  alt=""
                  width={60}
                  height={61}
                  className="h-[61px] w-[60px] rounded-[10px] object-cover"
                />
                <span
                  className={`mt-[8px] block font-ui text-[10px] leading-[12px] ${
                    active ? 'font-semibold text-brand' : 'text-catalog-muted'
                  }`}
                >
                  {sub.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
