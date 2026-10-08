import { buildCategoryTaxonomy } from '@youmart/shared-client';
import {
  CATEGORY_IMAGE_PATHS,
  CATEGORY_TAXONOMY_SOURCE,
} from '@youmart/shared-client/src/category-taxonomy.data';

// The full static category taxonomy (same ~32 mains the desktop "Explore Categories" shows),
// alphabetical. The home category circles page through all of these.
export interface HomeCategory {
  slug: string;
  name: string;
  /** Taxonomy link: /category/<slug> for a catalog match, or /search?q=<name> otherwise. */
  href: string;
}

let cache: HomeCategory[] | null = null;

export function allCategories(): HomeCategory[] {
  if (!cache) {
    cache = buildCategoryTaxonomy(CATEGORY_TAXONOMY_SOURCE, CATEGORY_IMAGE_PATHS).map(
      ({ slug, name, href }) => ({ slug, name, href }),
    );
  }
  return cache;
}
