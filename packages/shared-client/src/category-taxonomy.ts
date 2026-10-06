// The client's category taxonomy (Main -> Sub -> Sub-to-Sub): homepage DISPLAY data for the desktop
// "Explore Categories" section, shared with mobile. The data lives in
// data/category-taxonomy.csv -> category-taxonomy.data.ts (pnpm build:category-taxonomy), so a
// corrected sheet is a data swap with no UI change. It is a best-effort realignment of the client's
// sheet pending their confirmation - see docs/catalog/taxonomy-realign-report.md.
// The ~45 KB data module is NOT re-exported from the package index (it would land in every client
// bundle): import CATEGORY_TAXONOMY_SOURCE / CATEGORY_IMAGE_PATHS from
// '@youmart/shared-client/src/category-taxonomy.data'.
//
// Artwork (apps/web/public/categories/explore/, registered by the same command):
//   <main>.webp           main desktop banner, landscape 16:5 (960 x 300)
//   mobile/<main>.webp    main mobile image, portrait (slot for the mobile phase)
//   <main>/<sub>.webp, <main>/<sub>/<sub-to-sub>.webp   portrait 2:3 tiles
// Anything missing falls back to a placeholder.
//
// Linking: the taxonomy differs from the catalog tree, so every node is matched by name to the
// storefront category tree (the one /category/... pages resolve). No match -> nearest matched
// ancestor's page ('parent'); a main with no catalog match -> /search?q=<name> ('search').
import { STORE_CATEGORIES, categoryHref, slugify, type StoreCategory } from './categories';
import { ROUTES } from './routes';

export type CategoryTaxonomySource = ReadonlyArray<
  readonly [main: string, subs: ReadonlyArray<readonly [sub: string, items: readonly string[]]>]
>;

/** Registered artwork: slug path without extension (e.g. `baby-care/diapering`) -> public URL. */
export type CategoryImagePaths = Readonly<Record<string, string>>;

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

/** Sub and sub-to-sub categories: one portrait (2:3) tile image; null = placeholder. */
export interface TaxonomyLeaf extends TaxonomyNode {
  image: string | null;
}

export interface TaxonomySub extends TaxonomyLeaf {
  /** Sub-to-sub categories, in the sheet's order. */
  children: TaxonomyLeaf[];
}

export interface TaxonomyMain extends TaxonomyNode {
  image: CategoryImageSet;
  /** Alphabetical. */
  subcategories: TaxonomySub[];
}

/** Desktop "Explore Categories" grid: 6 columns x 2 rows. */
export const EXPLORE_CATEGORIES_PAGE_SIZE = 12;
/** Main categories without a banner yet. */
export const EXPLORE_CATEGORY_PLACEHOLDER = '/placeholders/category-card.svg';
/** Sub / sub-to-sub tiles without artwork: the portrait sky-blue podium card. */
export const CATEGORY_TILE_PLACEHOLDER = '/placeholders/category-tile.svg';

export function categoryImages(mainSlug: string, images: CategoryImagePaths): CategoryImageSet {
  return { desktop: images[mainSlug] ?? null, mobile: images[`mobile/${mainSlug}`] ?? null };
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
  images: CategoryImagePaths = {},
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
        image: categoryImages(slug, images),
        subcategories: subs
          .map(([subName, items]): TaxonomySub => {
            const subSlug = slugify(subName);
            const sub: TaxonomyNode = { slug: subSlug, name: subName, ...link(subName, main) };
            return {
              ...sub,
              image: images[`${slug}/${subSlug}`] ?? null,
              children: items.map((item) => {
                const itemSlug = slugify(item);
                return {
                  slug: itemSlug,
                  name: item,
                  ...link(item, sub),
                  image: images[`${slug}/${subSlug}/${itemSlug}`] ?? null,
                };
              }),
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
