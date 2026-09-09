import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

export interface PrismaClientHandle {
  prisma: PrismaClient;
  close: () => Promise<void>;
}

/**
 * Prisma 7's PrismaClient has no default direct-connection mode - it always
 * requires an explicit driver adapter. This factory wires up the pg adapter
 * so consumers of @youmart/db don't each have to repeat that boilerplate.
 *
 * Returns both the client and a close() handle: prisma.$disconnect() alone
 * does NOT end the underlying pg Pool (it's passed in as an "external pool",
 * so Prisma's adapter only detaches its error listener) - callers must use
 * close() on shutdown to fully release pooled connections.
 */
export function createPrismaClient(
  connectionString: string,
  opts?: { maxConnections?: number },
): PrismaClientHandle {
  // default max 8 per pool; several services share one Postgres box, so keep
  // this modest - revisit during deploy sizing.
  const pool = new Pool({ connectionString, max: opts?.maxConnections ?? 8 });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const close = async (): Promise<void> => {
    await prisma.$disconnect();
    await pool.end();
  };

  return { prisma, close };
}
