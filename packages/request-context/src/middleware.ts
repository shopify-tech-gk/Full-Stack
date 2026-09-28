import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { runWithRequestId } from './context';

const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Ch7.3 observability: every backend service mounts this as its FIRST
 * middleware (before pino-http). The gateway already generates/forwards
 * `x-request-id` (see api-gateway/src/requestId.ts) and http-proxy-
 * middleware passes headers through unchanged, so this normally just
 * picks up the SAME id the gateway assigned - it only generates a fresh
 * one if the service is ever called directly (no gateway in front, e.g. a
 * local/manual test). Two things happen with that id:
 *  1. Stamped onto `req.requestId` + echoed on the response header, and
 *     wired into pino-http's `genReqId` (see usage in each service's
 *     app.ts) - so pino's own `req.id` field in every log line for this
 *     request IS the gateway's x-request-id, not an unrelated per-service
 *     counter.
 *  2. Run for the rest of the request inside `runWithRequestId` (an
 *     AsyncLocalStorage context) - @youmart/service-client reads it from
 *     there and forwards it as `x-request-id` on any outbound call to
 *     another service, so the SAME id keeps propagating gateway -> this
 *     service -> whatever it calls next.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  req.requestId = requestId;
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  runWithRequestId(requestId, next);
}

/** Passed as pino-http's `genReqId` option so pino's own `req.id` field
 * equals the correlated request-id rather than an independent counter. */
export function genRequestId(req: Request): string {
  return req.requestId ?? randomUUID();
}
