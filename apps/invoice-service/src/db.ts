import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `invoices_svc` Postgres
 * role (Ch6.4 grants) - it can only read/write tables in the `invoices`
 * schema, never any other module's tables, enforced at the database level.
 */
export const { prisma, close } = createPrismaClient(config.invoiceDatabaseUrl, {
  maxConnections: 8,
});
