import { Router } from 'express';
import { config } from '../config';
import { AppError } from '@youmart/errors';
import { rotateSession, revokeSession } from '../auth/session.service';
import { REFRESH_COOKIE_OPTIONS } from '../auth/cookie.util';

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

  res.status(200).json({
    accessToken: session.accessToken,
    expiresIn: session.accessTokenExpiresIn,
  });
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
