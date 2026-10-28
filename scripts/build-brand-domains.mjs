#!/usr/bin/env node
// Builds packages/shared-client/src/brand-domains.data.ts: brand name -> official website domain.
// The app turns a domain into a hotlinked Brandfetch Logo API URL (see apps/mobile/src/lib/brand-logos.ts).
//
//   1. scripts/data/brand-domains.manual.json is the curated source (null = never guess).
//   2. Brands not listed there get likely domains guessed (<name>.com / .in / .co.in / <name>india.com).
//   3. Every domain is checked against the brand's OWN homepage: the page title / site name must
//      mention the brand. Guesses that don't match are dropped; manual entries that don't match are
//      kept but listed in the report for review.
//
// Usage: node scripts/build-brand-domains.mjs [--report <file>]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BRANDS_TS = resolve(ROOT, 'packages/shared-client/src/category-brands.data.ts');
const MANUAL = resolve(ROOT, 'scripts/data/brand-domains.manual.json');
const OUT = resolve(ROOT, 'packages/shared-client/src/brand-domains.data.ts');
const reportArg = process.argv.indexOf('--report');
const REPORT = reportArg > 0 ? resolve(process.argv[reportArg + 1]) : null;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const PARKED =
  /domain (is )?for sale|buy this domain|parked free|this domain may be for sale|hugedomains|sedo\.com/i;

const compact = (s) =>
  s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

function loadExcelBrands() {
  const src = readFileSync(BRANDS_TS, 'utf8');
  const names = src.match(/CATEGORY_BRAND_NAMES[^=]*=\s*(\[[\s\S]*?\]);/);
  const index = src.match(/CATEGORY_BRAND_INDEX[^=]*=\s*(\{[\s\S]*?\});/);
  if (!names || !index) throw new Error('CATEGORY_BRAND_NAMES / CATEGORY_BRAND_INDEX not found');
  const list = new Function(`return ${names[1]}`)();
  const mains = new Map();
  for (const [path, ids] of Object.entries(new Function(`return ${index[1]}`)())) {
    for (const i of ids) {
      if (!mains.has(list[i])) mains.set(list[i], new Set());
      mains.get(list[i]).add(path.split('/')[0]);
    }
  }
  return { list, mains };
}

function guesses(brand) {
  const c = compact(brand);
  if (c.length < 4) return [];
  const dashed = brand
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const out = [`${c}.com`, `${c}.in`, `${c}.co.in`, `${c}india.com`];
  if (dashed !== c) out.push(`${dashed}.com`);
  return out;
}

// Words a homepage of a brand in each main category is expected to use (title / description).
const CATEGORY_WORDS = {
  'agri-and-gardening': [
    'garden',
    'plant',
    'seed',
    'agri',
    'farm',
    'fertili',
    'crop',
    'irrigation',
    'pot',
  ],
  'artificial-flowers-and-plants': ['flower', 'plant', 'decor', 'home', 'gift', 'vase'],
  'arts-and-crafts': ['art', 'craft', 'paint', 'colour', 'color', 'stationer', 'hobby', 'diy'],
  'auto-accessories': ['car', 'bike', 'auto', 'motor', 'vehicle', 'tyre', 'helmet', 'riding'],
  'baby-care': ['baby', 'kid', 'child', 'mom', 'mother', 'toy', 'infant', 'toddler'],
  'bath-fittings': ['bath', 'faucet', 'tap', 'sanitary', 'shower', 'tile', 'kitchen', 'plumb'],
  'cleaning-products': [
    'clean',
    'home',
    'kitchen',
    'hygiene',
    'mop',
    'eco',
    'tableware',
    'detergent',
  ],
  clothing: [
    'fashion',
    'wear',
    'cloth',
    'apparel',
    'shirt',
    'kurta',
    'saree',
    'dress',
    'shoe',
    'ethnic',
  ],
  cosmetics: [
    'beauty',
    'skin',
    'makeup',
    'cosmetic',
    'hair',
    'care',
    'groom',
    'fragrance',
    'perfume',
  ],
  'electrical-and-lights': ['light', 'led', 'electric', 'switch', 'wire', 'cable', 'lamp', 'fan'],
  electronics: [
    'electronic',
    'audio',
    'gadget',
    'mobile',
    'speaker',
    'headphone',
    'earbud',
    'camera',
    'tech',
    'computer',
  ],
  'fashion-jewellery': ['jewel', 'earring', 'necklace', 'fashion', 'silver', 'gold', 'accessor'],
  footwear: ['shoe', 'footwear', 'sandal', 'sneaker', 'slipper', 'heel'],
  furniture: ['furniture', 'sofa', 'bed', 'home', 'chair', 'table', 'mattress', 'decor'],
  'gifts-frames': ['gift', 'frame', 'personali', 'trophy', 'surprise'],
  hardwares: ['hardware', 'lock', 'tool', 'fastener', 'fitting', 'safety', 'adhesive', 'screw'],
  'home-appliances': ['appliance', 'kitchen', 'home', 'cooler', 'fan', 'mixer', 'water'],
  'home-furnishing': [
    'home',
    'bed',
    'curtain',
    'furnish',
    'decor',
    'linen',
    'cushion',
    'carpet',
    'rug',
  ],
  kitchenware: [
    'kitchen',
    'cook',
    'serve',
    'bottle',
    'lunch',
    'container',
    'home',
    'tableware',
    'cutlery',
    'party',
  ],
  'musical-instruments': [
    'music',
    'instrument',
    'guitar',
    'piano',
    'drum',
    'keyboard',
    'audio',
    'toy',
  ],
  'party-decorations': ['party', 'balloon', 'decor', 'celebrat', 'birthday', 'gift', 'surprise'],
  'pet-supplies': ['pet', 'dog', 'cat', 'aquarium', 'animal'],
  religion: [
    'puja',
    'pooja',
    'spiritual',
    'religio',
    'rudraksha',
    'god',
    'book',
    'attar',
    'perfume',
    'handicraft',
    'idol',
  ],
  'sports-fitness': ['sport', 'fitness', 'gym', 'cricket', 'cycle', 'bike', 'yoga', 'outdoor'],
  stationary: ['stationer', 'pen', 'pencil', 'paper', 'office', 'school', 'notebook'],
  'tailoring-materials': ['thread', 'sew', 'tailor', 'fabric', 'button', 'zip', 'textile'],
  tools: ['tool', 'garden', 'drill', 'power', 'hand tool', 'measur', 'hardware'],
  'toys-games': ['toy', 'game', 'kid', 'puzzle', 'learn', 'stem', 'play'],
  'travel-accessories': ['travel', 'bag', 'luggage', 'backpack', 'trolley', 'wallet', 'suitcase'],
  'wall-clock-watches': ['watch', 'clock', 'time'],
};

