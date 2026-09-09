import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 moved connection URLs out of schema.prisma and into this config file.
// DATABASE_URL lives in the repo-root .env (shared across the monorepo), not a
// package-local one, so load it explicitly before reading it.
process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));

export default defineConfig({
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
