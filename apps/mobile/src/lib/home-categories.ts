import { buildCategoryTaxonomy, type TaxonomyMain } from '@youmart/shared-client';
import {
  CATEGORY_IMAGE_PATHS,
  CATEGORY_TAXONOMY_SOURCE,
} from '@youmart/shared-client/src/category-taxonomy.data';

// The full static category taxonomy (same ~32 mains the desktop "Explore Categories" shows),
// alphabetical. The home portrait cards page through all of these, and the browse flow drills into
// a main's sub-categories and their sub-to-sub lists — all as portrait cards.

/** A tappable category node for the portrait-card UI. */
export interface CatNode {
  slug: string;
  name: string;
  /** Taxonomy link: /category/<slug> for a catalog match, or /search?q=<name> otherwise. */
  href: string;
  /** True when tapping should drill into child categories instead of opening a product listing. */
  hasChildren: boolean;
}

/** Backwards-compatible shape used by older callers. */
export interface HomeCategory {
  slug: string;
  name: string;
  href: string;
}

let treeCache: TaxonomyMain[] | null = null;

function tree(): TaxonomyMain[] {
  if (!treeCache) {
    treeCache = buildCategoryTaxonomy(CATEGORY_TAXONOMY_SOURCE, CATEGORY_IMAGE_PATHS);
  }
  return treeCache;
}

/** A sub whose only item is itself (or has none) links straight to its page — no drill-down. */
function subHasChildren(children: { name: string }[], subName: string): boolean {
  if (children.length === 0) return false;
  if (children.length === 1 && children[0]?.name === subName) return false;
  return true;
}

/** All main categories, as portrait-card nodes (each drills into its sub-categories). */
export function mainCategories(): CatNode[] {
  return tree().map((m) => ({
    slug: m.slug,
    name: m.name,
    href: m.href,
    hasChildren: m.subcategories.length > 0,
  }));
}

/** Legacy: plain {slug,name,href} list. */
export function allCategories(): HomeCategory[] {
  return tree().map(({ slug, name, href }) => ({ slug, name, href }));
}

export interface BrowseNode {
  /** The category whose children are shown (a main or a sub). */
  name: string;
  /** "Shop all" link for this category. */
  href: string;
  children: CatNode[];
}

/**
 * Resolve a browse path to the node whose children should be shown as portrait cards.
 * - `[mainSlug]`            → the main's sub-categories
 * - `[mainSlug, subSlug]`   → the sub's sub-to-sub categories (leaves)
 */
export function browseNode(path: string[]): BrowseNode | null {
  const [mainSlug, subSlug] = path;
  const main = tree().find((m) => m.slug === mainSlug);
  if (!main) return null;

  if (!subSlug) {
    return {
      name: main.name,
      href: main.href,
      children: main.subcategories.map((s) => ({
        slug: s.slug,
        name: s.name,
        href: s.href,
        hasChildren: subHasChildren(s.children, s.name),
      })),
    };
  }

  const sub = main.subcategories.find((s) => s.slug === subSlug);
  if (!sub) return null;
  return {
    name: sub.name,
    href: sub.href,
    children: sub.children.map((c) => ({
      slug: c.slug,
      name: c.name,
      href: c.href,
      hasChildren: false,
    })),
  };
}
