import { randomBytes } from 'node:crypto';
import { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { compare } from '@youmart/shared-utils';
import { enqueueSearchReindex } from '@youmart/search-reindex-client';
import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '@youmart/errors';
import { resolveCategory, type CategoryPathItem } from './browse.service';
import type {
  ListProductsQuery,
  CreateProductBody,
  UpdateProductBody,
  AddSkuBody,
  UpdateSkuBody,
  AddImageBody,
  CreateCategoryBody,
  FilterDefinitionEntry,
  UpdateCategoryBody,
} from './catalog.schema';

export interface PaginatedList<T> {
  items: T[];
  nextCursor: string | null;
}

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

function buildImageUrl(storedPath: string): string {
  // Absolute URLs (e.g. an existing CDN/S3 host from a bulk import) are used as delivered.
  if (/^https?:\/\//i.test(storedPath)) {
    return storedPath;
  }
  const base = config.cdnBaseUrl.replace(/\/+$/, '');
  const path = storedPath.replace(/^\/+/, '');
  return `${base}/${path}`;
}

interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface ProductListItem {
  id: string;
  title: string;
  slug: string;
  price: Money | null;
  imageUrl: string | null;
  category: CategoryRef;
}

export interface ProductSkuDetail {
  id: string;
  skuCode: string;
  mrp: Money;
  sellingPrice: Money;
  attributes: unknown;
}

export interface ProductImageDetail {
  id: string;
  url: string;
  position: number;
}

export interface ProductDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: CategoryRef;
  skus: ProductSkuDetail[];
  images: ProductImageDetail[];
}

// Richer shape returned only from write-endpoint responses (never the public
// read endpoints, whose shape must stay exactly as it was in 4.1) - includes
// fields a catalog manager needs (status, sellerId, GST invoice fields) but a
// public shopper doesn't.
export interface AdminProductDetail extends ProductDetail {
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  sellerId: string;
  hsnCode: string | null;
  gstRatePercent: string | null;
}

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
}

/** Write-endpoint responses also echo the category's own filter definition (null = inherited). */
export interface AdminCategoryItem extends CategoryListItem {
  filterDefinition: unknown;
}

const PRODUCT_LIST_INCLUDE = {
  category: true,
  skus: { where: { deletedAt: null } },
  images: { where: { deletedAt: null }, orderBy: { position: 'asc' as const }, take: 1 },
} satisfies Prisma.ProductInclude;

type ProductWithListRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_LIST_INCLUDE }>;

function minSellingPrice(skus: { sellingPrice: Prisma.Decimal }[]): Prisma.Decimal | null {
  if (skus.length === 0) {
    return null;
  }
  return skus.reduce(
    (min, sku) => (sku.sellingPrice.lessThan(min) ? sku.sellingPrice : min),
    skus[0]!.sellingPrice,
  );
}

function toListItem(product: ProductWithListRelations): ProductListItem {
  const price = minSellingPrice(product.skus);
  const primaryImage = product.images[0];

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    price: price ? decimalToMoney(price) : null,
    imageUrl: primaryImage ? buildImageUrl(primaryImage.url) : null,
    category: { id: product.category.id, name: product.category.name, slug: product.category.slug },
  };
}

const PRODUCT_DETAIL_INCLUDE = {
  category: true,
  skus: { where: { deletedAt: null } },
  images: { where: { deletedAt: null }, orderBy: { position: 'asc' as const } },
} satisfies Prisma.ProductInclude;

type ProductWithDetailRelations = Prisma.ProductGetPayload<{
  include: typeof PRODUCT_DETAIL_INCLUDE;
}>;

function toProductDetail(product: ProductWithDetailRelations): ProductDetail {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    category: { id: product.category.id, name: product.category.name, slug: product.category.slug },
    skus: product.skus.map((sku) => ({
      id: sku.id,
      skuCode: sku.skuCode,
      mrp: decimalToMoney(sku.mrp),
      sellingPrice: decimalToMoney(sku.sellingPrice),
      attributes: sku.attributes,
    })),
    images: product.images.map((image) => ({
      id: image.id,
      url: buildImageUrl(image.url),
      position: image.position,
    })),
  };
}

function toAdminProductDetail(product: ProductWithDetailRelations): AdminProductDetail {
  return {
    ...toProductDetail(product),
    status: product.status,
    sellerId: product.sellerId,
    hsnCode: product.hsnCode,
    gstRatePercent: product.gstRatePercent ? product.gstRatePercent.toFixed(2) : null,
  };
}