/** Does the homepage identify itself as this brand? (host counts only for curated entries) */
function matches(brand, page, { useHost = true } = {}) {
  const hay = compact(`${page.title} ${page.siteName} ${useHost ? page.host : ''}`);
  const c = compact(brand);
  if (c && hay.includes(c)) return true;
  // "Kuber Industries Cleaning" -> kuberindustries.co.in: accept the leading words of the name.
  const words = brand.split(/\s+/).map(compact).filter(Boolean);
  for (let n = words.length - 1; n >= 1; n--) {
    const head = words.slice(0, n).join('');
    if (head.length >= 4 && hay.includes(head)) return true;
  }
  return false;
}

async function fetchPage(domain) {
  let lastErr = '';
  for (const url of [`https://${domain}/`, `https://www.${domain}/`]) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      });
      const html = (await res.text()).slice(0, 400_000);
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
      const meta = (prop) =>
        html.match(
          new RegExp(`(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)`, 'i'),
        )?.[1] ??
        html.match(
          new RegExp(`content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
        )?.[1] ??
        '';
      const siteName = meta('og:site_name');
      return {
        status: res.status,
        title,
        siteName,
        description: `${meta('description')} ${meta('og:description')}`,
        host: new URL(res.url).hostname,
        parked: PARKED.test(html.slice(0, 60_000)),
      };
    } catch (e) {
      lastErr = e?.cause?.code ?? e?.name ?? String(e);
    }
  }
  return { error: lastErr };
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }),
  );
  return out;
}

/**
 * Brands on live catalog products (imports bring brands the category sheet never listed), with the
 * storefront main each sells under. Read from the dev database; skipped when it isn't reachable.
 */
function loadCatalogBrands() {
  // Catalog root slugs that differ from the taxonomy mains CATEGORY_WORDS is keyed by.
  const ROOT_ALIAS = { 'lawn-and-gardening': 'agri-and-gardening' };
  try {
    process.loadEnvFile(resolve(ROOT, '.env'));
    const sql = `WITH RECURSIVE up AS (
        SELECT id, parent_id, slug FROM catalog.category WHERE deleted_at IS NULL
      ), roots AS (
        SELECT id, id AS leaf, parent_id, slug FROM up
        UNION ALL SELECT u.id, r.leaf, u.parent_id, u.slug FROM roots r JOIN up u ON u.id = r.parent_id
      )
      SELECT DISTINCT p.attributes->>'brand', r.slug
      FROM catalog.product p JOIN roots r ON r.leaf = p.category_id AND r.parent_id IS NULL
      WHERE p.deleted_at IS NULL AND p.status = 'ACTIVE' AND coalesce(p.attributes->>'brand', '') <> '';`;
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
        '-U',
        process.env.POSTGRES_USER,
        '-d',
        process.env.POSTGRES_DB,
        '-At',
      ],
      { cwd: ROOT, input: sql },
    ).toString();
    return out
      .trim()
      .split('\n')
      .filter((l) => l.includes('|'))
      .map((l) => {
        const i = l.lastIndexOf('|');
        const root = l.slice(i + 1);
        return { brand: l.slice(0, i).trim(), main: ROOT_ALIAS[root] ?? root };
      });
  } catch (e) {
    console.warn(`catalog brands skipped (${e.message.split('\n')[0]})`);
    return [];
  }
}

const { list: excel, mains: brandMains } = loadExcelBrands();
// Catalog brands join the sheet's (case-insensitively - the sheet's spelling wins).
const excelLower = new Set(excel.map((b) => b.toLowerCase()));
for (const { brand, main } of loadCatalogBrands()) {
  if (!excelLower.has(brand.toLowerCase())) {
    excel.push(brand);
    excelLower.add(brand.toLowerCase());
  }
  if (!brandMains.has(brand)) brandMains.set(brand, new Set());
  brandMains.get(brand).add(main);
}
const manualRaw = JSON.parse(readFileSync(MANUAL, 'utf8'));
delete manualRaw._comment;
const manual = new Map(Object.entries(manualRaw));
const excelSet = new Set(excel);
const unknownManual = [...manual.keys()].filter((k) => !excelSet.has(k));
const all = [...excel, ...unknownManual];

let done = 0;
const results = await pool(all, 16, async (brand) => {
  let r;
  if (manual.has(brand)) {
    const domain = manual.get(brand);
    if (!domain) r = { brand, source: 'manual', verdict: 'skip' };
    else {
      const page = await fetchPage(domain);
      const verdict = page.error
        ? /ENOTFOUND|EAI_AGAIN/.test(page.error)
          ? 'dead'
          : 'unreachable'
        : page.parked
          ? 'parked'
          : matches(brand, page)
            ? 'ok'
            : page.status >= 400
              ? 'blocked'
              : 'mismatch';
      r = { brand, source: 'manual', domain, verdict, page };
    }
  } else {
    r = { brand, source: 'guess', verdict: 'none' };
    const words = [...(brandMains.get(brand) ?? [])].flatMap((m) => CATEGORY_WORDS[m] ?? []);
    for (const domain of guesses(brand)) {
      const page = await fetchPage(domain);
      const text =
        `${page.title ?? ''} ${page.siteName ?? ''} ${page.description ?? ''}`.toLowerCase();
      if (
        !page.error &&
        !page.parked &&
        page.status < 400 &&
        matches(brand, page, { useHost: false }) &&
        words.some((w) => text.includes(w))
      ) {
        r = { brand, source: 'guess', domain, verdict: 'ok', page };
        break;
      }
    }
  }
  if (++done % 100 === 0) process.stderr.write(`  ${done}/${all.length}\n`);
  return r;
});

// Curated entries are trusted unless the domain is parked (DNS lookups from Node can flake, so a
// failed lookup is only reported); guesses are kept only when verified.
const keep = results.filter(
  (r) => r.domain && (r.source === 'manual' ? r.verdict !== 'parked' : r.verdict === 'ok'),
);
const map = Object.fromEntries(
  keep.map((r) => [r.brand.trim().toLowerCase(), r.domain]).sort(([a], [b]) => a.localeCompare(b)),
);

writeFileSync(
  OUT,
  `// Generated by scripts/build-brand-domains.mjs from scripts/data/brand-domains.manual.json
// (verified against each brand's own homepage). Do not edit by hand.
// Lower-cased brand name -> official website domain (fed to the Brandfetch Logo API).
export const BRAND_DOMAINS: Readonly<Record<string, string>> = ${JSON.stringify(map, null, 2)};
`,
);

const count = (pred) => results.filter(pred).length;
console.log(
  `brands=${all.length} mapped=${keep.length} | manual ok=${count((r) => r.source === 'manual' && r.verdict === 'ok')} ` +
    `mismatch=${count((r) => r.verdict === 'mismatch')} blocked/unreachable=${count((r) => ['blocked', 'unreachable'].includes(r.verdict))} ` +
    `dead/parked=${count((r) => ['dead', 'parked'].includes(r.verdict))} skip=${count((r) => r.verdict === 'skip')} | ` +
    `guessed ok=${count((r) => r.source === 'guess' && r.verdict === 'ok')} none=${count((r) => r.verdict === 'none')}`,
);
if (REPORT) {
  writeFileSync(
    REPORT,
    results
      .map((r) =>
        [
          r.verdict,
          r.source,
          r.brand,
          r.domain ?? '',
          r.page?.status ?? r.page?.error ?? '',
          r.page?.host ?? '',
          (r.page?.title ?? '').replace(/\s+/g, ' ').slice(0, 90),
        ].join('\t'),
      )
      .join('\n'),
  );
  console.log(`report -> ${REPORT}`);
}
