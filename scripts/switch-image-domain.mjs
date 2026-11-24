// Moves every stored product-image link from the R2 development address (pub-....r2.dev, which
// Cloudflare rate-limits and does not support for production) to the bucket's custom domain, then
// rebuilds the search index so search results carry the new links too.
//
//   node scripts/switch-image-domain.mjs https://img.youmart.in --dry-run   # counts only
//   node scripts/switch-image-domain.mjs https://img.youmart.in             # update + reindex
//
// Reads DATABASE_URL / JWT_PRIVATE_KEY / GATEWAY_URL from the repo-root .env. On the server, run it
// inside the backend container:
//   docker compose -f docker-compose.prod.yml run --rm -e GATEWAY_URL=http://gateway:4000 \
//     gateway node scripts/switch-image-domain.mjs https://img.youmart.in
// Safe to run again: rows already on the new domain no longer match.
import { createSign } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;

const target = (process.argv[2] ?? '').replace(/\/+$/, '');
const dryRun = process.argv.includes('--dry-run');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(target)) {
  console.error('usage: node scripts/switch-image-domain.mjs https://img.example.com [--dry-run]');
  process.exit(1);
}

const { Client } = createRequire(path.join(root, 'packages/db/package.json'))('pg');
const db = new Client({ connectionString: env.DATABASE_URL?.replace(/\?schema=.*$/, '') });
await db.connect();

// The R2 development host currently in the data (e.g. https://pub-<hash>.r2.dev).
const { rows: hosts } = await db.query(
  `SELECT DISTINCT substring(url from '^https://pub-[a-z0-9]+\\.r2\\.dev') AS host
     FROM catalog.product_image WHERE url LIKE 'https://pub-%.r2.dev/%'`,
);
const from = hosts.map((h) => h.host).filter(Boolean);
if (from.length === 0) {
  console.log('No r2.dev image links left - nothing to do.');
  await db.end();
  process.exit(0);
}
if (from.length > 1) console.log(`note: ${from.length} r2.dev hosts found - all move to ${target}`);

// Every column that stores image links (found by scanning the database for "r2.dev").
const COLUMNS = [
  ['catalog.product_image', 'url', 'text'],
  ['catalog.sku', 'attributes', 'jsonb'],
  ['notifications.inbox_message', 'image_url', 'text'],
  ['notifications.buy_reminder', 'image_url', 'text'],
  ['notifications.finder_query', 'products', 'jsonb'],
  ['notifications.notification_log', 'payload', 'jsonb'],
];

let total = 0;
await db.query('BEGIN');
try {
  for (const host of from) {
    for (const [table, column, type] of COLUMNS) {
      const like = `%${host}%`;
      if (dryRun) {
        const { rows } = await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${column}::text LIKE $1`, [like]);
        console.log(`${table}.${column}: ${rows[0].n} row(s) would change`);
        total += rows[0].n;
        continue;
      }
      const set =
        type === 'jsonb'
          ? `${column} = replace(${column}::text, $1, $2)::jsonb`
          : `${column} = replace(${column}, $1, $2)`;
      const res = await db.query(`UPDATE ${table} SET ${set} WHERE ${column}::text LIKE $3`, [host, target, like]);
      console.log(`${table}.${column}: ${res.rowCount} row(s) updated`);
      total += res.rowCount;
    }
  }
  await db.query(dryRun ? 'ROLLBACK' : 'COMMIT');
} catch (err) {
  await db.query('ROLLBACK');
  throw err;
} finally {
  await db.end();
}
console.log(`${dryRun ? 'would change' : 'changed'} ${total} row(s): ${from.join(', ')} -> ${target}`);
if (dryRun) process.exit(0);

// Rebuild search so results carry the new links (same admin-token approach as the importer).
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
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
// JWT_PRIVATE_KEY is the base64 of the PEM (same as the importer and auth-service read it).
const key = Buffer.from(env.JWT_PRIVATE_KEY ?? '', 'base64').toString('utf8');
const signature = createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url');
const gateway = env.GATEWAY_URL || 'http://localhost:4000';
try {
  const res = await fetch(`${gateway}/api/search/admin/reindex`, {
    method: 'POST',
    headers: { authorization: `Bearer ${unsigned}.${signature}` },
  });
  console.log(`search rebuild: HTTP ${res.status} - it swaps in the new index when done (a few minutes)`);
} catch (err) {
  console.log(`search rebuild could not be started (${err?.message}); the nightly rebuild will pick it up`);
}
