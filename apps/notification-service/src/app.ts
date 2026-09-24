import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { requestIdMiddleware, genRequestId } from '@youmart/request-context';
import { AppError, createErrorHandler } from '@youmart/errors';
import { getConnection } from '@youmart/queue';
import { logger } from './logger';
import { prisma } from './db';
import { config } from './config';

/**
 * Builds the Express app without listening - mirrors the template every
 * service in this repo copies. notification-service has no protected HTTP
 * surface today (it is a queue worker, not a request-driven API) - only
 * health/ready are exposed.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors()); // dev defaults; prod origins get locked down at deploy
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger, genReqId: genRequestId }));

  // Liveness: must never touch the DB, so the process stays "up" during a
  // transient DB blip instead of getting killed by an orchestrator.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'notification',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: checks Postgres AND Redis - this service's notifications
  // worker depends on Redis being reachable to pick up queued jobs; a
  // Postgres-only check previously missed that.
  app.get('/ready', (_req, res, next) => {
    Promise.all([prisma.$queryRaw`SELECT 1`, getConnection().ping()])
      .then(() => {
        res.status(200).json({ status: 'ready' });
      })
      .catch(() => {
        next(new AppError('INTERNAL_ERROR', 503, 'Database or Redis is not reachable'));
      });
  });

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  // Central error handler - shared by every service (@youmart/errors).
  app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));

  return app;
}
