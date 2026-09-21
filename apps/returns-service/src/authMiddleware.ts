import type { RequestHandler } from 'express';
import { createAuthMiddleware, type AuthMiddleware } from '@youmart/auth-middleware';
import { config } from './config';

const authMiddleware: AuthMiddleware = createAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
});

export const requireAuth: RequestHandler = authMiddleware.requireAuth;
export const optionalAuth: RequestHandler = authMiddleware.optionalAuth;
