// Imports a product JSON delivery (an array of products, each with "Target Name", "Title", "Brand",
// prices, "Weight Variants", images...) into the catalog, following docs/catalog/IMPORT-SPEC.md:
//   - every product goes into its "Target Name" category (scripts/data/import-targets.mjs - the
//     chain of catalog categories + that category's filter definition); "Category Path" is ignored;
//   - every other field becomes product data: title, description, brand / model / colour / weight /
//     dimensions attributes (shown under Specifications), plus filter attributes derived from it;
//   - each "... Variants" entry is a SKU of the one product (its own price, id, title, image, and
//     the options that tell it apart - style name, weight...);
//   - main + gallery images, 50 units of stock per SKU, then one search reindex.
// Idempotent: products are matched by their Youmart_Product_ID (in the slug) and SKUs by sku_code,
// so re-running updates them instead of duplicating.
// Usage: node scripts/import-products-json.mjs <file.json> [--dry-run]
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGETS } from './data/import-targets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;
if (env.NODE_ENV === 'production') {
  console.error('This importer is for development data loads only.');
  process.exit(1);
}
const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (!file) {
  console.error('Usage: node scripts/import-products-json.mjs <file.json> [--dry-run]');
  process.exit(1);
}

const STOCK_PER_SKU = 50;
const DISCOUNT_BANDS = [10, 25, 40, 50, 70];
/** Fields of a variant entry that aren't its option name ("Weight", "Style Name", ...). */
const VARIANT_META = new Set([
  'Selling Price (INR)',
  'MRP (INR)',
  'Discount (%)',
  'Youmart_Product_ID',
  'Title',
  'Image URL',
]);
/** Option values that don't tell variants apart ("(Pack of 1)", a bare "2"): not a real option. */
const NOISE_OPTION = /^\(?\s*pack\s+of\s+\d+\s*\)?$|^\d+(\.\d+)?$/i;
const snake = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

// --- helpers ----------------------------------------------------------------------------------
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const jsonb = (v) => `${lit(JSON.stringify(v))}::jsonb`;
const money = (n) => Number(n).toFixed(2);
const clean = (s) =>
  typeof s === 'string' ? s.replace(/�/g, '-').replace(/\s+/g, ' ').trim() || null : (s ?? null);
