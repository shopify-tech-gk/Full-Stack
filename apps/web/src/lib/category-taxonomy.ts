import {
  buildCategoryTaxonomy,
  type TaxonomyMain,
  type TaxonomyNode,
} from '@youmart/shared-client';
import { CATEGORY_TAXONOMY_SOURCE } from '@youmart/shared-client/src/category-taxonomy.data';
import { storeCategories } from './categories';

export const categoryTaxonomy: readonly TaxonomyMain[] = buildCategoryTaxonomy(
  CATEGORY_TAXONOMY_SOURCE,
  storeCategories,
);

/** What the desktop grid needs up front; sub-to-sub lists load on demand (taxonomyChildren). */
export interface ExploreSub extends TaxonomyNode {
  childCount: number;
  /** A sub whose only item is itself links straight to its page instead of revealing a list. */
  direct: boolean;
}
export interface ExploreMain extends Omit<TaxonomyMain, 'subcategories'> {
  subcategories: ExploreSub[];
}

export function exploreCategories(): ExploreMain[] {
  return categoryTaxonomy.map(({ subcategories, ...main }) => ({
    ...main,
    subcategories: subcategories.map(({ children, ...sub }) => ({
      ...sub,
      childCount: children.length,
      direct: children.length === 0 || (children.length === 1 && children[0]!.name === sub.name),
    })),
  }));
}

export function taxonomyChildren(mainSlug: string, subSlug: string): TaxonomyNode[] {
  const main = categoryTaxonomy.find((m) => m.slug === mainSlug);
  return main?.subcategories.find((s) => s.slug === subSlug)?.children ?? [];
}
