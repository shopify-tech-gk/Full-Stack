// v1.20 one-off: lists the products already in Garden Hand Tools / Pruning Tools on the app menu's
// single-tool shelves (Trowels, Rakes...) using the same rule the importer now applies
// (import-targets.mjs toolShelves). Creates the shelf categories if needed. Idempotent.
// Usage: node scripts/link-tool-shelves.mjs [--apply]   (without --apply: prints what it would do)
import { execFileSync } from 'node:child_process';
import { TARGETS, TOOL_SHELVES, toolShelves } from './data/import-targets.mjs';

const apply = process.argv.includes('--apply');
const psql = (sql) =>
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'docker-postgres-1',
      'psql',
      '-U',
      'youmart_dev',
      '-d',
      'youmart_dev',
      '-v',
      'ON_ERROR_STOP=1',
      '-tA',
      '-F',
      '\x1f',
    ],
    { input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

const rows = psql(`SELECT x.id, x.title, x.attributes::text FROM catalog.product x
  JOIN catalog.category c ON c.id = x.category_id
  WHERE c.slug IN ('garden-hand-tools', 'pruning-tools') AND x.deleted_at IS NULL AND x.status = 'ACTIVE';`)
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\x1f'));

const byShelf = new Map(TOOL_SHELVES.map(([name]) => [name, []]));
for (const [id, title, attrs] of rows) {
  for (const name of toolShelves(title, JSON.parse(attrs))) byShelf.get(name).push({ id, title });
}
for (const [name, list] of byShelf) {
  console.log(`\n${name}: ${list.length}`);
  for (const p of list) console.log(`  - ${p.title.slice(0, 110)}`);
}
if (!apply) process.exit(0);

const sql = ['BEGIN;'];
for (const [name, list] of byShelf) {
  const t = TARGETS[name];
  const [slug, label] = t.chain.at(-1);
  const parent = t.chain.at(-2)[0];
  sql.push(`INSERT INTO catalog.category (id, name, slug, parent_id, filter_definition, created_at, updated_at)
    SELECT gen_random_uuid(), ${lit(label)}, ${lit(slug)},
      (SELECT id FROM catalog.category WHERE slug = ${lit(parent)} AND deleted_at IS NULL),
      ${lit(JSON.stringify(t.filters))}::jsonb, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM catalog.category WHERE slug = ${lit(slug)} AND deleted_at IS NULL);`);
  for (const p of list) {
    sql.push(`INSERT INTO catalog.product_extra_category (product_id, category_id)
      SELECT ${lit(p.id)}, id FROM catalog.category WHERE slug = ${lit(slug)} AND deleted_at IS NULL
      ON CONFLICT DO NOTHING;`);
  }
}
sql.push('COMMIT;');
psql(sql.join('\n'));
console.log('\napplied');
