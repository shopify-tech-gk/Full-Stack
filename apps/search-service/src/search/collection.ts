import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';
import { typesenseClient, isTypesenseNotFound } from '../typesenseClient';

/** The STABLE name the rest of the app always searches/writes through -
 * never a physical collection name directly. Typesense aliases transparently
 * resolve document reads/writes AND search queries to whichever physical
 * collection they currently point at, which is what makes `fullReindex`'s
 * alias-swap a zero-downtime rebuild (see index.service.ts). */
export const PRODUCTS_ALIAS = 'products';

export interface ProductDocument {
  id: string;
  title: string;
  description: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  brand: string;
  color: string;
  size: string;
  primaryImageUrl: string;
  /** Exact-integer paise (see money-paise.ts) - never a float, to avoid
   * range-filter/sort drift. Converted back to a `"1299.00"` Money string
   * only at the API response boundary (search.service.ts). */
  pricePaise: number;
  /** Defaults to `true` at index time (Ch6.3 launch simplification,
   * explicitly permitted/flagged in the task) - computing REAL per-SKU
   * stock during indexing would mean an inventory-service call per
   * product on every reindex, which is expensive at browse-scale and not
   * needed for launch; refine (e.g. periodic stock sync into the index)
   * in a later chapter. Search/browse is DISPLAY only - checkout (Ch4)
   * always re-validates real stock, never trusts this flag. */
  inStock: boolean;
  /** Unix seconds - used for `sort_by=createdAt:desc` ("newest") and as
   * the collection's `default_sorting_field`. */
  createdAt: number;
}

/**
 * Field weights (title >> description) and typo/prefix behavior are NOT
 * part of the collection schema - Typesense applies those per SEARCH
 * REQUEST (`query_by_weights`, `num_typos`, `prefix`), not at index time.
 * See search.service.ts's `SEARCH_PARAMS` for the actual values; this
 * schema only declares which fields are searchable/facetable/sortable at
 * all.
 */
function buildCollectionSchema(name: string): CollectionCreateSchema {
  return {
    name,
    fields: [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'slug', type: 'string', index: false },
      { name: 'categoryId', type: 'string', facet: true },
      { name: 'categoryName', type: 'string', facet: true },
      { name: 'brand', type: 'string', facet: true },
      { name: 'color', type: 'string', facet: true },
      { name: 'size', type: 'string', facet: true },
      { name: 'primaryImageUrl', type: 'string', index: false },
      { name: 'pricePaise', type: 'int32', facet: true },
      { name: 'inStock', type: 'bool', facet: true },
      { name: 'createdAt', type: 'int64' },
    ],
    default_sorting_field: 'createdAt',
  };
}

async function currentPhysicalCollectionName(): Promise<string | null> {
  try {
    const alias = await typesenseClient.aliases(PRODUCTS_ALIAS).retrieve();
    return alias.collection_name;
  } catch (err) {
    if (isTypesenseNotFound(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * Idempotent bootstrap - creates a fresh physical collection + points the
 * `products` alias at it ONLY if the alias doesn't exist yet (first run
 * against a brand-new Typesense). Safe to call on every service startup.
 */
export async function ensureCollection(): Promise<void> {
  const existing = await currentPhysicalCollectionName();
  if (existing) {
    return;
  }
  const physicalName = `products_${Date.now()}`;
  await typesenseClient.collections().create(buildCollectionSchema(physicalName));
  await typesenseClient.aliases().upsert(PRODUCTS_ALIAS, { collection_name: physicalName });
}

export { buildCollectionSchema, currentPhysicalCollectionName };
