import {
  buildCategoryTaxonomy,
  categoryHref,
  type StoreCategory,
  type StoreSubcategory,
  type TaxonomyLeaf,
  type TaxonomyMain,
  type TaxonomySub,
} from '@youmart/shared-client';
import {
  CATEGORY_IMAGE_PATHS,
  CATEGORY_TAXONOMY_SOURCE,
} from '@youmart/shared-client/src/category-taxonomy.data';
import { storeCategories } from './categories';

export const categoryTaxonomy: readonly TaxonomyMain[] = buildCategoryTaxonomy(
  CATEGORY_TAXONOMY_SOURCE,
  CATEGORY_IMAGE_PATHS,
  storeCategories,
);

/** What the desktop grid needs up front; sub-to-sub lists load on demand (taxonomyChildren). */
export interface ExploreSub extends Omit<TaxonomySub, 'children'> {
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

export function taxonomyChildren(mainSlug: string, subSlug: string): TaxonomyLeaf[] {
  const main = categoryTaxonomy.find((m) => m.slug === mainSlug);
  return main?.subcategories.find((s) => s.slug === subSlug)?.children ?? [];
}

/** The desktop CategoryBar's chips; a main's subs load on demand (taxonomyMain). */
export interface CategoryBarMain {
  slug: string;
  name: string;
  href: string;
  image: string | null;
}

export function categoryBarMains(): CategoryBarMain[] {
  return categoryTaxonomy.map(({ slug, name, href, image }) => ({
    slug,
    name,
    href,
    image: image.desktop,
  }));
}

export function taxonomyMain(slug: string): TaxonomyMain | null {
  return categoryTaxonomy.find((m) => m.slug === slug) ?? null;
}

/** A catalog root the taxonomy doesn't cover, in the taxonomy's shape (placeholder artwork). */
function catalogAsTaxonomy(root: StoreCategory): TaxonomyMain {
  const node = (name: string, ...path: string[]): TaxonomyLeaf => ({
    slug: path[path.length - 1]!,
    name,
    href: categoryHref(...path),
    match: 'catalog',
    image: null,
  });
  return {
    ...node(root.name, root.slug),
    image: { desktop: null, mobile: null },
    subcategories: root.subcategories.map((sub) => ({
      ...node(sub.name, root.slug, sub.slug),
      children: sub.children.map((child) => node(child.name, root.slug, sub.slug, child.slug)),
    })),
  };
}

export interface CategoryContext {
  /** The taxonomy main whose catalog root the page is in. */
  main: TaxonomyMain;
  /** Breadcrumb from the main down to the current page, in the taxonomy's names where it has them. */
  trail: { name: string; href: string }[];
}

/** Where a /category/... page sits in the taxonomy (its sidebar + breadcrumb). */
export function categoryContext(path: readonly string[]): CategoryContext | null {
  const root = storeCategories.find((c) => c.slug === path[0]);
  if (!root) return null;
  const rootHref = categoryHref(root.slug);
  const main =
    categoryTaxonomy.find((m) => m.match === 'catalog' && m.href === rootHref) ??
    catalogAsTaxonomy(root);
  const named = [
    ...main.subcategories,
    ...main.subcategories.flatMap((sub) => sub.children),
  ].filter((n) => n.match === 'catalog');

  const trail = [{ name: main.name, href: main.href }];
  let level: readonly StoreSubcategory[] = root.subcategories;
  for (let depth = 1; depth < path.length; depth++) {
    const node = level.find((s) => s.slug === path[depth]);
    if (!node) break;
    const href = categoryHref(...path.slice(0, depth + 1));
    trail.push({ name: named.find((n) => n.href === href)?.name ?? node.name, href });
    level = node.children;
  }
  return { main, trail };
}

export interface RelatedCategory {
  slug: string;
  name: string;
  href: string;
  /** Portrait tile (subs/leaves) or landscape banner (mains); null = placeholder. */
  image: string | null;
}

/**
 * Best Categories Today tiles: a store-category href -> its new portrait sub-category image
 * (apps/web/public/categories/explore/...). Built from the taxonomy, which links each node to the
 * store catalog, so it keys by the same href the store sub-categories use.
 */
export function bestCategorySubImages(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const main of categoryTaxonomy) {
    for (const sub of main.subcategories) {
      if (sub.image) map[sub.href] = sub.image;
      for (const leaf of sub.children) {
        if (leaf.image) map[leaf.href] = leaf.image;
      }
    }
  }
  return map;
}

/** Sibling categories of the /category/... page — the parent's other children, for "Related categories". */
export function relatedCategories(path: readonly string[]): RelatedCategory[] {
  const ctx = categoryContext(path);
  if (!ctx) return [];
  const { main } = ctx;
  const curHref = categoryHref(...path);

  if (path.length <= 1) {
    return categoryTaxonomy
      .filter((m) => m.href !== main.href)
      .map((m) => ({ slug: m.slug, name: m.name, href: m.href, image: m.image.desktop }));
  }
  if (path.length === 2) {
    return main.subcategories
      .filter((s) => s.href !== curHref)
      .map((s) => ({ slug: s.slug, name: s.name, href: s.href, image: s.image }));
  }
  const parentSub = main.subcategories.find((s) => s.children.some((c) => c.href === curHref));
  if (!parentSub) return [];
  return parentSub.children
    .filter((c) => c.href !== curHref)
    .map((c) => ({ slug: c.slug, name: c.name, href: c.href, image: c.image }));
}
