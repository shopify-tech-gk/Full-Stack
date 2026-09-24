import type { RequestHandler } from 'express';
import {
  createAdminAuthMiddleware,
  createServiceAuthMiddleware,
  type ServiceAuthMiddleware,
} from '@youmart/auth-middleware';
import { config } from './config';
import { logger } from './logger';

export const { requireAdmin } = createAdminAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
  logger,
});

// Ch6.7b - the internal settings endpoint is fetched by every OTHER
// service (via @youmart/service-client's settings client) using a
// self-minted HS256 service token (Ch6.5), never an admin/customer token.
const serviceAuthMiddleware: ServiceAuthMiddleware = createServiceAuthMiddleware({
  serviceSecret: config.serviceJwtSecret,
  logger,
});

export const requireServiceAuth: RequestHandler = serviceAuthMiddleware.requireServiceAuth;
