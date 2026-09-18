import type { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '../errors';
import type { ListProductsQuery } from './catalog.schema';

export interface PaginatedList<T> {
  items: T[];
  nextCursor: string | null;
}

function decimalToMoney(value: Prisma.Decimal): Money {
  return value.toFixed(2) as Money;
}

function buildImageUrl(storedPath: string): string {
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

export interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
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

/**
 * Only ACTIVE, non-deleted products are ever returned publicly - DRAFT and
 * ARCHIVED products are invisible here regardless of filters.
 *
 * `minPrice`/`maxPrice` select products that have AT LEAST ONE (non-deleted)
 * SKU whose selling_price falls in range - they do NOT change which price is
 * displayed. The displayed `price` is always the minimum selling_price
 * across ALL of that product's (non-deleted) SKUs, independent of the
 * filter, matching a typical "from ₹X" storefront listing price.
 */
export async function listProducts(
  query: ListProductsQuery,
): Promise<PaginatedList<ProductListItem>> {
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
    status: 'ACTIVE',
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

  return { items: pageRows.map(toListItem), nextCursor };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'ACTIVE', deletedAt: null },
    include: {
      category: true,
      skus: { where: { deletedAt: null } },
      images: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
    },
  });

  if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found');
  }

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
