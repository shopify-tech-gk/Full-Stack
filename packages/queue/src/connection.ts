import IORedis, { type Redis } from 'ioredis';

let connection: Redis | null = null;

function buildConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (url) {
    return new IORedis(url, { maxRetriesPerRequest: null });
  }
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  return new IORedis({ host, port, maxRetriesPerRequest: null });
}

// BullMQ requires a single shared connection per process, and maxRetriesPerRequest: null,
// or its blocking commands (and workers) will misbehave.
export function getConnection(): Redis {
  if (!connection) {
    connection = buildConnection();
  }
  return connection;
}

export async function closeConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
