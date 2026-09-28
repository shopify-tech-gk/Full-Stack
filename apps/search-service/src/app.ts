import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { requestIdMiddleware, genRequestId } from '@youmart/request-context';
import { AppError, createErrorHandler } from '@youmart/errors';
import { getConnection } from '@youmart/queue';
import { logger } from './logger';
import { typesenseClient } from './typesenseClient';
import { config } from './config';
import { searchRouter } from './routes/search.routes';
import { adminRouter } from './routes/admin.routes';

/**
 * Builds the Express app without listening - mirrors the template every
 * service in this repo copies. Unlike every OTHER service, `/ready` here
 * checks TYPESENSE reachability, not Postgres - search-service has no
 * Postgres role at all (see config.ts's doc comment).
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger, genReqId: genRequestId }));

  // Liveness: must never touch Typesense, so the process stays "up" during
  // a transient Typesense blip instead of getting killed by an
  // orchestrator.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'search',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: checks Typesense AND Redis (this service's 2 BullMQ
  // workers - reindex/full-reindex - depend on Redis being reachable to
  // pick up jobs; a Typesense-only check previously missed that).
  app.get('/ready', (_req, res, next) => {
    Promise.all([typesenseClient.health.retrieve(), getConnection().ping()])
      .then(() => {
        res.status(200).json({ status: 'ready' });
      })
      .catch(() => {
        next(new AppError('INTERNAL_ERROR', 503, 'Typesense or Redis is not reachable'));
      });
  });

  app.use('/search', searchRouter);
  app.use('/search/admin', adminRouter);

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));

  return app;
}
