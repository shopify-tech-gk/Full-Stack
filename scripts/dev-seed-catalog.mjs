// DEV ONLY - seeds a SMALL sample catalog (30 products, 3 differently-shaped categories + their
// filter definitions) to prove the attribute-driven listing works generically. NOT the bulk
// import (docs/catalog/IMPORT-SPEC.md). Idempotent: re-running changes nothing already present.
// Usage: pnpm dev:seed-catalog
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;
if (env.NODE_ENV === 'production') {
  console.error('dev-seed-catalog is for local development only.');
  process.exit(1);
}

const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;
const json = (value) => `${lit(JSON.stringify(value))}::jsonb`;

// --- Categories + filter definitions (DATA - this is all a new category ever needs) ---------
const categories = [
  { slug: 'electronics', name: 'Electronics', parent: null },
  {
    slug: 'mobiles',
    name: 'Mobiles',
    parent: 'electronics',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'ram', label: 'RAM', type: 'multi_select', unit: 'GB', order: 2 },
      { key: 'storage', label: 'Storage', type: 'multi_select', unit: 'GB', order: 3 },
      { key: 'screen_size', label: 'Screen Size', type: 'range', unit: 'in', order: 4 },
      { key: 'network', label: 'Network', type: 'single_select', order: 5 },
    ],
  },
  {
    slug: 'baby-care',
    name: 'Baby Care',
    parent: null,
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'age_group', label: 'Age', type: 'multi_select', order: 2 },
    ],
  },
  {
    slug: 'baby-diaper',
    name: 'Baby Diaper',
    parent: 'baby-care',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'size', label: 'Size', type: 'multi_select', order: 2 },
      { key: 'pack_count', label: 'Count', type: 'range', unit: 'pcs', order: 3 },
      { key: 'age_group', label: 'Age', type: 'multi_select', order: 4 },
    ],
  },
  { slug: 'stainless-steel-vessels', name: 'Kitchenware', parent: null },
  {
    slug: 'water-bottle',
    name: 'Bottle and Flask',
    parent: 'stainless-steel-vessels',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'material', label: 'Material', type: 'single_select', order: 2 },
      { key: 'capacity_ml', label: 'Capacity', type: 'range', unit: 'ml', order: 3 },
      { key: 'insulated', label: 'Insulated', type: 'boolean', order: 4 },
    ],
  },
];

// --- Products: [title, category, mrp, price, rating, ratingCount, attributes] ---------------
const phones = [
  ['Samsung Galaxy M35 5G', 'Samsung', '8', '128', 6.6, '5G', 24999, 18999, 4.3, 812],
  ['Samsung Galaxy A15', 'Samsung', '6', '128', 6.5, '4G', 17999, 13499, 4.1, 540],
  ['Samsung Galaxy S23 FE', 'Samsung', '8', '256', 6.4, '5G', 64999, 39999, 4.5, 1210],
  ['Redmi Note 13 5G', 'Xiaomi', '8', '256', 6.67, '5G', 22999, 17999, 4.2, 2034],
  ['Redmi 13C', 'Xiaomi', '4', '64', 6.74, '4G', 10999, 7999, 3.9, 3120],
  ['Realme Narzo 70 Pro', 'Realme', '8', '128', 6.67, '5G', 21999, 17999, 4.0, 675],
  ['Realme C65', 'Realme', '4', '128', 6.67, '4G', 12999, 9999, 3.8, 402],
  ['OnePlus Nord CE 4', 'OnePlus', '8', '128', 6.7, '5G', 26999, 24999, 4.4, 1580],
  ['OnePlus 12R', 'OnePlus', '12', '256', 6.78, '5G', 45999, 39999, 4.6, 990],
  ['Apple iPhone 15', 'Apple', '6', '128', 6.1, '5G', 79900, 69900, 4.7, 4210],
  ['Apple iPhone 13', 'Apple', '4', '128', 6.1, '5G', 59900, 49900, 4.6, 8870],
  ['Samsung Galaxy M14', 'Samsung', '4', '64', 6.6, '5G', 14990, 10490, 4.0, 1120],
].map(([title, brand, ram, storage, screen, network, mrp, price, rating, count]) => ({
  title: `${title} (${ram}GB RAM, ${storage}GB)`,
  category: 'mobiles',
  mrp,
  price,
  rating,
  count,
  attributes: { brand, ram, storage, screen_size: screen, network, color: ['Black', 'Blue'] },
}));

const diapers = [
  ['Pampers Premium Care Pants', 'Pampers', 'M', 54, '6-12 months', 1299, 1049, 4.5],
  ['Pampers Baby Dry Pants', 'Pampers', 'L', 64, '12+ months', 1399, 999, 4.3],
  ['Pampers New Born Taped', 'Pampers', 'NB', 24, '0-3 months', 499, 399, 4.4],
  ['Huggies Wonder Pants', 'Huggies', 'M', 76, '6-12 months', 1499, 1099, 4.4],
  ['Huggies Complete Comfort', 'Huggies', 'S', 42, '3-6 months', 899, 699, 4.2],
  ['Huggies Dry Pants XL', 'Huggies', 'XL', 60, '12+ months', 1599, 1249, 4.1],
  ['MamyPoko Pants Extra Absorb', 'MamyPoko', 'L', 50, '12+ months', 1199, 849, 4.0],
  ['MamyPoko Pants Standard', 'MamyPoko', 'S', 36, '3-6 months', 649, 499, 3.9],
  ['Himalaya Total Care Pants', 'Himalaya', 'M', 30, '6-12 months', 699, 579, 4.0],
  ['Himalaya Total Care Newborn', 'Himalaya', 'NB', 20, '0-3 months', 399, 349, 3.8],
].map(([title, brand, size, packCount, age, mrp, price, rating]) => ({
  title: `${title} - ${size} (${packCount} Count)`,
  category: 'baby-diaper',
  mrp,
  price,
  rating,
  count: 150 + packCount * 7,
  attributes: {
    brand,
    size,
    pack_count: packCount,
    age_group: age,
    type: title.includes('Taped') ? 'Tape' : 'Pant',
  },
}));

