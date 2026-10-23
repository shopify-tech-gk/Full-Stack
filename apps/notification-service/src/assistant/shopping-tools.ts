import { CATEGORY_INDEX } from './category-index.data';
import { searchClient } from '../serviceClients';
import { logger } from '../logger';

// v1.17 YouMart AI shopping tools: find store categories by keyword, search real products, and
// the cards the customer sees under a reply (categories / products / a restock offer).

/** A category card: `taxo` is the app's taxonomy path ("main~sub~leaf"). */
export interface AssistantCategory {
  taxo: string;
  name: string;
  /** "Main > Sub" - for context; '' for a main category. */
  parents: string;
}

/** A product card (prices in rupees, as strings like "1299.00"). */
export interface AssistantProduct {
  id: string;
  slug: string;
  title: string;
  price: string;
  mrp: string;
  imageUrl: string | null;
  category: string;
}

const BY_TAXO = new Map(
  CATEGORY_INDEX.map(([taxo, name, parents]) => [taxo, { taxo, name, parents }]),
);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    // Light singular form, so "shoes"/"shoe" and "bags"/"bag" match.
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));

/** Store categories best matching any of the keywords (most relevant first). */
export function findCategories(keywords: string[], limit = 14): AssistantCategory[] {
  const scores = new Map<string, number>();
  for (const keyword of keywords.slice(0, 12)) {
    const kw = words(keyword);
    if (kw.length === 0) continue;
    const phrase = kw.join(' ');
    for (const [taxo, name, parents] of CATEGORY_INDEX) {
      const nw = words(name);
      const nameText = nw.join(' ');
      let score = 0;
      if (nameText === phrase) score = 12;
      else if (kw.every((w) => nw.includes(w))) score = 8;
      else if (nameText.includes(phrase)) score = 6;
      else {
        const hits = kw.filter((w) => nw.includes(w)).length;
        if (hits > 0) score = 3 * hits;
        else if (kw.some((w) => words(parents).includes(w))) score = 1;
      }
      if (score === 0) continue;
      // Prefer specific categories (sub / sub-to-sub) slightly over a whole main category.
      const depth = taxo.split('~').length;
      score += depth === 1 ? 0 : 0.5;
      scores.set(taxo, Math.max(scores.get(taxo) ?? 0, score));
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([taxo]) => BY_TAXO.get(taxo)!)
    .filter(Boolean);
}

export function categoryByTaxo(taxo: string): AssistantCategory | null {
  return BY_TAXO.get(taxo) ?? null;
}

/** The 29 main categories, for the system prompt. */
export const MAIN_CATEGORY_NAMES = CATEGORY_INDEX.filter(([taxo]) => !taxo.includes('~')).map(
  ([, name]) => name,
);

/** Real products for a query (best match first); [] when the store has none. */
export async function searchProducts(
  query: string,
  opts: { maxPrice?: number; limit?: number } = {},
): Promise<AssistantProduct[]> {
  try {
    const result = await searchClient.browse({
      q: query,
      ...(opts.maxPrice ? { maxPrice: opts.maxPrice } : {}),
      sort: 'relevance',
      perPage: Math.min(opts.limit ?? 8, 12),
      page: 1,
    });
    return result.items.map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      price: item.price,
      mrp: item.mrp,
      imageUrl: item.imageUrl,
      category: item.category.name,
    }));
  } catch (err) {
    logger.warn({ err }, 'assistant: product search failed');
    throw err;
  }
}
