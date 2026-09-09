import path from 'node:path';
import { createPrismaClient } from '../src/index';

// Loaded the same way prisma.config.ts loads it: this script runs standalone
// via `tsx`, with cwd = packages/db, against the repo-root .env.
process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));

const { prisma, close } = createPrismaClient(process.env['DATABASE_URL'] ?? '');

/**
 * Idempotent seed. Plants exactly two rows the platform requires to exist
 * before anything else can function:
 *   1. sellers.seller - the single "default seller" (the platform's own
 *      first-party store), guarded by the partial unique index on
 *      (is_default_seller = true AND deleted_at IS NULL) from 2.2.
 *   2. admin.marketplace_settings - the single hard-off config row.
 *
 * Both are create-if-missing only: neither is ever updated once it exists,
 * so re-running this script (or an admin's later mode change) is never
 * overwritten.
 */
async function main(): Promise<void> {
  const existingDefaultSeller = await prisma.seller.findFirst({
    where: { isDefaultSeller: true, deletedAt: null },
  });

  if (existingDefaultSeller) {
    console.log(`Default seller already exists (id=${existingDefaultSeller.id}), skipping.`);
  } else {
    const seller = await prisma.seller.create({
      data: {
        displayName: 'YouMart',
        status: 'APPROVED',
        isDefaultSeller: true,
        commissionRatePercent: 0.0,
        ownerUserId: null,
      },
    });
    console.log(`Created default seller (id=${seller.id}).`);
  }

  const existingSettings = await prisma.marketplaceSettings.findFirst({
    where: { deletedAt: null },
  });

  if (existingSettings) {
    console.log(
      `Marketplace settings already exist (id=${existingSettings.id}, mode=${existingSettings.marketplaceMode}), leaving untouched.`,
    );
  } else {
    const settings = await prisma.marketplaceSettings.create({
      data: { marketplaceMode: 'DISABLED' },
    });
    console.log(
      `Created marketplace settings (id=${settings.id}, mode=${settings.marketplaceMode}).`,
    );
  }
}

main()
  .then(async () => {
    await close();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await close();
    process.exit(1);
  });
