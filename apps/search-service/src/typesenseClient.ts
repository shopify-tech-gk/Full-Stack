import Typesense from 'typesense';
import { config } from './config';

/**
 * search-service's ONLY datastore client - there is no Prisma/Postgres
 * client anywhere in this service (see config.ts's doc comment). Typesense
 * is a rebuildable derived index; catalog-service's Postgres is the
 * source of truth.
 */
export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: config.typesenseHost,
      port: config.typesensePort,
      protocol: config.typesenseProtocol,
    },
  ],
  apiKey: config.typesenseApiKey,
  connectionTimeoutSeconds: Math.max(1, Math.ceil(config.serviceHttpTimeoutMs / 1000)),
});

/** Typesense's JS client throws a typed `ObjectNotFound` error for 404s
 * (missing collection/alias/document) - narrowed here so callers can treat
 * "already gone" as a success rather than a failure. */
export function isTypesenseNotFound(err: unknown): boolean {
  return err instanceof Error && (err.name === 'ObjectNotFound' || /not found/i.test(err.message));
}
