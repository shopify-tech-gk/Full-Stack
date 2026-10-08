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

/** The catalog slug a taxonomy href points at (its last path segment); '' for search links. */
export function catalogSlugOf(href: string): string {
  if (href.startsWith('/search')) return '';
  return href.split('?')[0]?.split('/').filter(Boolean).pop() ?? '';
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

/** One step in the category breadcrumb (main › sub › leaf). */
export interface TrailNode {
  name: string;
  /** Taxonomy path to this node, '~'-joined (what the listing screen passes as `taxo`). */
  taxo: string;
  href: string;
}

/**
 * The breadcrumb from the main down to the node at `path` (1–3 taxonomy slugs). Lets the listing
 * screen offer "jump back up" links to parent categories.
 */
export function taxonomyTrail(path: string[]): TrailNode[] {
  const [mainSlug, subSlug, leafSlug] = path;
  const main = tree().find((m) => m.slug === mainSlug);
  if (!main) return [];
  const out: TrailNode[] = [{ name: main.name, taxo: main.slug, href: main.href }];
  if (!subSlug) return out;

  const sub = main.subcategories.find((s) => s.slug === subSlug);
  if (!sub) return out;
  out.push({ name: sub.name, taxo: `${main.slug}~${sub.slug}`, href: sub.href });
  if (!leafSlug) return out;

  const leaf = sub.children.find((c) => c.slug === leafSlug);
  if (leaf)
    out.push({ name: leaf.name, taxo: `${main.slug}~${sub.slug}~${leaf.slug}`, href: leaf.href });
  return out;
}

/** Fallback for direct `/category/<slug>` links: find the taxonomy path whose node targets `slug`. */
export function taxonomyPathForSlug(slug: string): string[] {
  if (!slug) return [];
  for (const main of tree()) {
    if (catalogSlugOf(main.href) === slug) return [main.slug];
    for (const sub of main.subcategories) {
      if (catalogSlugOf(sub.href) === slug) return [main.slug, sub.slug];
      for (const leaf of sub.children) {
        if (catalogSlugOf(leaf.href) === slug) return [main.slug, sub.slug, leaf.slug];
      }
    }
  }
  return [];
}

/** Sibling categories of the node at `path` (its parent's other children) — for "Related categories". */
export function relatedCategories(path: string[]): CatNode[] {
  if (path.length === 0) return mainCategories();
  const [mainSlug, subSlug, leafSlug] = path;
  const main = tree().find((m) => m.slug === mainSlug);
  if (!main) return mainCategories();

  if (!subSlug) {
    return tree()
      .filter((m) => m.slug !== mainSlug)
      .map((m) => ({
        slug: m.slug,
        name: m.name,
        href: m.href,
        hasChildren: m.subcategories.length > 0,
      }));
  }

  const sub = main.subcategories.find((s) => s.slug === subSlug);
  if (!sub) return [];

  if (!leafSlug) {
    return main.subcategories
      .filter((s) => s.slug !== subSlug)
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        href: s.href,
        hasChildren: subHasChildren(s.children, s.name),
      }));
  }

  return sub.children
    .filter((c) => c.slug !== leafSlug)
    .map((c) => ({ slug: c.slug, name: c.name, href: c.href, hasChildren: false }));
}