const slugify = (t) =>
  t
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
/** "WHITE" / "green and white" -> "White" / "Green And White": one spelling per filter option. */
const titleCase = (s) =>
  s?.toLowerCase().replace(/(^|[\s&/-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()) ?? null;
/** Attribute values: no commas or backticks (IMPORT-SPEC §4.2), max 100 chars. */
const attrValue = (s) => clean(s)?.replace(/[,`]/g, ' ').replace(/\s+/g, ' ').slice(0, 100) ?? null;

/** "950 Grams" / "5 Kilograms" / "1 kg (Pack of 2)" -> kilograms, or null. */
function kilograms(text) {
  if (!text) return null;
  const m = /(\d+(?:\.\d+)?)\s*(kg|kilograms?|kgs|g|grams?|gm|gms)\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return /^k/i.test(m[2]) ? n : n / 1000;
}

/** "1 kg (Pack of 2) 1 kg" -> "1 kg (Pack of 2)"; "5000 Grams" -> "5 kg"; "900 Grams" -> "900 g". */
function variantLabel(raw) {
  let s = clean(raw) ?? '';
  const first = /^(\d+(?:\.\d+)?\s*\w+)/.exec(s)?.[1];
  if (first && s.length > first.length && s.endsWith(` ${first}`)) {
    s = s.slice(0, -first.length - 1).trim();
  }
  const plain = /^(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|grams?|gms?|g)$/i.exec(s);
  if (plain) {
    const kg = /^k/i.test(plain[2]) ? Number(plain[1]) : Number(plain[1]) / 1000;
    return kg >= 1 ? `${+kg.toFixed(2)} kg` : `${Math.round(kg * 1000)} g`;
  }
  return s.slice(0, 100);
}

/**
 * Which option fields really tell this product's variants apart, in picker order (style before
 * weight). A field whose values are all the same, or only noise ("(Pack of 1)", "2"), is dropped;
 * a later field is kept only if it varies within the earlier ones' choices (a kit's "Weight" that
 * is just each kit's shipping weight isn't a second picker).
 */
function optionDims(optionsList) {
  const keys = [...new Set(optionsList.flatMap((o) => Object.keys(o)))].sort(
    (a, b) => (a === 'weight') - (b === 'weight'),
  );
  const norm = (v) => (v ?? '').toLowerCase().replace(/\s+/g, '');
  const dims = [];
  for (const key of keys) {
    const values = optionsList.map((o) => o[key]).filter(Boolean);
    if (new Set(values.map(norm)).size < 2) continue;
    if (key !== 'weight' && values.every((v) => NOISE_OPTION.test(v.trim()))) continue;
    if (dims.length) {
      const groups = new Map();
      for (const o of optionsList) {
        const g = dims.map((d) => norm(o[d])).join('|');
        groups.set(g, (groups.get(g) ?? new Set()).add(norm(o[key])));
      }
      if (![...groups.values()].some((set) => set.size > 1)) continue;
    }
    dims.push(key);
  }
  return dims;
}

const pick = (options, dims) =>
  Object.fromEntries(dims.filter((d) => options[d]).map((d) => [d, options[d]]));
const httpsUrl = (u) => (clean(u) && /^https:\/\//.test(clean(u)) ? clean(u) : null);

function weightBand(kg) {
  if (kg == null) return null;
  if (kg <= 1) return 'Up to 1 kg';
  if (kg <= 5) return '1 - 5 kg';
  if (kg <= 10) return '5 - 10 kg';
  if (kg <= 25) return '10 - 25 kg';
  return 'Above 25 kg';
}

// --- read + map --------------------------------------------------------------------------------
const items = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(items)) throw new Error('Expected a JSON array of products');

const problems = [];
const products = [];
const categoriesNeeded = new Map();
const seenSku = new Set();

for (const [index, p] of items.entries()) {
  const where = `#${index + 1} (${p.Youmart_Product_ID ?? 'no id'})`;
  const target = TARGETS[String(p['Target Name'] ?? '').trim()];
  if (!target) {
    problems.push(
      `${where}: no import target for "${p['Target Name']}" (add it to scripts/data/import-targets.mjs)`,
    );
    continue;
  }
  const title = clean(p.Title);
  const id = clean(p.Youmart_Product_ID);
  const price = Number(p['Selling Price (INR)']);
  if (!title || !id || !(price > 0)) {
    problems.push(`${where}: missing title / id / price - skipped`);
    continue;
  }
  categoriesNeeded.set(p['Target Name'], target);
  const discount = Number(p['Discount (%)']) || 0;
  const mrp = Math.max(Number(p['MRP (INR)']) || price, price);

  // Variants -> SKUs. Any "<Option> Variants" list counts: each entry is one sellable option of
  // this ONE product. Its option fields ("Style Name", "Weight", "Size"...) are kept only where they
  // tell the variants apart (optionDims); its own title / image show when it's picked. The variant
  // matching the product's own price takes its MRP; the others get the product's discount applied
  // backwards (unless the entry carries its own MRP).
  const allVariants = Object.entries(p)
    .filter(([key, list]) => /variants$/i.test(key) && Array.isArray(list))
    .flatMap(([, list]) => list)
    .filter((v) => v && typeof v === 'object' && v.Youmart_Product_ID)
    .map((v) => {
      const options = {};
      for (const [k, raw] of Object.entries(v)) {
        if (VARIANT_META.has(k) || raw == null || typeof raw === 'object') continue;
        const key = snake(k);
        const label =
          key === 'weight' ? variantLabel(String(raw)) : clean(String(raw))?.slice(0, 100);
        if (label) options[key] = label;
      }
      return { v, options, title: clean(v.Title), image: httpsUrl(v['Image URL']) };
    });
  const dims = optionDims(allVariants.map((x) => x.options));
  const sellable = allVariants.filter(({ v }) => Number(v['Selling Price (INR)']) > 0);
  // A variant the delivery gives no price for can't be sold, but it's still kept: the product page
  // lists it as "Currently unavailable" (like Amazon) until a re-import prices it.
  const unavailable = allVariants
    .filter(({ v }) => !(Number(v['Selling Price (INR)']) > 0))
    .map(({ options }) => pick(options, dims))
    .filter((o) => Object.keys(o).length > 0);
  // No variants: the product is its own single SKU (no option picker on the page).
  const single = {
    v: { 'Selling Price (INR)': price, Youmart_Product_ID: id },
    options: { weight: variantLabel(p['Item Weight']) },
    title: null,
    image: null,
  };
  const skus = (sellable.length ? sellable : [single])
    .map(({ v, options, title: vTitle, image }) => {
      const sp = Number(v['Selling Price (INR)']);
      const ownMrp = Number(v['MRP (INR)']);
      const vMrp =
        ownMrp >= sp
          ? ownMrp
          : Math.abs(sp - price) < 0.005
            ? mrp
            : discount > 0 && discount < 95
              ? Math.max(sp, Math.round((sp / (1 - discount / 100)) * 100) / 100)
              : sp;
      const shown = sellable.length ? pick(options, dims) : pick(options, ['weight']);
      return {
        code: clean(v.Youmart_Product_ID),
        price: money(sp),
        mrp: money(vMrp),
        // `_title` / `_image`: the variant's own title and picture (not options).
        attributes: {
          ...shown,
          ...(sellable.length > 1 && vTitle ? { _title: vTitle.slice(0, 300) } : {}),
          ...(sellable.length > 1 && image ? { _image: image } : {}),
        },
        kg: kilograms(options.weight),
      };
    })
    .filter((s) => {
      if (seenSku.has(s.code)) {
        problems.push(`${where}: duplicate SKU code ${s.code} - skipped that variant`);
        return false;
      }
      seenSku.add(s.code);
      return true;
    });
  if (skus.length === 0) continue;

  const description = clean(p.Description);
  const text = `${title} ${(description ?? '').slice(0, 400)}`.toLowerCase();
  const kg = kilograms(p['Item Weight']) ?? kilograms(title) ?? skus.find((s) => s.kg)?.kg ?? null;

  const attributes = {
    brand: attrValue(p.Brand),
    model_number: attrValue(p['Model Number']),
    // Consistent casing so "blue" / "Blue" are one filter option.
    color: titleCase(attrValue(p.Color)),
    item_weight: attrValue(p['Item Weight']),
    item_dimensions: attrValue(p['Item Dimensions']),
    // Option combinations without a price (shown greyed out on the product page).
    unavailable_variants: unavailable.length ? unavailable : null,
    pack_sizes:
      skus.length > 1 && dims.includes('weight')
        ? [...new Set(skus.map((s) => attrValue(s.attributes.weight)).filter(Boolean))]
        : null,
    // Every pack size's band, so a 1 kg + 5 kg product shows under both.
    weight_band: [
      ...new Set(
        (skus.some((x) => x.kg) ? skus.map((x) => x.kg) : [kg]).map(weightBand).filter(Boolean),
      ),
    ],
    discount_band: DISCOUNT_BANDS.filter((b) => discount >= b).map((b) => `${b}% off or more`),
    ...target.derive(p, text),
  };
  for (const [k, v] of Object.entries(attributes)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) delete attributes[k];
  }

  const gallery =
    clean(p['Gallery Image URLs'])
      ?.split('|')
      .map((u) => u.trim()) ?? [];
  const images = [...new Set([clean(p['Main Image URL']) ?? clean(p.image_url), ...gallery])]
    .filter((u) => u && /^https:\/\//.test(u))
    .slice(0, 8);

  products.push({
    slug: `${slugify(title)}-${id.toLowerCase()}`,
    title: title.slice(0, 300),
    description: description?.slice(0, 5000) ?? null,
    category: target.chain[target.chain.length - 1][0],
    attributes,
    skus,
    images,
  });
}

console.log(`read ${items.length} products -> ${products.length} to import, ${seenSku.size} SKUs`);
if (problems.length) console.log(`notes:\n  ${problems.join('\n  ')}`);
if (dryRun) {
  console.log(JSON.stringify(products.slice(0, 2), null, 2));
  process.exit(0);
}

// --- SQL (one transaction; every write is an upsert) -----------------------------------------
const sql = ['BEGIN;'];
for (const target of categoriesNeeded.values()) {
  target.chain.forEach(([slug, name], i) => {
    const parent = i === 0 ? null : target.chain[i - 1][0];
    const parentId = parent
      ? `(SELECT id FROM catalog.category WHERE slug = ${lit(parent)} AND deleted_at IS NULL)`
      : 'NULL';
    sql.push(`INSERT INTO catalog.category (id, name, slug, parent_id, created_at, updated_at)
      SELECT gen_random_uuid(), ${lit(name)}, ${lit(slug)}, ${parentId}, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM catalog.category WHERE slug = ${lit(slug)} AND deleted_at IS NULL);`);
  });
  const leaf = target.chain[target.chain.length - 1][0];
  sql.push(`UPDATE catalog.category SET filter_definition = ${jsonb(target.filters)}, updated_at = now()
    WHERE slug = ${lit(leaf)} AND deleted_at IS NULL;`);
}

products.forEach((p, i) => {
  const cat = `(SELECT id FROM catalog.category WHERE slug = ${lit(p.category)} AND deleted_at IS NULL)`;
  // Staggered times keep the delivery order for "newest" sorting.
  const created = `now() - interval '${products.length - i} seconds'`;
  sql.push(`INSERT INTO catalog.product (id, title, slug, description, seller_id, category_id, attributes,
      status, rating_count, created_at, updated_at)
    SELECT gen_random_uuid(), ${lit(p.title)}, ${lit(p.slug)}, ${p.description ? lit(p.description) : 'NULL'},
      ${lit(env.DEFAULT_SELLER_ID)}, ${cat}, ${jsonb(p.attributes)}, 'ACTIVE', 0, ${created}, now()
    WHERE NOT EXISTS (SELECT 1 FROM catalog.product WHERE slug = ${lit(p.slug)} AND deleted_at IS NULL);`);
  sql.push(`UPDATE catalog.product SET title = ${lit(p.title)},
      description = ${p.description ? lit(p.description) : 'NULL'}, category_id = ${cat},
      attributes = ${jsonb(p.attributes)}, status = 'ACTIVE', updated_at = now()
    WHERE slug = ${lit(p.slug)} AND deleted_at IS NULL;`);
  const pid = `(SELECT id FROM catalog.product WHERE slug = ${lit(p.slug)} AND deleted_at IS NULL)`;
  for (const s of p.skus) {
    sql.push(`INSERT INTO catalog.sku (id, product_id, sku_code, mrp, selling_price, attributes, created_at, updated_at)
      SELECT gen_random_uuid(), ${pid}, ${lit(s.code)}, ${s.mrp}, ${s.price}, ${jsonb(s.attributes)}, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM catalog.sku WHERE sku_code = ${lit(s.code)} AND deleted_at IS NULL);`);
    sql.push(`UPDATE catalog.sku SET product_id = ${pid}, mrp = ${s.mrp}, selling_price = ${s.price},
        attributes = ${jsonb(s.attributes)}, updated_at = now()
      WHERE sku_code = ${lit(s.code)} AND deleted_at IS NULL;`);
  }
  // Images are replaced per product (IMPORT-SPEC §6).
  sql.push(`UPDATE catalog.product_image SET deleted_at = now()
    WHERE product_id = ${pid} AND deleted_at IS NULL;`);
  p.images.forEach((url, position) => {
    sql.push(`INSERT INTO catalog.product_image (id, product_id, url, position, created_at, updated_at)
      VALUES (gen_random_uuid(), ${pid}, ${lit(url)}, ${position}, now(), now());`);
  });
});
sql.push('COMMIT;');
const codes = products.flatMap((p) => p.skus.map((s) => lit(s.code))).join(',');
sql.push(`SELECT 'STOCK', s.id, s.sku_code FROM catalog.sku s
  WHERE s.sku_code IN (${codes}) AND s.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM inventory.stock_level l WHERE l.sku_id = s.id::text AND l.deleted_at IS NULL);`);
for (const target of categoriesNeeded.values()) {
  const leaf = target.chain[target.chain.length - 1][0];
  sql.push(`SELECT 'COUNT', ${lit(leaf)}, count(*) FROM catalog.product p JOIN catalog.category c ON c.id = p.category_id
    WHERE c.slug = ${lit(leaf)} AND p.deleted_at IS NULL AND p.status = 'ACTIVE';`);
}

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
  { cwd: root, input: sql.join('\n'), maxBuffer: 64 * 1024 * 1024 },
).toString();
const rows = out.trim().split('\n');
rows
  .filter((l) => l.startsWith('COUNT|'))
  .forEach((l) => {
    const [, slug, n] = l.split('|');
    console.log(`category ${slug}: ${n} active products`);
  });
const unstocked = rows
  .filter((l) => l.startsWith('STOCK|'))
  .map((l) => {
    const [, id, code] = l.split('|');
    return { id, code };
  });

// --- Admin token (dev: minted with the local signing key, like dev-seed-catalog) ------------
const b64 = (v) => Buffer.from(JSON.stringify(v)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
  typ: 'admin',
  role: 'SUPER_ADMIN',
  sub: '00000000-0000-4000-8000-000000000000',
  iss: env.JWT_ISSUER || 'youmart-auth',
  aud: env.JWT_AUDIENCE || 'youmart',
  iat: now,
  exp: now + 600,
})}`;
const signature = createSign('RSA-SHA256')
  .update(unsigned)
  .sign(Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('utf8'), 'base64url');
const authorization = `Bearer ${unsigned}.${signature}`;
const gateway = env.GATEWAY_URL || 'http://localhost:4000';

// The gateway rate-limits every caller (RATE_LIMIT_MAX per minute, 300 by default): calls are paced
// under that, and a 429 waits for the window to pass and retries - a big delivery (hundreds of new
// SKUs) otherwise loses its stock and the final reindex.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PACE_MS = Math.ceil(60_000 / Math.max(1, Number(env.RATE_LIMIT_MAX) || 300)) + 20;
async function gatewayPost(url, init) {
  for (let attempt = 0; ; attempt++) {
    await sleep(PACE_MS);
    const res = await fetch(url, { method: 'POST', ...init });
    if (res.status !== 429 || attempt >= 6) return res;
    const wait = (Number(res.headers.get('retry-after')) || 20) * 1000;
    console.log(`rate limited - waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }
}

// --- Stock for new SKUs (existing stock is never reset) ---------------------------------------
let stocked = 0;
for (const { id, code } of unstocked) {
  const res = await gatewayPost(`${gateway}/api/inventory/${id}/set`, {
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ available: STOCK_PER_SKU }),
  });
  if (res.ok) stocked++;
  else console.log(`stock ${code}: HTTP ${res.status} ${await res.text()}`);
}
console.log(`stock set for ${stocked} new SKU(s)`);

// --- Search index rebuilt once -------------------------------------------------------------------
const re = await gatewayPost(`${gateway}/api/search/admin/reindex`, { headers: { authorization } });
console.log(`search reindex: HTTP ${re.status} ${(await re.text()).slice(0, 200)}`);
