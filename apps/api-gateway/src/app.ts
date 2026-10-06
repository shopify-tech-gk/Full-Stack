import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { buildApiError } from '@youmart/errors';
import { config } from './config';
import { logger } from './logger';
import { requestIdMiddleware } from './requestId';
import { publicFormRateLimiter, rateLimiter } from './rateLimiter';
import { gatewayHealth, servicesHealth } from './health';
import { registerProxyRoutes } from './proxyRoutes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  app.use(
    cors({
      // CORS is a BROWSER mechanism. The native mobile app (and curl/server-to-server) send no
      // Origin header and don't enforce CORS, so they're never blocked.
      origin: (origin, callback) => {
        // No Origin -> non-browser client (mobile app, curl): always allow.
        if (!origin) return callback(null, true);
        // Configured browser origins (the web app) -> allowed in EVERY environment (unchanged).
        if (config.corsAllowedOrigins.includes(origin)) return callback(null, true);
        // DEV ONLY: allow any browser origin for local device/preview testing (e.g. Expo web on a
        // LAN IP). Production keeps the strict allow-list above - this branch never runs in prod.
        if (config.nodeEnv === 'development') return callback(null, true);
        // Otherwise: not an allowed origin (the browser blocks it) - prod behaviour unchanged.
        return callback(null, false);
      },
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
  app.use(publicFormRateLimiter);

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
