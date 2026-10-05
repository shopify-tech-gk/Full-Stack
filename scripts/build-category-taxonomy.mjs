// Builds packages/shared-client/src/category-taxonomy.data.ts (taxonomy + image registry) and
// docs/catalog/category-image-prompts.csv (one row per sub/sub-to-sub image, with a generation prompt).
// Usage: pnpm build:category-taxonomy - after replacing packages/shared-client/data/category-taxonomy.csv
// or adding images under apps/web/public/categories/explore/.
// CSV columns: main_category,sub_category,sub_to_sub_category - one row per sub-to-sub item.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(root, 'packages/shared-client/data/category-taxonomy.csv');
const TARGET = path.join(root, 'packages/shared-client/src/category-taxonomy.data.ts');
const PROMPTS = path.join(root, 'docs/catalog/category-image-prompts.csv');
const HEADER = ['main_category', 'sub_category', 'sub_to_sub_category'];

/** RFC 4180: quoted fields may hold commas, doubled quotes and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

const clean = (value) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\u2019/g, "'")
    .trim();

const [header, ...rows] = parseCsv(readFileSync(SOURCE, 'utf8').replace(/^\uFEFF/, ''));
if (header.map((h) => h.trim().toLowerCase()).join() !== HEADER.join()) {
  throw new Error(`Unexpected CSV header ${JSON.stringify(header)}; expected ${HEADER.join(',')}`);
}

/** Same rule as shared-client slugify(). */
const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Names that only differ in punctuation ("All Purpose" / "All-Purpose") are one item: slugs (and so
// image paths and links) must be unique under a parent, so later spellings are dropped and reported.
const tree = new Map();
const dropped = [];
rows.forEach((cells, index) => {
  const [main, sub, leaf] = cells.map(clean);
  if (!main || !sub) {
    throw new Error(`Row ${index + 2}: main_category and sub_category are required`);
  }
  if (!tree.has(main)) tree.set(main, new Map());
  const subs = tree.get(main);
  const sameSub = [...subs.keys()].find((name) => slugify(name) === slugify(sub));
  if (sameSub && sameSub !== sub) dropped.push(`${main} / "${sub}" (kept "${sameSub}")`);
  const subName = sameSub ?? sub;
  if (!subs.has(subName)) subs.set(subName, []);
  const leaves = subs.get(subName);
  const sameLeaf = leaf && leaves.find((name) => slugify(name) === slugify(leaf));
  if (sameLeaf && sameLeaf !== leaf)
    dropped.push(`${main} / ${subName} / "${leaf}" (kept "${sameLeaf}")`);
  if (leaf && !sameLeaf) leaves.push(leaf);
});

// Category artwork dropped into apps/web/public/categories/explore/:
//   <main>.webp (desktop landscape) | <main>/<sub>.webp | <main>/<sub>/<sub-to-sub>.webp (portrait 2:3)
const IMAGE_DIR = path.join(root, 'apps/web/public/categories/explore');
const IMAGE_EXT = /\.(webp|png|jpe?g|avif)$/i;
const images = {};
(function scan(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (IMAGE_EXT.test(entry.name)) {
      const rel = path.relative(IMAGE_DIR, full).split(path.sep).join('/');
      images[rel.replace(IMAGE_EXT, '')] = `/categories/explore/${rel}`;
    }
  }
})(IMAGE_DIR);

const q = (s) => JSON.stringify(s);
const body = [...tree]
  .map(([main, subs]) => {
    const subLines = [...subs]
      .map(([sub, leaves]) => `      [${q(sub)}, [${leaves.map(q).join(', ')}]],`)
      .join('\n');
    return `  [\n    ${q(main)},\n    [\n${subLines}\n    ],\n  ],`;
  })
  .join('\n');
const imageLines = Object.keys(images)
  .sort()
  .map((key) => `  ${q(key)}: ${q(images[key])},`)
  .join('\n');

const counts = {
  main: tree.size,
  sub: [...tree.values()].reduce((n, subs) => n + subs.size, 0),
  leaf: [...tree.values()].reduce(
    (n, subs) => n + [...subs.values()].reduce((m, l) => m + l.length, 0),
    0,
  ),
  images: Object.keys(images).length,
};

writeFileSync(
  TARGET,
  `// GENERATED by scripts/build-category-taxonomy.mjs from data/category-taxonomy.csv - do not edit.
// Best-effort realignment of the client's category sheet, pending client confirmation
// (docs/catalog/taxonomy-realign-report.md). ${counts.main} main / ${counts.sub} sub / ${counts.leaf} sub-to-sub.
import type { CategoryImagePaths, CategoryTaxonomySource } from './category-taxonomy';

export const CATEGORY_TAXONOMY_SOURCE: CategoryTaxonomySource = [
${body}
];

/** Artwork found in apps/web/public/categories/explore, keyed by slug path. */
export const CATEGORY_IMAGE_PATHS: CategoryImagePaths = {
${imageLines}
};
`,
);
// Repo lint enforces Prettier, so the generated file is written in its final form.
execFileSync(
  process.execPath,
  [path.join(root, 'node_modules/prettier/bin/prettier.cjs'), '--write', TARGET],
  { stdio: 'ignore' },
);

// One row per image still to make, styled like the client's first sub-category artwork
// (Downloads/youmart category images/sub category: Artificial Flowers, Fertilizers).
const style = (name) =>
  `Portrait 2:3 (1024x1536 px) e-commerce category card. Rounded card with a thin bright-blue border on white. ` +
  `Top-left: the title "${name}" in bold royal-blue (#0142aa) sans-serif with a short blue underline and three small ` +
  `blue accent strokes. Below: a premium photorealistic arrangement of representative ${name.toLowerCase()} products ` +
  `on a white marble surface, soft blurred light interior background with faint pale-blue circles, a smooth blue ` +
  `wave along the bottom edge. Bright, clean, soft studio lighting. No other text, no logos, no brand names, no watermark.`;
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const promptRows = [
  ['level', 'main_category', 'sub_category', 'sub_to_sub_category', 'file', 'has_image', 'prompt'],
];
for (const [main, subs] of tree) {
  for (const [sub, leaves] of subs) {
    const subKey = `${slugify(main)}/${slugify(sub)}`;
    promptRows.push([
      'sub',
      main,
      sub,
      '',
      `${subKey}.webp`,
      images[subKey] ? 'yes' : 'no',
      `${style(sub)} Category: ${main}.`,
    ]);
    for (const leaf of leaves) {
      const leafKey = `${subKey}/${slugify(leaf)}`;
      promptRows.push([
        'sub_to_sub',
        main,
        sub,
        leaf,
        `${leafKey}.webp`,
        images[leafKey] ? 'yes' : 'no',
        `${style(leaf)} Category: ${main} > ${sub}.`,
      ]);
    }
  }
}
writeFileSync(PROMPTS, promptRows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');

console.log(`Wrote ${path.relative(root, TARGET)} and ${path.relative(root, PROMPTS)}:`, counts);
for (const d of dropped) console.log(`  duplicate spelling dropped: ${d}`);
