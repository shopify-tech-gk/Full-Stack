import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the `logistics_svc` Postgres role - granted
 * CRUD on the `logistics` schema (Ch2) AND, since Ch5.4, the `tracking`
 * schema too (see config.ts's comment + the Ch5.4 grant migration). One
 * role, one client, one connection pool - shipment + tracking_event are
 * one bounded context this service owns together.
 */
export const { prisma, close } = createPrismaClient(config.logisticsDatabaseUrl, {
  maxConnections: 8,
});
