// DEV ONLY - adds a few demo coupons to the LOCAL database (idempotent: an existing code is left
// as it is). Real coupons are created by an admin: POST /api/orders/coupons/admin
// (promotions.manage). Usage: pnpm seed:coupons
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;
if (env.NODE_ENV === 'production') {
  console.error('seed-demo-coupons is for local development only.');
  process.exit(1);
}

// code, type, value, max discount, min order, usage limit, per-user limit, public, title, description
const COUPONS = [
  ['WELCOME10', 'PERCENT', 10, 500, 999, null, 1, true, '10% off up to ₹500', 'For your first order of ₹999 or more'],
  ['FLAT200', 'FLAT', 200, null, 1999, null, 1, true, '₹200 off', 'On orders of ₹1,999 or more'],
  ['SAVE5', 'PERCENT', 5, 2000, 20000, null, 3, true, '5% off up to ₹2,000', 'On big orders of ₹20,000+ (use up to 3 times)'],
  ['MEGA1000', 'FLAT', 1000, null, 50000, 100, 1, true, '₹1,000 off', 'On orders of ₹50,000+ - first 100 customers'],
  ['VIP25', 'PERCENT', 25, 1000, null, null, 1, false, '25% off up to ₹1,000', 'Secret code for our VIP customers'],
];

const lit = (v) => (v === null ? 'NULL' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sql = COUPONS.map(
  ([code, type, value, max, min, limit, perUser, pub, title, desc]) => `
INSERT INTO promotions.coupon (id, code, discount_type, discount_value, max_discount, min_order_value,
  usage_limit, per_user_limit, is_public, title, description, updated_at)
SELECT gen_random_uuid()::text, ${lit(code)}, ${lit(type)}, ${value}, ${lit(max)}, ${lit(min)},
  ${lit(limit)}, ${lit(perUser)}, ${lit(pub)}, ${lit(title)}, ${lit(desc)}, now()
WHERE NOT EXISTS (SELECT 1 FROM promotions.coupon WHERE code = ${lit(code)} AND deleted_at IS NULL);`,
).join('\n');

const out = execFileSync(
  'docker',
  [
    'compose', '-f', 'docker/docker-compose.yml', '--env-file', '.env', 'exec', '-T', 'postgres',
    'psql', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB, '-v', 'ON_ERROR_STOP=1',
  ],
  { cwd: root, input: sql },
).toString();
const added = (out.match(/INSERT 0 1/g) ?? []).length;
console.log(`Demo coupons: ${added} added, ${COUPONS.length - added} already there.`);
console.log(COUPONS.map((c) => `  ${c[0]}${c[7] ? '' : ' (secret)'} - ${c[8]}`).join('\n'));
