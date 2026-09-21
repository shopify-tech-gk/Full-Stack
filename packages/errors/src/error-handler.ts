import type { ErrorRequestHandler, Request } from 'express';
import { ZodError } from 'zod';
import { AppError } from './app-error';
import { buildApiError } from './envelope';

export interface CreateErrorHandlerOptions {
  /** In prod, unknown (non-AppError) error messages are never leaked to the client. */
  isProd: boolean;
}

function logError(req: Request, err: unknown): void {
  // pino-http (used by every service here) attaches `req.log` - fall back
  // to console only if some caller hasn't wired that up.
  const log = (req as unknown as { log?: { error: (obj: unknown, msg?: string) => void } }).log;
  if (log) {
    log.error({ err }, 'request error');
  } else {
    // eslint-disable-next-line no-console
    console.error('request error', err);
  }
}

/**
 * Central Express error handler shared by every service: AppError -> its own
 * status/code, ZodError -> 400 VALIDATION_ERROR (+issues), malformed JSON ->
 * 400, anything else -> 500 (message hidden in prod). Register this LAST,
 * after the 404 fallback.
 */
export function createErrorHandler({ isProd }: CreateErrorHandlerOptions): ErrorRequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, req: Request, res, _next) => {
    logError(req, err);

    if (err instanceof ZodError) {
      res.status(400).json(buildApiError('VALIDATION_ERROR', 'Validation failed', err.issues));
      return;
    }

    if (err instanceof SyntaxError && (err as { type?: string }).type === 'entity.parse.failed') {
      res.status(400).json(buildApiError('VALIDATION_ERROR', 'Malformed JSON body'));
      return;
    }

    if (err instanceof AppError) {
      res.status(err.httpStatus).json(buildApiError(err.code, err.message, err.details));
      return;
    }

    const message = isProd
      ? 'Internal server error'
      : err instanceof Error
        ? err.message
        : 'Internal server error';
    res.status(500).json(buildApiError('INTERNAL_ERROR', message));
  };
}
