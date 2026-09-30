// DEV ONLY - prints the pending login OTP for a phone or email on the LOCAL stack, where
// NOTIFICATIONS_ENABLED=false simulates WhatsApp/email and the code is redacted everywhere.
// Usage: pnpm dev:otp 9876543210 | pnpm dev:otp you@example.com
// It needs the local DB and OTP_HASH_SECRET from .env, so it grants nothing an attacker without
// both doesn't already lack; no service ever logs or returns a code.
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharedUtils from '../packages/shared-utils/dist/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;

if (env.NODE_ENV === 'production') {
  console.error('dev-otp is for local development only (NODE_ENV=production).');
  process.exit(1);
}

const input = (process.argv[2] ?? '').trim();
const target = input.includes('@')
  ? { column: 'email', value: input.toLowerCase() }
  : { column: 'phone', value: sharedUtils.normalizePhoneE164(input) };
if (!input || !target.value) {
  console.error('Usage: pnpm dev:otp <mobile number | email>');
  process.exit(1);
}

// :'ident' is psql's quoted-literal interpolation - the identifier is never spliced into SQL.
const sql = `SELECT code_hash FROM auth.otp_challenge WHERE ${target.column} = :'ident'
  AND consumed_at IS NULL AND deleted_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;`;
const hash = execFileSync(
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
    '-v',
    `ident=${target.value}`,
  ],
  { cwd: root, input: sql },
)
  .toString()
  .trim();

if (!hash) {
  console.error(`No pending code for ${target.value} - request one first (codes expire).`);
  process.exit(1);
}

const length = Number(env.OTP_LENGTH || 6);
for (let i = 0; i < 10 ** length; i += 1) {
  const code = String(i).padStart(length, '0');
  if (createHmac('sha256', env.OTP_HASH_SECRET).update(code).digest('hex') === hash) {
    console.log(`OTP for ${target.value}: ${code}`);
    process.exit(0);
  }
}
console.error('Could not recover the code - is OTP_HASH_SECRET in .env the one auth-service uses?');
process.exit(1);
