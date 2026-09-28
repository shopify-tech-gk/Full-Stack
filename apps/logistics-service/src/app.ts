import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { requestIdMiddleware, genRequestId } from '@youmart/request-context';
import { AppError, createErrorHandler } from '@youmart/errors';
import { logger } from './logger';
import { prisma } from './db';
import { config } from './config';
import './providers/registry';
import { adminLogisticsRouter } from './routes/admin.routes';
import { sellerLogisticsRouter } from './routes/seller.routes';
import { customerLogisticsRouter } from './routes/customer.routes';

/**
 * Builds the Express app without listening - mirrors the template every
 * service in this repo copies. Importing `./providers/registry` (for its
 * side effect of registering `manualProvider`) here guarantees the
 * registry is populated before any route can be hit.
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
      service: 'logistics',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: actually checks DB connectivity as the logistics_svc role.
  app.get('/ready', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({ status: 'ready' });
      })
      .catch(() => {
        next(new AppError('INTERNAL_ERROR', 503, 'Database is not reachable'));
      });
  });

  app.use('/logistics/seller', sellerLogisticsRouter);
  app.use('/logistics/track', customerLogisticsRouter);
  app.use('/logistics', adminLogisticsRouter);

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  // Central error handler - shared by every service (@youmart/errors).
  app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));

  return app;
}
