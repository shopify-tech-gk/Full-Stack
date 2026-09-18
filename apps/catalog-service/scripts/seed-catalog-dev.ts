import path from 'node:path';
import { prisma, close } from '../src/db';

// Same repo-root .env pattern as the service itself.
process.loadEnvFile(path.resolve(__dirname, '../../../.env'));

// catalog_svc cannot read the sellers schema (cross-schema isolation is
// enforced at the database level, by design) - the default seller's id is
// looked up ONCE via the owner role (psql) and passed in here as a plain
// dev-only env var. This script is local-testing tooling only, separate
// from the Ch2 main db:seed, and never wired into it.
const DEFAULT_SELLER_ID = process.env['DEFAULT_SELLER_ID'];

if (!DEFAULT_SELLER_ID) {
  throw new Error('DEFAULT_SELLER_ID env var is required to run this dev seed script');
}

interface CategorySeed {
  name: string;
  slug: string;
}

interface SkuSeed {
  skuCode: string;
  mrp: string;
  sellingPrice: string;
  attributes: Record<string, unknown>;
}

interface ProductSeed {
  title: string;
  slug: string;
  description: string;
  categorySlug: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  attributes: Record<string, unknown>;
  skus: SkuSeed[];
  imagePath: string;
}

const CATEGORIES: CategorySeed[] = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Groceries', slug: 'groceries' },
];

const PRODUCTS: ProductSeed[] = [
  {
    title: 'Wireless Mouse',
    slug: 'wireless-mouse',
    description: 'A reliable 2.4GHz wireless mouse.',
    categorySlug: 'electronics',
    status: 'ACTIVE',
    attributes: { color: 'black' },
    skus: [
      {
        skuCode: 'MOUSE-BLK-01',
        mrp: '1499.00',
        sellingPrice: '999.00',
        attributes: { color: 'black' },
      },
    ],
    imagePath: 'dev/wireless-mouse.jpg',
  },
  {
    title: 'Mechanical Keyboard',
    slug: 'mechanical-keyboard',
    description: 'A tactile mechanical keyboard, available in two sizes.',
    categorySlug: 'electronics',
    status: 'ACTIVE',
    attributes: { switchType: 'blue' },
    skus: [
      {
        skuCode: 'KB-TKL-01',
        mrp: '4999.00',
        sellingPrice: '3999.00',
        attributes: { layout: 'TKL' },
      },
      {
        skuCode: 'KB-FULL-01',
        mrp: '5999.00',
        sellingPrice: '4799.00',
        attributes: { layout: 'Full-size' },
      },
    ],
    imagePath: 'dev/mechanical-keyboard.jpg',
  },
  {
    title: 'Basmati Rice 5kg',
    slug: 'basmati-rice-5kg',
    description: 'Premium aged basmati rice, 5kg pack.',
    categorySlug: 'groceries',
    status: 'ACTIVE',
    attributes: { weightKg: 5 },
    skus: [
      {
        skuCode: 'RICE-BAS-5KG',
        mrp: '650.00',
        sellingPrice: '549.00',
        attributes: { weightKg: 5 },
      },
    ],
    imagePath: 'dev/basmati-rice.jpg',
  },
  {
    title: 'Discontinued Widget',
    slug: 'discontinued-widget',
    description: 'A widget that is no longer sold - proves ARCHIVED products are hidden.',
    categorySlug: 'electronics',
    status: 'ARCHIVED',
    attributes: {},
    skus: [{ skuCode: 'WIDGET-OLD-01', mrp: '199.00', sellingPrice: '149.00', attributes: {} }],
    imagePath: 'dev/discontinued-widget.jpg',
  },
];

async function main(): Promise<void> {
  const categoryIdBySlug = new Map<string, string>();

  for (const categorySeed of CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { slug: categorySeed.slug, deletedAt: null },
    });

    if (existing) {
      console.log(`Category "${categorySeed.slug}" already exists (id=${existing.id}), skipping.`);
      categoryIdBySlug.set(categorySeed.slug, existing.id);
      continue;
    }

    const created = await prisma.category.create({
      data: { name: categorySeed.name, slug: categorySeed.slug },
    });
    console.log(`Created category "${categorySeed.slug}" (id=${created.id}).`);
    categoryIdBySlug.set(categorySeed.slug, created.id);
  }

  for (const productSeed of PRODUCTS) {
    const existingProduct = await prisma.product.findFirst({
      where: { slug: productSeed.slug, deletedAt: null },
    });

    if (existingProduct) {
      console.log(
        `Product "${productSeed.slug}" already exists (id=${existingProduct.id}), skipping.`,
      );
      continue;
    }

    const categoryId = categoryIdBySlug.get(productSeed.categorySlug);
    if (!categoryId) {
      throw new Error(
        `Unknown category slug "${productSeed.categorySlug}" for product "${productSeed.slug}"`,
      );
    }

    const created = await prisma.product.create({
      data: {
        title: productSeed.title,
        slug: productSeed.slug,
        description: productSeed.description,
        sellerId: DEFAULT_SELLER_ID,
        categoryId,
        attributes: productSeed.attributes,
        status: productSeed.status,
        skus: {
          create: productSeed.skus.map((sku) => ({
            skuCode: sku.skuCode,
            mrp: sku.mrp,
            sellingPrice: sku.sellingPrice,
            attributes: sku.attributes,
          })),
        },
        images: {
          create: [{ url: productSeed.imagePath, position: 0 }],
        },
      },
    });
    console.log(
      `Created product "${productSeed.slug}" (id=${created.id}, status=${productSeed.status}).`,
    );
  }
}

main()
  .then(async () => {
    await close();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await close();
    process.exit(1);
  });
