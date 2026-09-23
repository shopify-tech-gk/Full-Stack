import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { buildApiError } from '@youmart/errors';
import { config } from './config';
import { logger } from './logger';
import { requestIdMiddleware } from './requestId';
import { rateLimiter } from './rateLimiter';
import { gatewayHealth, servicesHealth } from './health';
import { registerProxyRoutes } from './proxyRoutes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      origin: config.corsAllowedOrigins,
      credentials: true,
    }),
  );

  app.use(requestIdMiddleware);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // NOTE: deliberately NO express.json()/body-parser anywhere in this
  // gateway - it never reads req.body, so http-proxy-middleware streams
  // every request's raw body through untouched. This is what keeps the
  // Razorpay webhook's HMAC signature (computed over the exact raw bytes)
  // valid all the way through the gateway - if any body-parsing middleware
  // ran first and consumed the stream, the webhook signature would break.

  app.get('/health', gatewayHealth);
  app.get('/health/services', servicesHealth);

  app.use(rateLimiter);

  registerProxyRoutes(app);

  app.use((_req: Request, res: Response) => {
    res.status(404).json(buildApiError('NOT_FOUND', 'Route not found'));
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, path: req.path }, 'unhandled gateway error');
    if (!res.headersSent) {
      res.status(500).json(buildApiError('INTERNAL_ERROR', 'Internal server error'));
    }
  });

  return app;
}