async function loadAdminProductDetailById(id: string): Promise<AdminProductDetail> {
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: PRODUCT_DETAIL_INCLUDE,
  });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }
  return toAdminProductDetail(product);
}

/**
 * Search-service's view of a product (Ch6.3) - deliberately includes
 * EVERY status and soft-deleted rows (unlike every public/seller-facing
 * function above) so search-service's `upsertProduct` can tell "gone/not
 * active -> remove from index" apart from "active -> upsert", using
 * catalog as the single source of truth each time rather than trusting a
 * possibly-stale enqueue payload. */
export interface ProductForIndex {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  deletedAt: string | null;
  categoryId: string;
  categoryName: string;
  /** W3: lets a parent category's listing include its descendants' products. */
  categorySlug: string;
  categoryPathIds: string[];
  price: Money | null;
  /** MRP of the cheapest SKU (the one `price` comes from). */
  mrp: Money | null;
  rating: string | null;
  ratingCount: number;
  primaryImageUrl: string | null;
  attributes: unknown;
  createdAt: string;
}

/** id -> parentId for every live category; categories are few, products are many. */
async function loadCategoryParents(): Promise<Map<string, string | null>> {
  const rows = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, parentId: true },
  });
  return new Map(rows.map((row) => [row.id, row.parentId]));
}

export function categoryPathIds(categoryId: string, parents: Map<string, string | null>): string[] {
  const path: string[] = [];
  for (let id: string | null | undefined = categoryId; id && !path.includes(id);) {
    path.push(id);
    id = parents.get(id);
  }
  return path;
}

function toProductForIndex(
  product: ProductWithListRelations,
  parents: Map<string, string | null>,
): ProductForIndex {
  const cheapest = product.skus.reduce<(typeof product.skus)[number] | null>(
    (min, sku) => (!min || sku.sellingPrice.lessThan(min.sellingPrice) ? sku : min),
    null,
  );
  const primaryImage = product.images[0];
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    slug: product.slug,
    status: product.status,
    deletedAt: product.deletedAt ? product.deletedAt.toISOString() : null,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
    categoryPathIds: categoryPathIds(product.categoryId, parents),
    price: cheapest ? decimalToMoney(cheapest.sellingPrice) : null,
    mrp: cheapest ? decimalToMoney(cheapest.mrp) : null,
    rating: product.rating ? product.rating.toFixed(1) : null,
    ratingCount: product.ratingCount,
    primaryImageUrl: primaryImage ? buildImageUrl(primaryImage.url) : null,
    attributes: product.attributes,
    createdAt: product.createdAt.toISOString(),
  };
}

/** Internal, service-to-service read (search-service's event-driven
 * reindex worker, Ch6.3) - `null` only if the id never existed at all;
 * an existing-but-soft-deleted/DRAFT/ARCHIVED product is still returned
 * (with its real status/deletedAt) rather than 404ing, since the caller
 * needs exactly that information to decide to remove it from the index. */
export async function getProductForIndex(id: string): Promise<ProductForIndex | null> {
  const product = await prisma.product.findFirst({
    where: { id },
    include: PRODUCT_LIST_INCLUDE,
  });
  return product ? toProductForIndex(product, await loadCategoryParents()) : null;
}

/** Internal, service-to-service read (search-service's `fullReindex`
 * safety net, Ch6.3) - ONLY ACTIVE, non-deleted products (a full rebuild
 * only ever needs to know what SHOULD be in the index, never the
 * excluded statuses). */
export async function listProductsForIndex(query: {
  cursor?: string;
  limit: number;
}): Promise<PaginatedList<ProductForIndex>> {
  const { cursor, limit } = query;

  const rows = await prisma.product.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: PRODUCT_LIST_INCLUDE,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  const parents = await loadCategoryParents();
  return { items: pageRows.map((row) => toProductForIndex(row, parents)), nextCursor };
}

export async function getProductBySlug(slug: string): Promise<PublicProductDetail> {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    include: PRODUCT_DETAIL_INCLUDE,
  });

  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  const category = await resolveCategory({ id: product.categoryId });
  return {
    ...toProductDetail(product),
    attributes: product.attributes,
    specifications: specifications(product.attributes, category.definition),
    rating: product.rating ? Number(product.rating.toFixed(1)) : null,
    ratingCount: product.ratingCount,
    categoryPath: category.path,
  };
}

