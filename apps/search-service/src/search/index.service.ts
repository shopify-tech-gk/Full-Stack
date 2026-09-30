import { logger } from '../logger';
import { typesenseClient, isTypesenseNotFound } from '../typesenseClient';
import { getProductForIndex, listProductsForIndex } from '../catalogClient';
import { moneyToPaise } from './money-paise';
import {
  ATTR_NUMBER_PREFIX,
  ATTR_STRING_PREFIX,
  PRODUCTS_ALIAS,
  collectionNeedsRebuild,
  ensureCollection,
  buildCollectionSchema,
  currentPhysicalCollectionName,
  type ProductDocument,
} from './collection';
import type { CatalogProductForIndex } from '../catalogClient';

/** Same normalisation the catalog applies to filter-definition keys (lower_snake_case). */
export function normalizeAttributeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** `{ram: "8", color: ["black","blue"], waterproof: true}` -> `attrs_*` strings (+ `attrn_*` numbers). */
function flattenAttributes(attributes: unknown): Record<string, string[] | number> {
  const fields: Record<string, string[] | number> = {};
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    return fields;
  }
  for (const [rawKey, raw] of Object.entries(attributes as Record<string, unknown>)) {
    const key = normalizeAttributeKey(rawKey);
    const values = (Array.isArray(raw) ? raw : [raw])
      .filter((v): v is string | number | boolean =>
        ['string', 'number', 'boolean'].includes(typeof v),
      )
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0 && v.length <= 100 && !v.includes('`'));
    if (!key || values.length === 0) continue;
    fields[`${ATTR_STRING_PREFIX}${key}`] = values;
    if (values.length === 1 && NUMERIC.test(values[0]!)) {
      fields[`${ATTR_NUMBER_PREFIX}${key}`] = Number(values[0]);
    }
  }
  return fields;
}

function toDocument(product: CatalogProductForIndex): ProductDocument {
  const pricePaise = product.price ? moneyToPaise(product.price) : 0;
  const mrpPaise = product.mrp ? moneyToPaise(product.mrp) : pricePaise;
  return {
    id: product.id,
    title: product.title,
    description: product.description ?? '',
    slug: product.slug,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    categoryIds: product.categoryPathIds,
    primaryImageUrl: product.primaryImageUrl ?? '',
    pricePaise,
    mrpPaise,
    discountPct: mrpPaise > pricePaise ? Math.floor(((mrpPaise - pricePaise) * 100) / mrpPaise) : 0,
    rating: product.rating ? Number(product.rating) : 0,
    ratingCount: product.ratingCount,
    inStock: true,
    createdAt: Math.floor(new Date(product.createdAt).getTime() / 1000),
    ...flattenAttributes(product.attributes),
  } as ProductDocument;
}

/**
 * THE event-driven reconcile step (called by the "search-reindex" worker,
 * reindex.queue.ts, for every catalog create/update/status-change/delete).
 * Always re-fetches the product FRESH from catalog-service (never trusts
 * the job payload beyond the id) and decides:
 *   - not found at all, OR status != ACTIVE, OR soft-deleted -> remove
 *     from the index (never appears in search).
 *   - ACTIVE + not deleted -> upsert the current data.
 * Operates against the `products` ALIAS, never a physical collection name
 * directly - the alias always resolves to whichever collection is
 * currently "live" (see collection.ts).
 */
export async function upsertProduct(productId: string): Promise<'upserted' | 'removed'> {
  const product = await getProductForIndex(productId);

  if (!product || product.status !== 'ACTIVE' || product.deletedAt) {
    await deleteProduct(productId);
    return 'removed';
  }

  const doc = toDocument(product);
  await typesenseClient.collections(PRODUCTS_ALIAS).documents().upsert(doc);
  return 'upserted';
}

/** Direct removal from the index - idempotent (already-absent is a no-op,
 * not an error). */
export async function deleteProduct(productId: string): Promise<void> {
  try {
    await typesenseClient.collections(PRODUCTS_ALIAS).documents(productId).delete();
  } catch (err) {
    if (!isTypesenseNotFound(err)) {
      throw err;
    }
  }
}

const FULL_REINDEX_PAGE_SIZE = 100;

/**
 * THE nightly safety-net rebuild (also manually triggerable via the admin
 * endpoint). ZERO-DOWNTIME by construction: builds a BRAND NEW physical
 * collection and only swings the `products` alias over to it once EVERY
 * active product has been imported successfully - reads through the alias
 * during the whole rebuild keep hitting the OLD, fully-populated
 * collection right up until the atomic alias swap, so the index is never
 * empty or partially-populated from a caller's point of view. The old
 * physical collection is deleted only AFTER the swap succeeds.
 */
export async function fullReindex(): Promise<{ indexed: number; collectionName: string }> {
  const physicalName = `products_${Date.now()}`;
  await typesenseClient.collections().create(buildCollectionSchema(physicalName));

  let indexed = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await listProductsForIndex(cursor, FULL_REINDEX_PAGE_SIZE);
    if (page.items.length > 0) {
      const docs = page.items.map(toDocument);
      await typesenseClient
        .collections(physicalName)
        .documents()
        .import(docs, { action: 'upsert' });
      indexed += docs.length;
    }
    if (!page.nextCursor) {
      break;
    }
    cursor = page.nextCursor;
  }

  const previousCollectionName = await currentPhysicalCollectionName();
  await typesenseClient.aliases().upsert(PRODUCTS_ALIAS, { collection_name: physicalName });

  if (previousCollectionName && previousCollectionName !== physicalName) {
    await typesenseClient
      .collections(previousCollectionName)
      .delete()
      .catch((err: unknown) => {
        logger.warn(
          { err, previousCollectionName },
          'failed to clean up old physical collection after alias swap',
        );
      });
  }

  logger.info({ indexed, collectionName: physicalName }, 'full reindex complete');
  return { indexed, collectionName: physicalName };
}

export async function initSearchIndex(): Promise<void> {
  await ensureCollection();
  // W3 changed the document shape (generic attrs_*/attrn_* fields); rebuild an older collection
  // once, zero-downtime via the same alias swap as the nightly job.
  if (await collectionNeedsRebuild()) {
    logger.info('products collection predates the generic-attribute schema - rebuilding');
    await fullReindex();
  }
}
