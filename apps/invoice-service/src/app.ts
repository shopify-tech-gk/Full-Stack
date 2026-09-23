import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { AppError, createErrorHandler } from '@youmart/errors';
import { logger } from './logger';
import { prisma } from './db';
import { config } from './config';
import { invoiceRouter } from './routes/invoice.routes';
import { adminInvoiceRouter } from './routes/admin.routes';

/**
 * Builds the Express app without listening - mirrors the template every
 * service in this repo copies.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  // Liveness: must never touch the DB, so the process stays "up" during a
  // transient DB blip instead of getting killed by an orchestrator.
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'invoice',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness: actually checks DB connectivity as the invoices_svc role.
  app.get('/ready', (_req, res, next) => {
    prisma.$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({ status: 'ready' });
      })
      .catch(() => {
        next(new AppError('INTERNAL_ERROR', 503, 'Database is not reachable'));
      });
  });

  app.use('/invoices', invoiceRouter);
  app.use('/admin/invoices', adminInvoiceRouter);

  app.use((_req, _res, next) => {
    next(new AppError('NOT_FOUND', 404, 'Route not found'));
  });

  // Central error handler - shared by every service (@youmart/errors).
  app.use(createErrorHandler({ isProd: config.nodeEnv === 'production' }));

  return app;
}
