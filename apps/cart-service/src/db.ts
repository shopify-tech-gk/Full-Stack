import { createPrismaClient } from '@youmart/db';
import { config } from './config';

/**
 * This service connects as the least-privilege `cart_svc` Postgres role
 * (Ch2 grants) - it can only read/write the `cart` schema. SKU/price and
 * stock data come from catalog-service/inventory-service over HTTP
 * (@youmart/service-client), never by querying their schemas directly.
 */
export const { prisma, close } = createPrismaClient(config.cartDatabaseUrl, { maxConnections: 8 });
