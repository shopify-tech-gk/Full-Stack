import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { buildApiError } from '@youmart/errors';
import { config } from './config';

/**
 * Coarse, IP-level backstop rate limit applied to EVERY request through
 * the ONE public port - a defense-in-depth addition, not a replacement for
 * any endpoint-specific limit already enforced inside a service (e.g.
 * auth-service's per-phone OTP limit is untouched and still applies on
 * top of this).
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildApiError('RATE_LIMITED', 'Too many requests, please try again later'));
  },
});

/**
 * W1: the unauthenticated POST forms. v1.2 adds OTP requests - an OTP can now be sent to any
 * email address, so a per-IP cap sits on top of auth-service's per-identifier limits.
 */
export const PUBLIC_FORM_PATHS = [
  '/api/orders/track',
  '/api/support/messages',
  '/api/auth/otp/request',
];

const publicFormLimiter = rateLimit({
  windowMs: config.publicFormRateLimitWindowMs,
  max: config.publicFormRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildApiError('RATE_LIMITED', 'Too many requests, please try again later'));
  },
});

export const publicFormRateLimiter: RequestHandler = (req, res, next) => {
  if (req.method === 'POST' && PUBLIC_FORM_PATHS.includes(req.path)) {
    publicFormLimiter(req, res, next);
    return;
  }
  next();
};