/** v1.3 additive fields on the public detail. */
export interface PublicProductDetail extends ProductDetail {
  attributes: unknown;
  specifications: { key: string; label: string; value: string; unit: string | null }[];
  rating: number | null;
  ratingCount: number;
  categoryPath: CategoryPathItem[];
}

function labelFor(key: string): string {
  const words = key.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Every attribute as a labelled row - definition order and labels first, the rest A-Z. */
function specifications(
  attributes: unknown,
  definition: FilterDefinitionEntry[],
): PublicProductDetail['specifications'] {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) return [];
  const rank = (key: string) => {
    const index = definition.findIndex((entry) => entry.key === key);
    return index === -1 ? definition.length : index;
  };
  return Object.entries(attributes as Record<string, unknown>)
    .map(([key, raw]) => {
      const entry = definition.find((e) => e.key === key);
      const values = (Array.isArray(raw) ? raw : [raw]).filter(
        (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
      );
      const value = values
        .map((v) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)))
        .join(', ');
      return { key, label: entry?.label ?? labelFor(key), value, unit: entry?.unit ?? null };
    })
    .filter((row) => row.value.length > 0)
    .sort((a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label));
}

export interface SkuDetail {
  skuId: string;
  productId: string;
  productSlug: string;
  title: string;
  sellerId: string;
  sellingPrice: Money;
  mrp: Money;
  active: boolean;
  /** GST invoice fields (Ch6.4) - product-level, nullable; invoice-service
   * applies its own DEFAULT_HSN_CODE/DEFAULT_GST_RATE_PERCENT fallback
   * when either is null. */
  hsnCode: string | null;
  gstRatePercent: string | null;
}

/**
 * Internal-ish lookup used by other services (cart/checkout) via
 * @youmart/service-client's getSku - unlike getProductBySlug, a SKU whose
 * product is DRAFT/ARCHIVED/deleted is NOT 404: it's returned with
 * `active: false` so a caller can distinguish "doesn't exist" from
 * "exists but can't be sold right now". Only a missing/deleted SKU 404s.
 *
 * `sellerId` = product.sellerId (the default seller in today's hard-off
 * mode; the real per-product seller once marketplace mode is enabled) -
 * this is the ONLY authoritative source of a SKU's seller, since
 * order-service (orders_svc) cannot read the catalog schema itself.
 */
export async function getSkuById(skuId: string): Promise<SkuDetail> {
  const sku = await prisma.sku.findFirst({
    where: { id: skuId, deletedAt: null },
    include: { product: true },
  });

  if (!sku) {
    throw new AppError('NOT_FOUND', 404, 'SKU not found');
  }

  return {
    skuId: sku.id,
    productId: sku.productId,
    productSlug: sku.product.slug,
    title: sku.product.title,
    sellerId: sku.product.sellerId,
    sellingPrice: decimalToMoney(sku.sellingPrice),
    mrp: decimalToMoney(sku.mrp),
    active: sku.product.status === 'ACTIVE' && sku.product.deletedAt === null,
    hsnCode: sku.product.hsnCode,
    gstRatePercent: sku.product.gstRatePercent ? sku.product.gstRatePercent.toFixed(2) : null,
  };
}

export async function listCategories(): Promise<CategoryListItem[]> {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
  }));
}

// ---------------------------------------------------------------------------
// Write side (Ch4.2). Every write endpoint requires requireAuth + the
// TEMPORARY requireCatalogManager guard (see catalogManager.middleware.ts) -
// there is no real RBAC until Ch6.
// ---------------------------------------------------------------------------

type SkuClient = Pick<typeof prisma, 'sku'> | Prisma.TransactionClient;

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
  return base.length > 0 ? base : 'item';
}

function shortSuffix(): string {
  return randomBytes(3).toString('hex');
}

// `slug`/`sku_code` uniqueness is a hand-added PARTIAL unique index (WHERE
// deleted_at IS NULL), not a Prisma `@unique` - so uniqueness is enforced
// here via findFirst + retry-with-suffix, not `upsert`. There's a small
// theoretical race between this check and the eventual insert; the DB-level
// partial unique index is the real backstop against a genuine collision.
async function generateUniqueProductSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await prisma.product.findFirst({ where: { slug: candidate, deletedAt: null } });
    if (!clash) {
      return candidate;
    }
    candidate = `${base}-${shortSuffix()}`;
  }
  throw new AppError('CONFLICT', 409, 'Could not generate a unique product slug');
}

