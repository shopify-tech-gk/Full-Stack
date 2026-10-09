import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { AppError } from '@youmart/errors';
import {
  getSessionUser,
  rotateSession,
  revokeSession,
  updateProfile,
  getCategoryOrder,
  setCategoryOrder,
} from '../auth/session.service';
import { REFRESH_COOKIE_OPTIONS } from '../auth/cookie.util';
import { requireAuth } from '../authMiddleware';

export const sessionRouter: Router = Router();

sessionRouter.post('/refresh', async (req, res) => {
  const rawRefreshToken: unknown = req.cookies?.[config.refreshCookieName];

  if (typeof rawRefreshToken !== 'string' || rawRefreshToken.length === 0) {
    throw new AppError('UNAUTHORIZED', 401, 'Missing refresh token');
  }

  const session = await rotateSession(rawRefreshToken, req.headers['user-agent']);

  res.cookie(config.refreshCookieName, session.refreshTokenRaw, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });

  // v1.2: `user` lets a reloaded client restore who is logged in from this one call.
  res.status(200).json({
    accessToken: session.accessToken,
    expiresIn: session.accessTokenExpiresIn,
    user: session.user,
  });
});

sessionRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  res.status(200).json(await getSessionUser(userId));
});

const UpdateProfileBody = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please enter your name')
    .max(100, 'Name must be 100 characters or fewer'),
});

sessionRouter.patch('/me', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  const body = UpdateProfileBody.parse(req.body);
  res.status(200).json(await updateProfile(userId, body));
});

// W8: the customer's home "Shop by category" order (drag-and-drop), stored on the account.
const CategoryOrderBody = z.object({
  categoryOrder: z.array(z.string().trim().min(1).max(80)).max(200),
});

sessionRouter.get('/me/preferences', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  res.status(200).json({ categoryOrder: await getCategoryOrder(userId) });
});

sessionRouter.put('/me/preferences', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  const body = CategoryOrderBody.parse(req.body);
  res.status(200).json({ categoryOrder: await setCategoryOrder(userId, body.categoryOrder) });
});

sessionRouter.post('/logout', async (req, res) => {
  const rawRefreshToken: unknown = req.cookies?.[config.refreshCookieName];

  if (typeof rawRefreshToken === 'string' && rawRefreshToken.length > 0) {
    await revokeSession(rawRefreshToken);
  }

  // Always 200, always clears the cookie - never leaks whether a session existed.
  res.clearCookie(config.refreshCookieName, {
    httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
    secure: REFRESH_COOKIE_OPTIONS.secure,
    sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    path: REFRESH_COOKIE_OPTIONS.path,
    domain: REFRESH_COOKIE_OPTIONS.domain,
  });
  res.status(200).json({ status: 'logged_out' });
});

sessionRouter.get('/public-key', (_req, res) => {
  // Public by design - lets every other service verify tokens this service signs.
  res.status(200).type('text/plain').send(config.jwtPublicKey);
});
