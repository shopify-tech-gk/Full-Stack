import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `orders_svc` Postgres role
 * (Ch2 grants) - it can only read/write the `orders` schema. Cart contents,
 * authoritative prices, and stock all come from cart-service/catalog-service/
 * inventory-service over HTTP (@youmart/service-client), never by querying
 * their schemas directly.
 */
export const { prisma, close } = createPrismaClient(config.orderDatabaseUrl, { maxConnections: 8 });
