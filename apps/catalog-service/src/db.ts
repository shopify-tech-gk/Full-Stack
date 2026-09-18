import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `catalog_svc` Postgres role
 * (Ch2 grants) - it can only read/write tables in the `catalog` schema,
 * never any other module's tables, enforced at the database level.
 */
export const { prisma, close } = createPrismaClient(config.catalogDatabaseUrl, {
  maxConnections: 8,
});
