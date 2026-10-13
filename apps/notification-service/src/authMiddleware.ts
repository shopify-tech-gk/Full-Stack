import type { RequestHandler } from 'express';
import { createAuthMiddleware, type AuthMiddleware } from '@youmart/auth-middleware';
import { config } from './config';

// W9: the customer help-ticket routes are the first signed-in surface of this service.
const authMiddleware: AuthMiddleware = createAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
});

export const requireAuth: RequestHandler = authMiddleware.requireAuth;