async function generateUniqueCategorySlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await prisma.category.findFirst({ where: { slug: candidate, deletedAt: null } });
    if (!clash) {
      return candidate;
    }
    candidate = `${base}-${shortSuffix()}`;
  }
  throw new AppError('CONFLICT', 409, 'Could not generate a unique category slug');
}

async function generateUniqueSkuCode(client: SkuClient, productSlug: string): Promise<string> {
  const base = productSlug.toUpperCase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${base}-${shortSuffix().toUpperCase()}`;
    const clash = await client.sku.findFirst({ where: { skuCode: candidate, deletedAt: null } });
    if (!clash) {
      return candidate;
    }
  }
  throw new AppError('CONFLICT', 409, 'Could not generate a unique SKU code');
}

async function assertSkuCodeAvailable(client: SkuClient, skuCode: string): Promise<void> {
  const clash = await client.sku.findFirst({ where: { skuCode, deletedAt: null } });
  if (clash) {
    throw new AppError('CONFLICT', 409, `SKU code "${skuCode}" is already in use`);
  }
}

function assertSellingPriceWithinMrp(sellingPrice: Money, mrp: Money, skuCode?: string): void {
  if (compare(sellingPrice, mrp) > 0) {
    throw new AppError('VALIDATION_ERROR', 400, 'sellingPrice must not exceed mrp', {
      skuCode,
      mrp,
      sellingPrice,
    });
  }
}

function toJsonInput(value: Record<string, unknown> | undefined): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const category = await prisma.category.findFirst({ where: { id: categoryId, deletedAt: null } });
  if (!category) {
    throw new AppError(
      'VALIDATION_ERROR',
      400,
      'categoryId does not reference an existing category',
    );
  }
}

// Only the transitions explicitly called out in the prompt are allowed;
// updating to the SAME status is always a no-op (skipped below), not
// checked against this table.
const ALLOWED_STATUS_TRANSITIONS: Record<
  'DRAFT' | 'ACTIVE' | 'ARCHIVED',
  ('DRAFT' | 'ACTIVE' | 'ARCHIVED')[]
> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
};

/**
 * Creates a product with its SKUs and (optional) images atomically.
 *
 * Hard-off multivendor: the ADMIN path (this function) always assigns
 * `config.defaultSellerId` - catalog_svc cannot read the `sellers` schema
 * to look up a real seller, and in hard-off mode the default seller is the
 * only one anyway. Ch4.2's admin write-endpoints keep using this. The
 * SELLER path (`createProductForSeller`, Ch5.2) is the same logic with a
 * caller-resolved `sellerId` instead - see seller-scope.middleware.ts.
 */
export async function createProduct(input: CreateProductBody): Promise<AdminProductDetail> {
  return createProductForSeller(config.defaultSellerId, input);
}

/**
 * Shared create logic for BOTH paths - admin (`createProduct`, always
 * `config.defaultSellerId`) and seller-owned (Ch5.2, a caller-resolved
 * `sellerId`, NEVER client-supplied - see catalog.seller.routes.ts). Only
 * the `sellerId` differs; validation (price rule, slug/SKU-code
 * uniqueness) is identical either way.
 */
export async function createProductForSeller(
  sellerId: string,
  input: CreateProductBody,
): Promise<AdminProductDetail> {
  for (const sku of input.skus) {
    assertSellingPriceWithinMrp(sku.sellingPrice, sku.mrp, sku.skuCode);
  }

  await assertCategoryExists(input.categoryId);

  const slug = await generateUniqueProductSlug(input.title);

  const productId = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        title: input.title,
        slug,
        description: input.description ?? null,
        sellerId,
        categoryId: input.categoryId,
        attributes: toJsonInput(input.attributes),
        status: input.status ?? 'DRAFT',
        hsnCode: input.hsnCode ?? null,
        gstRatePercent: input.gstRatePercent ?? null,
      },
    });

    for (const sku of input.skus) {
      if (sku.skuCode) {
        await assertSkuCodeAvailable(tx, sku.skuCode);
      }
      const skuCode = sku.skuCode ?? (await generateUniqueSkuCode(tx, slug));
      await tx.sku.create({
        data: {
          productId: created.id,
          skuCode,
          mrp: sku.mrp,
          sellingPrice: sku.sellingPrice,
          attributes: toJsonInput(sku.attributes),
        },
      });
    }

    for (const [index, image] of (input.images ?? []).entries()) {
      await tx.productImage.create({
        data: { productId: created.id, url: image.url, position: image.position ?? index },
      });
    }

    return created.id;
  });

  await enqueueSearchReindex(productId);

  return loadAdminProductDetailById(productId);
}

/**
 * OWNERSHIP ENFORCEMENT (the crux of the seller-scoped surface, Ch5.2): a
 * seller must never read or modify another seller's products. 404 (not
 * 403) on a mismatch/missing product - "exists but isn't yours" and
 * "doesn't exist" must be indistinguishable to the caller.
 */
export async function assertProductOwnedBySeller(
  productId: string,
  sellerId: string,
): Promise<void> {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product || product.sellerId !== sellerId) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }
}

/** Same ownership check, resolved through a SKU's parent product. Returns
 * the productId for the caller's convenience. */
export async function assertSkuOwnedBySeller(skuId: string, sellerId: string): Promise<string> {
  const sku = await prisma.sku.findFirst({
    where: { id: skuId, deletedAt: null },
    include: { product: true },
  });
  if (!sku || sku.product.deletedAt || sku.product.sellerId !== sellerId) {
    throw new AppError('NOT_FOUND', 404, 'SKU not found');
  }
  return sku.productId;
}

/** Same ownership check, resolved through an image's parent product. */
export async function assertImageOwnedBySeller(imageId: string, sellerId: string): Promise<string> {
  const image = await prisma.productImage.findFirst({
    where: { id: imageId, deletedAt: null },
    include: { product: true },
  });
  if (!image || image.product.deletedAt || image.product.sellerId !== sellerId) {
    throw new AppError('NOT_FOUND', 404, 'Image not found');
  }
  return image.productId;
}

/**
 * SELLER-OWNED product listing (Ch5.2) - unlike the public `listProducts`,
 * this returns EVERY status (DRAFT/ACTIVE/ARCHIVED) since it's the seller
 * managing their own catalog, not a shopper browsing it - but only ever the
 * caller's own `sellerId`, never another seller's.
 */
export async function listSellerProducts(
  sellerId: string,
  query: ListProductsQuery,
): Promise<PaginatedList<ProductListItem & { status: AdminProductDetail['status'] }>> {
  const { cursor, limit, categoryId, minPrice, maxPrice, q } = query;

  const priceFilter: Prisma.SkuWhereInput | undefined =
    minPrice !== undefined || maxPrice !== undefined
      ? {
          deletedAt: null,
          sellingPrice: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : undefined;

  const where: Prisma.ProductWhereInput = {
    sellerId,
    deletedAt: null,
    ...(categoryId ? { categoryId } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    ...(priceFilter ? { skus: { some: priceFilter } } : {}),
  };

  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: PRODUCT_LIST_INCLUDE,
  });

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null;

  return {
    items: pageRows.map((row) => ({ ...toListItem(row), status: row.status })),
    nextCursor,
  };
}

/**
 * Slug is intentionally left untouched here even if `title` changes - kept
 * stable once created so existing links/bookmarks to `/products/:slug`
 * don't break. An explicit slug-change endpoint can be added later if
 * needed; this endpoint never does it implicitly.
 */
export async function updateProduct(
  id: string,
  input: UpdateProductBody,
): Promise<AdminProductDetail> {
  const existing = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  if (input.categoryId !== undefined) {
    await assertCategoryExists(input.categoryId);
  }

  if (input.status !== undefined && input.status !== existing.status) {
    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status];
    if (!allowed.includes(input.status)) {
      throw new AppError(
        'VALIDATION_ERROR',
        400,
        `Cannot transition product status from ${existing.status} to ${input.status}`,
      );
    }
  }

  const data: Prisma.ProductUncheckedUpdateInput = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    ...(input.attributes !== undefined ? { attributes: toJsonInput(input.attributes) } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.hsnCode !== undefined ? { hsnCode: input.hsnCode } : {}),
    ...(input.gstRatePercent !== undefined ? { gstRatePercent: input.gstRatePercent } : {}),
  };

  await prisma.product.update({ where: { id }, data });

  await enqueueSearchReindex(id);

  return loadAdminProductDetailById(id);
}

export async function addSku(productId: string, input: AddSkuBody): Promise<AdminProductDetail> {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  assertSellingPriceWithinMrp(input.sellingPrice, input.mrp, input.skuCode);

  if (input.skuCode) {
    await assertSkuCodeAvailable(prisma, input.skuCode);
  }
  const skuCode = input.skuCode ?? (await generateUniqueSkuCode(prisma, product.slug));

  await prisma.sku.create({
    data: {
      productId,
      skuCode,
      mrp: input.mrp,
      sellingPrice: input.sellingPrice,
      attributes: toJsonInput(input.attributes),
    },
  });

  await enqueueSearchReindex(productId);

  return loadAdminProductDetailById(productId);
}

export async function updateSku(id: string, input: UpdateSkuBody): Promise<AdminProductDetail> {
  const existing = await prisma.sku.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'SKU not found');
  }

  const nextMrp = input.mrp ?? decimalToMoney(existing.mrp);
  const nextSellingPrice = input.sellingPrice ?? decimalToMoney(existing.sellingPrice);
  assertSellingPriceWithinMrp(nextSellingPrice, nextMrp, existing.skuCode);

  const data: Prisma.SkuUncheckedUpdateInput = {
    ...(input.mrp !== undefined ? { mrp: input.mrp } : {}),
    ...(input.sellingPrice !== undefined ? { sellingPrice: input.sellingPrice } : {}),
    ...(input.attributes !== undefined ? { attributes: toJsonInput(input.attributes) } : {}),
  };

  await prisma.sku.update({ where: { id }, data });

  await enqueueSearchReindex(existing.productId);

  return loadAdminProductDetailById(existing.productId);
}

/** Soft delete only - never a hard delete. Deleting an already-deleted (or
 * already-soft-deleted) product is a no-op, so repeated calls are safe. */
export async function softDeleteProduct(id: string): Promise<void> {
  const existing = await prisma.product.findFirst({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }
  if (existing.deletedAt) {
    return;
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.product.update({ where: { id }, data: { deletedAt: now } }),
    prisma.sku.updateMany({ where: { productId: id, deletedAt: null }, data: { deletedAt: now } }),
    prisma.productImage.updateMany({
      where: { productId: id, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);

  await enqueueSearchReindex(id);
}

export async function addImage(
  productId: string,
  input: AddImageBody,
): Promise<AdminProductDetail> {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

  const position =
    input.position ?? (await prisma.productImage.count({ where: { productId, deletedAt: null } }));

  await prisma.productImage.create({ data: { productId, url: input.url, position } });

  await enqueueSearchReindex(productId);

  return loadAdminProductDetailById(productId);
}

/** Soft delete only; idempotent (deleting an already-deleted image is a no-op). */
export async function softDeleteImage(id: string): Promise<void> {
  const existing = await prisma.productImage.findFirst({ where: { id } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Image not found');
  }
  if (existing.deletedAt) {
    return;
  }
  await prisma.productImage.update({ where: { id }, data: { deletedAt: new Date() } });

  await enqueueSearchReindex(existing.productId);
}

export async function createCategory(input: CreateCategoryBody): Promise<AdminCategoryItem> {
  if (input.parentId) {
    await assertParentCategoryExists(input.parentId);
  }

  const slug = await generateUniqueCategorySlug(input.name);

  const created = await prisma.category.create({
    data: {
      name: input.name,
      slug,
      parentId: input.parentId ?? null,
      ...(input.filterDefinition ? { filterDefinition: input.filterDefinition } : {}),
    },
  });

  return toAdminCategory(created);
}

function toAdminCategory(category: {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  filterDefinition: unknown;
}): AdminCategoryItem {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    filterDefinition: category.filterDefinition ?? null,
  };
}

/** `slug` is kept stable here too, for the same reason as products - a
 * rename never implicitly changes the slug. Changing `filterDefinition` needs no reindex: every
 * attribute is already indexed, the definition only chooses which ones to offer. */
export async function updateCategory(
  id: string,
  input: UpdateCategoryBody,
): Promise<AdminCategoryItem> {
  const existing = await prisma.category.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    throw new AppError('NOT_FOUND', 404, 'Category not found');
  }

  if (input.parentId) {
    if (input.parentId === id) {
      throw new AppError('VALIDATION_ERROR', 400, 'A category cannot be its own parent');
    }
    await assertParentCategoryExists(input.parentId);
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.filterDefinition !== undefined
        ? { filterDefinition: input.filterDefinition ?? Prisma.DbNull }
        : {}),
    },
  });

  return toAdminCategory(updated);
}

async function assertParentCategoryExists(parentId: string): Promise<void> {
  const parent = await prisma.category.findFirst({ where: { id: parentId, deletedAt: null } });
  if (!parent) {
    throw new AppError('VALIDATION_ERROR', 400, 'parentId does not reference an existing category');
  }
}