const bottles = [
  ['Milton Thermosteel Flip Lid', 'Milton', 'Stainless Steel', 1000, true, 1245, 899, 4.4],
  ['Milton Aqua Fridge Bottle', 'Milton', 'Plastic', 1000, false, 299, 199, 4.0],
  ['Cello Swift Steel Bottle', 'Cello', 'Stainless Steel', 750, false, 499, 349, 4.1],
  ['Cello Duro Flask', 'Cello', 'Stainless Steel', 500, true, 899, 649, 4.2],
  ['Borosil Hydra Trek', 'Borosil', 'Stainless Steel', 700, true, 1190, 829, 4.3],
  ['Borosil Copper Bottle', 'Borosil', 'Copper', 950, false, 1590, 1199, 4.5],
  ['Milton Copper Charge', 'Milton', 'Copper', 1000, false, 1399, 999, 4.2],
  ['Cello Puro Classic', 'Cello', 'Plastic', 1000, false, 199, 149, 3.7],
].map(([title, brand, material, capacity, insulated, mrp, price, rating]) => ({
  title: `${title} ${capacity}ml`,
  category: 'water-bottle',
  mrp,
  price,
  rating,
  count: 80 + capacity / 10,
  attributes: { brand, material, capacity_ml: capacity, insulated },
}));

const products = [...phones, ...diapers, ...bottles];
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// --- SQL (idempotent: every insert is guarded by "not already there") ------------------------
const sql = ['BEGIN;'];
for (const c of categories) {
  const parent = c.parent
    ? `(SELECT id FROM catalog.category WHERE slug = ${lit(c.parent)} AND deleted_at IS NULL)`
    : 'NULL';
  sql.push(`INSERT INTO catalog.category (id, name, slug, parent_id, created_at, updated_at)
    SELECT gen_random_uuid(), ${lit(c.name)}, ${lit(c.slug)}, ${parent}, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM catalog.category WHERE slug = ${lit(c.slug)} AND deleted_at IS NULL);`);
  if (c.filters) {
    sql.push(`UPDATE catalog.category SET filter_definition = ${json(c.filters)}, updated_at = now()
      WHERE slug = ${lit(c.slug)} AND deleted_at IS NULL;`);
  }
}
products.forEach((p, index) => {
  const slug = `dev-${slugify(p.title)}`;
  // Staggered creation times so "newest" sorting is observable.
  const created = `now() - interval '${products.length - index} hours'`;
  sql.push(`INSERT INTO catalog.product (id, title, slug, description, seller_id, category_id, attributes,
      status, rating, rating_count, created_at, updated_at)
    SELECT gen_random_uuid(), ${lit(p.title)}, ${lit(slug)},
      ${lit(`${p.title}. Dev sample product for the attribute-driven catalog (W3).`)},
      ${lit(env.DEFAULT_SELLER_ID)}, c.id, ${json(p.attributes)}, 'ACTIVE', ${p.rating}, ${Math.round(p.count)},
      ${created}, now()
    FROM catalog.category c
    WHERE c.slug = ${lit(p.category)} AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM catalog.product WHERE slug = ${lit(slug)} AND deleted_at IS NULL);`);
  sql.push(`INSERT INTO catalog.sku (id, product_id, sku_code, mrp, selling_price, attributes, created_at, updated_at)
    SELECT gen_random_uuid(), p.id, ${lit(slug.toUpperCase())}, ${p.mrp}, ${p.price}, '{}'::jsonb, now(), now()
    FROM catalog.product p
    WHERE p.slug = ${lit(slug)} AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM catalog.sku WHERE sku_code = ${lit(slug.toUpperCase())} AND deleted_at IS NULL);`);
});
sql.push('COMMIT;');
sql.push(`SELECT c.slug, count(p.id) AS products FROM catalog.category c
  LEFT JOIN catalog.product p ON p.category_id = c.id AND p.deleted_at IS NULL AND p.slug LIKE 'dev-%'
  WHERE c.slug IN (${categories.map((c) => lit(c.slug)).join(',')}) GROUP BY c.slug ORDER BY c.slug;`);

const out = execFileSync(
  'docker',
  [
    'compose',
    '-f',
    'docker/docker-compose.yml',
    '--env-file',
    '.env',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    env.POSTGRES_USER,
    '-d',
    env.POSTGRES_DB,
    '-At',
  ],
  { cwd: root, input: sql.join('\n') },
).toString();
console.log(
  out
    .trim()
    .split('\n')
    .filter((line) => line.includes('|'))
    .join('\n'),
);

// --- Rebuild the search index through the real admin endpoint -------------------------------
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const payload = {
  typ: 'admin',
  role: 'SUPER_ADMIN',
  sub: '00000000-0000-4000-8000-000000000000',
  iss: env.JWT_ISSUER || 'youmart-auth',
  aud: env.JWT_AUDIENCE || 'youmart',
  iat: now,
  exp: now + 300,
};
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}`;
const signature = createSign('RSA-SHA256')
  .update(unsigned)
  .sign(Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('utf8'), 'base64url');
const gateway = env.GATEWAY_URL || 'http://localhost:4000';
const res = await fetch(`${gateway}/api/search/admin/reindex`, {
  method: 'POST',
  headers: { authorization: `Bearer ${unsigned}.${signature}` },
});
console.log(`search reindex: HTTP ${res.status} ${await res.text()}`);
