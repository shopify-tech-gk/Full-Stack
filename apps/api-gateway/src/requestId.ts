import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Generates an `x-request-id` if the caller didn't supply one, stamps it
 * onto `req.requestId` (for logging) AND echoes it back on the response
 * header, AND forwards it downstream unchanged via the proxy (services
 * read the SAME header, so one id correlates gateway + service logs for a
 * single request end-to-end).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  req.requestId = requestId;
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
