import express, { type Express, type Request } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { requestIdMiddleware, genRequestId } from '@youmart/request-context';
import { AppError, createErrorHandler } from '@youmart/errors';
import { logger } from './logger';
import { prisma } from './db';
import { config } from './config';
import { paymentRouter } from './routes/payment.routes';

/**
 * Builds the Express app without listening - mirrors the other services'
 * skeleton template.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors()); // dev defaults; prod origins get locked down at deploy

  // `verify` runs BEFORE JSON parsing with the raw byte buffer - this is
  // how the Razorpay webhook route gets req.rawBody to HMAC-verify against
  // (express.json()'s parsed req.body has already lost the exact original
  // bytes/formatting the signature was computed over). Applied globally
  // (simplest, no separate raw-body-parser mount needed) - only the
  // webhook route actually reads req.rawBody.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    }),
  );

  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger, genReqId: genRequestId }));

  // Liveness: must never touch the DB, so the process stays "up" during a
  // transient DB blip instead of getting killed by an orchestrator.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'payment',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: actually checks DB connectivity as the payments_svc role.
  app.get('/ready', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({ status: 'ready' });
      })
      .catch(() => {
        next(new AppError('INTERNAL_ERROR', 503, 'Database is not reachable'));
      });
  });

  app.use('/payments', paymentRouter);

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  // Central error handler - shared by every service (@youmart/errors).
  app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));

  return app;
}
