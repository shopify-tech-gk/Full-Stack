// v1.19 Auto-mapping for product deliveries: a "Target Name" that scripts/data/import-targets.mjs
// doesn't list is looked up in the app's own category tree (the client's taxonomy sheet,
// packages/shared-client/data/category-taxonomy.csv) and filed where the app shows it:
//   - the storefront category that already holds that name (any level under the same main) is
//     reused, exactly how the app links its menus (category-taxonomy.ts nameKey matching);
//   - otherwise a new catalog category is made under its taxonomy sub-category, AND the app's
//     storefront tree (packages/shared-client/src/categories.ts) gets the link, so the category
//     page shows the products instead of "Coming soon".
// Never guesses: a name that isn't in the taxonomy, or is in it under more than one place, or
// whose sub-category the storefront doesn't have, is reported and its products are skipped.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Same matching key as the app (category-taxonomy.ts): case, &/and, punctuation, plurals. */
export function nameKey(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && w !== 'and')
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}

const slugify = (t) =>
  String(t)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');

/** Minimal CSV (quoted fields with commas / doubled quotes). */
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') quoted = false;
        else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') {
        cells.push(cur);
        cur = '';
      } else cur += c;
    }
    cells.push(cur);
    rows.push(cells.map((s) => s.trim()));
  }
  return rows;
}

/** A single-quoted TS string literal's value (handles \' and \uXXXX). */
const unquote = (s) =>
  s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\(.)/g, '$1');
const STR = String.raw`'((?:[^'\\]|\\.)*)'`;

const parseList = (list) =>
  unquote(list)
    .split(';')
    .filter(Boolean)
    .map((e) => {
      const [slug = '', name = ''] = e.split('=');
      return { slug, name };
    });

/** The storefront tree from categories.ts: roots, their subs, and each sub's children. */
function readStorefront(text) {
  const treeText = text.slice(text.indexOf('const TREE'), text.indexOf('const THIRD_LEVEL'));
  const thirdText = text.slice(
    text.indexOf('const THIRD_LEVEL'),
    text.indexOf('export const STORE_CATEGORIES'),
  );
  const third = {};
  for (const m of thirdText.matchAll(new RegExp(String.raw`${STR}:\s*${STR}`, 'g'))) {
    third[unquote(m[1])] = parseList(m[2]);
  }
  const roots = [];
  for (const m of treeText.matchAll(
    new RegExp(String.raw`\[\s*${STR},\s*${STR},\s*${STR},?\s*\]`, 'g'),
  )) {
    const slug = unquote(m[1]);
    roots.push({
      slug,
      name: unquote(m[2]),
      subs: parseList(m[3]).map((s) => ({ ...s, children: third[`${slug}/${s.slug}`] ?? [] })),
    });
  }
  return roots;
}

