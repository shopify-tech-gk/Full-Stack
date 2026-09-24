import type { RequestHandler } from 'express';
import {
  createAuthMiddleware,
  createServiceAuthMiddleware,
  createAdminAuthMiddleware,
  type AuthMiddleware,
  type ServiceAuthMiddleware,
  type AdminAuthMiddleware,
} from '@youmart/auth-middleware';
import { config } from './config';

const authMiddleware: AuthMiddleware = createAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
});

export const requireAuth: RequestHandler = authMiddleware.requireAuth;
export const optionalAuth: RequestHandler = authMiddleware.optionalAuth;

// Ch7.1 - real RBAC (mirrors every other service's pattern, Ch6.7a). Same
// RS256 public key as `requireAuth` above - an ADMIN token is only
// distinguished by its `typ:"admin"` claim, verified inside `requireAdmin`.
const adminAuthMiddleware: AdminAuthMiddleware = createAdminAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
});

export const requireAdmin = adminAuthMiddleware.requireAdmin;

// Ch6.5 - service-to-service auth (SEPARATE secret/alg from the user RS256
// keypair above; see @youmart/auth-middleware's serviceAuth.ts doc comment).
const serviceAuthMiddleware: ServiceAuthMiddleware = createServiceAuthMiddleware({
  serviceSecret: config.serviceJwtSecret,
});

export const requireServiceAuth: RequestHandler = serviceAuthMiddleware.requireServiceAuth;
export const requireServiceOrUser: RequestHandler =
  serviceAuthMiddleware.requireServiceOrUser(requireAuth);
