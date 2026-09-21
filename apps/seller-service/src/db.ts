import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `sellers_svc` Postgres role
 * (Ch2 grants) - it can only read/write tables in the `sellers` schema,
 * never any other module's tables, enforced at the database level.
 */
export const { prisma, close } = createPrismaClient(config.sellerDatabaseUrl, {
  maxConnections: 8,
});
