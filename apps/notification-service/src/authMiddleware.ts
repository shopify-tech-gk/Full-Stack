import type { RequestHandler } from 'express';
import {
  createAdminAuthMiddleware,
  createAuthMiddleware,
  type AdminAuthMiddleware,
  type AuthMiddleware,
} from '@youmart/auth-middleware';
import { config } from './config';

// W9: the customer help-ticket routes are the first signed-in surface of this service.
const authMiddleware: AuthMiddleware = createAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
});

export const requireAuth: RequestHandler = authMiddleware.requireAuth;
/** v1.17: AI help works signed out too (store questions only); signed in it can see your orders. */
export const optionalAuth: RequestHandler = authMiddleware.optionalAuth;

// v1.14 admin dashboard: the help-request inbox.
const adminAuthMiddleware: AdminAuthMiddleware = createAdminAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
});

export const requireAdmin = adminAuthMiddleware.requireAdmin;
