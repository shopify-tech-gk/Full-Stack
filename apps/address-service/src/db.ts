import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `addresses_svc` Postgres
 * role (Ch6.1 grants) - it can only read/write tables in the `addresses`
 * schema, never any other module's tables, enforced at the database level.
 */
export const { prisma, close } = createPrismaClient(config.addressDatabaseUrl, {
  maxConnections: 8,
});