export function createAutoTargets({ root, basicTarget, env }) {
  const csvPath = path.join(root, 'packages/shared-client/data/category-taxonomy.csv');
  const tsPath = path.join(root, 'packages/shared-client/src/categories.ts');
  const taxonomy = parseCsv(readFileSync(csvPath, 'utf8')).slice(1);
  const storefront = readStorefront(readFileSync(tsPath, 'utf8'));
  if (storefront.length === 0) throw new Error('auto-target: could not read the storefront tree');

  // Every slug in use (storefront + catalog DB), so a new category never takes another's slug.
  const used = new Set();
  for (const r of storefront) {
    used.add(r.slug);
    for (const s of r.subs) {
      used.add(s.slug);
      for (const c of s.children) used.add(c.slug);
    }
  }
  try {
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
        env.POSTGRES_USER,
        '-d',
        env.POSTGRES_DB,
        '-At',
        '-c',
        'SELECT slug FROM catalog.category WHERE deleted_at IS NULL',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString();
    for (const s of out.split('\n')) if (s.trim()) used.add(s.trim());
  } catch {
    // DB not reachable for the check: the storefront list still guards the known slugs.
  }

  const cache = new Map();
  /** Storefront edits to make after a successful import: [{ kind, key|rootSlug, slug, name }]. */
  const edits = [];

  function resolve(targetName) {
    const name = String(targetName ?? '').trim();
    if (cache.has(name)) return cache.get(name);
    const result = compute(name);
    cache.set(name, result);
    return result;
  }

  function compute(name) {
    const key = nameKey(name);
    if (!key) return { error: 'empty Target Name' };
    // Where the taxonomy lists it: as a sub-to-sub item, or as a sub-category itself.
    const places = new Map();
    for (const [main, sub, item] of taxonomy) {
      if (nameKey(item) === key) places.set(`${main}|${sub}|${item}`, { main, sub, item });
      else if (nameKey(sub) === key) places.set(`${main}|${sub}|`, { main, sub, item: null });
    }
    // A sub listed as its own item ("Pots & Planters > Pots & Planters") is the sub itself.
    const found = [...places.values()].map((p) =>
      p.item && nameKey(p.item) === nameKey(p.sub) ? { ...p, item: null } : p,
    );
    const distinct = [
      ...new Map(found.map((p) => [`${p.main}|${p.sub}|${p.item ?? ''}`, p])).values(),
    ];
    if (distinct.length === 0) return { error: `"${name}" is not in the app's category list` };
    const mains = [...new Set(distinct.map((p) => `${p.main} › ${p.sub}`))];
    if (mains.length > 1) {
      return {
        error: `"${name}" is in more than one place (${mains.join('; ')}) - add it to import-targets.mjs`,
      };
    }
    const place = distinct[0];
    const rootNode = storefront.find((r) => nameKey(r.name) === nameKey(place.main));
    if (!rootNode) return { error: `main category "${place.main}" is not in the storefront` };
    const label = `${rootNode.name} › ${place.sub}${place.item ? ` › ${place.item}` : ''}`;

    // 1. Already a storefront category under this main (same rule as the app's menu links).
    for (const s of rootNode.subs) {
      if (nameKey(s.name) === key) {
        return {
          target: basicTarget([rootNode.slug, rootNode.name], [s.slug, s.name]),
          label,
          isNew: false,
        };
      }
    }
    for (const s of rootNode.subs) {
      const c = s.children.find((x) => nameKey(x.name) === key);
      if (c) {
        return {
          target: basicTarget([rootNode.slug, rootNode.name], [s.slug, s.name], [c.slug, c.name]),
          label,
          isNew: false,
        };
      }
    }

    // 2. New: under its taxonomy sub-category (made too if the storefront doesn't have it yet), or
    // as a new sub of the main when the taxonomy lists it as a sub.
    const fresh = (base, suffix) => {
      let slug = base;
      if (used.has(slug)) slug = `${base}-${suffix}`;
      let n = 2;
      while (used.has(slug)) slug = `${base}-${suffix}-${n++}`;
      used.add(slug);
      return slug;
    };
    if (!place.item) {
      const slug = fresh(slugify(name), rootNode.slug);
      edits.push({ kind: 'sub', rootSlug: rootNode.slug, slug, name: place.sub });
      rootNode.subs.push({ slug, name: place.sub, children: [] });
      return {
        target: basicTarget([rootNode.slug, rootNode.name], [slug, place.sub]),
        label,
        isNew: true,
      };
    }
    let subNode = rootNode.subs.find((s) => nameKey(s.name) === nameKey(place.sub));
    if (!subNode) {
      subNode = { slug: fresh(slugify(place.sub), rootNode.slug), name: place.sub, children: [] };
      edits.push({ kind: 'sub', rootSlug: rootNode.slug, slug: subNode.slug, name: place.sub });
      rootNode.subs.push(subNode);
    }
    const slug = fresh(slugify(place.item), subNode.slug);
    edits.push({ kind: 'child', key: `${rootNode.slug}/${subNode.slug}`, slug, name: place.item });
    subNode.children.push({ slug, name: place.item });
    return {
      target: basicTarget(
        [rootNode.slug, rootNode.name],
        [subNode.slug, subNode.name],
        [slug, place.item],
      ),
      label,
      isNew: true,
    };
  }

  /** Writes the new storefront links into categories.ts; returns what changed. */
  function applyStorefrontEdits() {
    if (edits.length === 0) return [];
    let text = readFileSync(tsPath, 'utf8');
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const done = [];
    for (const e of edits) {
      const entry = `${e.slug}=${esc(e.name)}`;
      if (e.kind === 'child') {
        const re = new RegExp(
          String.raw`('${e.key.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}':\s*')((?:[^'\\]|\\.)*)(')`,
        );
        if (re.test(text)) text = text.replace(re, (_m, a, b, c) => `${a}${b};${entry}${c}`);
        else {
          const start = text.indexOf('const THIRD_LEVEL');
          const end = text.indexOf('\n};', start);
          text = `${text.slice(0, end)}\n  '${e.key}': '${entry}',${text.slice(end)}`;
        }
      } else {
        const re = new RegExp(
          String.raw`(\[\s*'${e.rootSlug}',\s*${STR},\s*')((?:[^'\\]|\\.)*)(')`,
        );
        text = text.replace(re, (_m, a, _n, b, c) => `${a}${b};${entry}${c}`);
      }
      done.push(`${e.kind === 'child' ? e.key : e.rootSlug} + ${e.slug} (${e.name})`);
    }
    writeFileSync(tsPath, text);
    try {
      execFileSync('npx', ['prettier', '--write', tsPath], {
        cwd: root,
        stdio: 'ignore',
        shell: true,
      });
    } catch {
      // Formatting is cosmetic; the file is valid either way.
    }
    return done;
  }

  return { resolve, applyStorefrontEdits, pendingEdits: () => edits.slice() };
}
