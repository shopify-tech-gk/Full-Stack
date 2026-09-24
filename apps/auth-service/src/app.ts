import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { AppError, createErrorHandler } from '@youmart/errors';
import { logger } from './logger';
import { prisma } from './db';
import { config } from './config';
import { otpRouter } from './routes/otp.routes';
import { sessionRouter } from './routes/session.routes';
import { internalRouter } from './routes/internal.routes';

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

  app.use('/auth', otpRouter);
  app.use('/auth', sessionRouter);
  app.use('/auth', internalRouter);

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  // Central error handler - shared by every service (@youmart/errors).
  app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));

  return app;
}
