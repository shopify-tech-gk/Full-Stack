// DEV/DEMO ONLY - removes the demo catalogue added by `pnpm dev:seed-demo` (soft-delete, the same
// way the app deletes data): every `demo-` product, its `DEMO-` SKUs, photos and stock rows, then
// rebuilds the search index so the storefront stops showing them. Categories are kept (they are
// real storefront categories). Usage: pnpm dev:remove-demo   (needs Docker infra + backend running)
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;
if (env.NODE_ENV === 'production') {
  console.error('dev-remove-demo is for local development only.');
  process.exit(1);
}

const sql = `BEGIN;
UPDATE inventory.stock_level SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND sku_id IN (
    SELECT id::text FROM catalog.sku WHERE sku_code LIKE 'DEMO-%' AND deleted_at IS NULL);
UPDATE catalog.product_image SET deleted_at = now(), updated_at = now()
  WHERE deleted_at IS NULL AND product_id IN (
    SELECT id FROM catalog.product WHERE slug LIKE 'demo-%' AND deleted_at IS NULL);
UPDATE catalog.sku SET deleted_at = now(), updated_at = now()
  WHERE sku_code LIKE 'DEMO-%' AND deleted_at IS NULL;
UPDATE catalog.product SET status = 'ARCHIVED', deleted_at = now(), updated_at = now()
  WHERE slug LIKE 'demo-%' AND deleted_at IS NULL;
COMMIT;
SELECT count(*) FROM catalog.product WHERE slug LIKE 'demo-%' AND deleted_at IS NULL;`;

const out = execFileSync(
  'docker',
  [
    'compose', '-f', 'docker/docker-compose.yml', '--env-file', '.env', 'exec', '-T', 'postgres',
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB, '-At',
  ],
  { cwd: root, input: sql },
).toString();
console.log(`demo products still live: ${out.trim().split('\n').pop()}`);

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
  typ: 'admin',
  role: 'SUPER_ADMIN',
  sub: '00000000-0000-4000-8000-000000000000',
  iss: env.JWT_ISSUER || 'youmart-auth',
  aud: env.JWT_AUDIENCE || 'youmart',
  iat: now,
  exp: now + 300,
})}`;
const signature = createSign('RSA-SHA256')
  .update(unsigned)
  .sign(Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('utf8'), 'base64url');
const gateway = env.GATEWAY_URL || 'http://localhost:4000';
const res = await fetch(`${gateway}/api/search/admin/reindex`, {
  method: 'POST',
  headers: { authorization: `Bearer ${unsigned}.${signature}` },
});
console.log(`search reindex: HTTP ${res.status} ${await res.text()}`);
