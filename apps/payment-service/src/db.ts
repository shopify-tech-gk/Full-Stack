import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `payments_svc` Postgres
 * role (Ch2 grants) - it can only read/write the `payments` schema. Order
 * lookup/confirm/cancel all go over HTTP via @youmart/service-client,
 * never by querying the orders schema directly.
 */
export const { prisma, close } = createPrismaClient(config.paymentDatabaseUrl, {
  maxConnections: 8,
});
