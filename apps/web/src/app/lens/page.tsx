import type { Metadata } from 'next';
import { CategoryBar } from '@/components/category/CategoryBar';
import { LensView, type LensCategoryLink } from '@/components/search/LensView';
import { categoryBarMains, categoryTaxonomy } from '@/lib/category-taxonomy';

export const metadata: Metadata = { title: 'Search with a photo - You Mart' };

// YouMart Lens on the website: upload or drag in a product photo.
export default function LensPage() {
  // Resolved on the server so the ~45 KB taxonomy data never ships to the browser.
  async function resolveCategories(
    pairs: { main: string; sub: string | null }[],
  ): Promise<LensCategoryLink[]> {
    'use server';
    const out: LensCategoryLink[] = [];
    for (const { main, sub } of pairs.slice(0, 3)) {
      const m = categoryTaxonomy.find((x) => x.name.toLowerCase() === main.toLowerCase());
      if (!m) continue;
      const s = sub
        ? m.subcategories.find((x) => x.name.toLowerCase() === sub.toLowerCase())
        : null;
      out.push(
        s
          ? { name: s.name, trail: m.name, href: s.href }
          : { name: m.name, trail: '', href: m.href },
      );
    }
    return out;
  }

  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      <div className="mx-auto max-w-[1240px] px-[10px] py-[20px] lg:mb-[64px] lg:mt-[30px] lg:px-[20px]">
        <LensView resolveCategories={resolveCategories} />
      </div>
    </>
  );
}
