import { createAdminAuthMiddleware } from '@youmart/auth-middleware';
import { config } from './config';
import { logger } from './logger';

export const { requireAdmin } = createAdminAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
  logger,
});
