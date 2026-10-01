// The client's category taxonomy (Main -> Sub -> Sub-to-Sub): homepage DISPLAY data for the desktop
// "Explore Categories" section, shared with mobile. The data lives in
// data/category-taxonomy.csv -> category-taxonomy.data.ts (pnpm build:category-taxonomy), so a
// corrected sheet is a data swap with no UI change. It is a best-effort realignment of the client's
// sheet pending their confirmation - see docs/catalog/taxonomy-realign-report.md.
// The ~45 KB data module is NOT re-exported from the package index (it would land in every client
// bundle): import CATEGORY_TAXONOMY_SOURCE from '@youmart/shared-client/src/category-taxonomy.data'.
//
// Linking: the taxonomy differs from the catalog tree, so every node is matched by name to the
// storefront category tree (the one /category/... pages resolve). No match -> nearest matched
// ancestor's page ('parent'); a main with no catalog match -> /search?q=<name> ('search').
import { STORE_CATEGORIES, categoryHref, slugify, type StoreCategory } from './categories';
import { ROUTES } from './routes';

export type CategoryTaxonomySource = ReadonlyArray<
  readonly [main: string, subs: ReadonlyArray<readonly [sub: string, items: readonly string[]]>]
>;

/**
 * Main-category artwork. `desktop` is the landscape banner used by the desktop grid; `mobile` is
 * the slot for a separate portrait image (filled in the mobile phase). null = use the placeholder.
 */
export interface CategoryImageSet {
  desktop: string | null;
  mobile: string | null;
}

/** How a node links: its own catalog category, an ancestor's page, or a search. */
export type CatalogMatch = 'catalog' | 'parent' | 'search';

export interface TaxonomyNode {
  slug: string;
  name: string;
  href: string;
  match: CatalogMatch;
}

export interface TaxonomySub extends TaxonomyNode {
  /** Sub-to-sub categories, in the sheet's order. */
  children: TaxonomyNode[];
}

export interface TaxonomyMain extends TaxonomyNode {
  image: CategoryImageSet;
  /** Alphabetical. */
  subcategories: TaxonomySub[];
}

/** Desktop "Explore Categories" grid: 6 columns x 2 rows. */
export const EXPLORE_CATEGORIES_PAGE_SIZE = 12;
/** Main categories without a banner yet. Sub/sub-to-sub use SUBCATEGORY_PLACEHOLDER_IMAGE. */
export const EXPLORE_CATEGORY_PLACEHOLDER = '/placeholders/category-card.svg';

// Main categories with a landscape banner in apps/web/public/categories/explore/<slug>.webp.
const DESKTOP_IMAGES = new Set([
  'agri-and-gardening',
  'artificial-flowers-and-plants',
  'arts-and-crafts',
  'auto-accessories',
  'baby-care',
  'bath-fittings',
  'cleaning-products',
  'clothing',
  'cosmetics',
  'crockery',
  'disposable-items',
  'electrical-and-lights',
  'electronics',
  'fashion-jewellery',
  'footwear',
  'furniture',
  'gifts-frames',
  'hardwares',
  'home-appliances',
  'home-furnishing',
  'kitchenware',
  'musical-instruments',
  'party-decorations',
  'pet-supplies',
  'plastic-household',
  'sports-fitness',
  'stationary',
  'tailoring-materials',
  'tools',
  'toys-games',
  'travel-accessories',
  'wall-clock-watches',
]);

export function categoryImages(mainSlug: string): CategoryImageSet {
  return {
    desktop: DESKTOP_IMAGES.has(mainSlug) ? `/categories/explore/${mainSlug}.webp` : null,
    mobile: null,
  };
}

/** Name key for matching: case, '&'/'and', punctuation and simple plurals don't matter. */
function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((word) => word && word !== 'and')
    .map((word) =>
      word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word,
    )
    .join(' ');
}

interface CatalogIndex {
  /** nameKey -> slug path within one storefront root (its subcategories and their children). */
  nodes: Map<string, string[]>;
  root: StoreCategory;
}

function indexRoot(root: StoreCategory): CatalogIndex {
  const nodes = new Map<string, string[]>();
  for (const sub of root.subcategories) {
    if (!nodes.has(nameKey(sub.name))) nodes.set(nameKey(sub.name), [root.slug, sub.slug]);
  }
  for (const sub of root.subcategories) {
    for (const child of sub.children) {
      if (!nodes.has(nameKey(child.name))) {
        nodes.set(nameKey(child.name), [root.slug, sub.slug, child.slug]);
      }
    }
  }
  return { nodes, root };
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

const searchHref = (name: string) => `${ROUTES.search}?q=${encodeURIComponent(name)}`;

/**
 * The taxonomy as display data: mains alphabetical, subs alphabetical, sub-to-subs in sheet order,
 * every node linked to the storefront catalog tree (see the header comment).
 */
export function buildCategoryTaxonomy(
  source: CategoryTaxonomySource,
  catalog: readonly StoreCategory[] = STORE_CATEGORIES,
): TaxonomyMain[] {
  const roots = new Map(catalog.map((root) => [nameKey(root.name), indexRoot(root)]));

  return source
    .map(([mainName, subs]): TaxonomyMain => {
      const slug = slugify(mainName);
      const index = roots.get(nameKey(mainName));
      const main: TaxonomyNode = index
        ? { slug, name: mainName, href: categoryHref(index.root.slug), match: 'catalog' }
        : { slug, name: mainName, href: searchHref(mainName), match: 'search' };

      const link = (name: string, parent: TaxonomyNode): Omit<TaxonomyNode, 'slug' | 'name'> => {
        const path = index?.nodes.get(nameKey(name));
        if (path) return { href: categoryHref(...path), match: 'catalog' };
        return index
          ? { href: parent.href, match: 'parent' }
          : { href: searchHref(name), match: 'search' };
      };

      return {
        ...main,
        image: categoryImages(slug),
        subcategories: subs
          .map(([subName, items]): TaxonomySub => {
            const sub: TaxonomyNode = {
              slug: slugify(subName),
              name: subName,
              ...link(subName, main),
            };
            return {
              ...sub,
              children: items.map((item) => ({
                slug: slugify(item),
                name: item,
                ...link(item, sub),
              })),
            };
          })
          .sort(byName),
      };
    })
    .sort(byName);
}

/** Splits the mains into carousel pages of `size`. */
export function taxonomyPages<T>(mains: readonly T[], size = EXPLORE_CATEGORIES_PAGE_SIZE): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < mains.length; i += size) pages.push(mains.slice(i, i + size));
  return pages;
}
