import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The storefront's category taxonomy (main -> sub), read from the same CSV the client taxonomy is
 * generated from (packages/shared-client/data/category-taxonomy.csv), so Lens can only ever answer
 * with category names the apps know how to open. Sub-to-sub levels are left out: they would triple
 * the prompt size for little gain - the apps drill down from the sub.
 */
export interface LensTaxonomyMain {
  name: string;
  subs: string[];
}

const CSV_PATH = path.resolve(
  __dirname,
  '../../../../packages/shared-client/data/category-taxonomy.csv',
);

/** RFC 4180: quoted fields may hold commas, doubled quotes and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
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

const clean = (value: string) => value.replace(/\s+/g, ' ').replace(/’/g, "'").trim();

let cache: LensTaxonomyMain[] | null = null;

export function lensTaxonomy(): LensTaxonomyMain[] {
  if (cache) return cache;
  const [, ...rows] = parseCsv(readFileSync(CSV_PATH, 'utf8').replace(/^﻿/, ''));
  const mains = new Map<string, Set<string>>();
  for (const [main = '', sub = ''] of rows) {
    const m = clean(main);
    const s = clean(sub);
    if (!m) continue;
    if (!mains.has(m)) mains.set(m, new Set());
    if (s) mains.get(m)!.add(s);
  }
  cache = [...mains].map(([name, subs]) => ({ name, subs: [...subs] }));
  return cache;
}

/** One line per main: "Electronics: Mobiles | Laptops | ..." - compact, stable (cache-friendly). */
export function taxonomyPromptBlock(): string {
  return lensTaxonomy()
    .map((m) => `${m.name}: ${m.subs.join(' | ')}`)
    .join('\n');
}

/** Keeps only (main, sub) pairs that really exist - matched case-insensitively, returned as written
 * in the taxonomy. A valid main with an unknown sub keeps the main alone. */
export function validCategoryPairs(
  pairs: { main: string; sub: string }[],
): { main: string; sub: string | null }[] {
  const out: { main: string; sub: string | null }[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    const main = lensTaxonomy().find(
      (m) => m.name.toLowerCase() === pair.main.trim().toLowerCase(),
    );
    if (!main) continue;
    const sub = main.subs.find((s) => s.toLowerCase() === pair.sub.trim().toLowerCase()) ?? null;
    const key = `${main.name}|${sub ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ main: main.name, sub });
  }
  return out;
}
