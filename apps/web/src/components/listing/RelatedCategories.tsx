import Link from 'next/link';
import { TileImage } from '@/components/category/TileImage';
import { relatedCategories } from '@/lib/category-taxonomy';

/** Sibling categories shown after the product grid so browsing keeps flowing (desktop). */
export function RelatedCategories({ path }: { path: readonly string[] }) {
  const items = relatedCategories(path).slice(0, 12);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="related-categories"
      className="mt-[28px] rounded-[16px] border border-brand-popup-border bg-brand-popup-bg p-[16px] lg:p-[20px]"
    >
      <h2
        id="related-categories"
        className="mb-[14px] flex items-center gap-[12px] font-ui text-[18px] font-bold text-heading lg:text-[24px]"
      >
        <span aria-hidden className="h-[4px] w-[30px] rounded-full bg-brand" />
        Related <span className="text-brand">categories</span>
      </h2>
      <ul className="flex gap-[14px] overflow-x-auto pb-[6px] [scrollbar-width:thin]">
        {items.map((c) => (
          <li key={c.href} className="shrink-0">
            <Link href={c.href} className="group block w-[118px]">
              <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-[12px] border border-cart-line bg-white transition-shadow group-hover:shadow-rail-card">
                <TileImage src={c.image} sizes="118px" />
              </span>
              <span className="mt-[6px] line-clamp-2 block font-ui text-[12.5px] font-medium leading-[1.25] text-ink-body group-hover:text-brand">
                {c.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
