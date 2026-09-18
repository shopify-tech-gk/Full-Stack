import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import type { ApiError } from '@youmart/shared-types';
import { logger } from './logger';
import { prisma } from './db';
import { config } from './config';
import { AppError } from './errors';

/**
 * Builds the Express app without listening - keeps it testable and is the
 * template every future service in this repo copies.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors()); // dev defaults; prod origins get locked down at deploy
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // Liveness: must never touch the DB, so the process stays "up" during a
  // transient DB blip instead of getting killed by an orchestrator.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'auth',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: actually checks DB connectivity as the auth_svc role.
  app.get('/ready', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({ status: 'ready' });
      })
      .catch(() => {
        next(new AppError('INTERNAL_ERROR', 503, 'Database is not reachable'));
      });
  });

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  // Central error handler - the template every service reuses. Express only
  // treats a 4-arg function as error middleware, so `next` stays declared
  // (unused) even though it's never called.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    req.log.error({ err }, 'request error');

    if (err instanceof ZodError) {
      const body: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: err.issues,
        },
      };
      res.status(400).json(body);
      return;
    }

    if (err instanceof SyntaxError && (err as { type?: string }).type === 'entity.parse.failed') {
      const body: ApiError = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Malformed JSON body',
        },
      };
      res.status(400).json(body);
      return;
    }

    if (err instanceof AppError) {
      const body: ApiError = {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      };
      res.status(err.httpStatus).json(body);
      return;
    }

    // Unknown error: never leak internals in production.
    const message =
      config.nodeEnv === 'production'
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Internal server error';

    const body: ApiError = {
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    };
    res.status(500).json(body);
  });

  return app;
}
