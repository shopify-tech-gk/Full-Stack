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
  getAvatar,
  setAvatar,
} from '../auth/session.service';
import { REFRESH_COOKIE_OPTIONS } from '../auth/cookie.util';
import { requireAuth } from '../authMiddleware';
import {
  NotificationSettingsBody,
  getNotificationSettings,
  setNotificationSettings,
} from '../user/notification-settings.service';
import { checkAccountDeletion, deleteAccount } from '../user/account-deletion.service';
import { ApplyReferralBody, applyReferralCode, getMyReferral } from '../user/referral.service';
import {
  ContactChangeRequestBody,
  ContactChangeVerifyBody,
  requestContactChange,
  verifyContactChange,
} from '../user/contact-change.service';

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

// v1.17 Refer & Earn: the customer's own code + stats, and entering a friend's code.
sessionRouter.get('/me/referral', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  res.status(200).json(await getMyReferral(userId));
});

sessionRouter.post('/me/referral/apply', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const { code } = ApplyReferralBody.parse(req.body);
  res.status(200).json(await applyReferralCode(userId, code));
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

// v1.12: change / add the account's mobile number or email - OTP to the NEW value first.
sessionRouter.post('/me/contact/request', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const body = ContactChangeRequestBody.parse(req.body);
  res.status(200).json(await requestContactChange(userId, body.identifier));
});

sessionRouter.post('/me/contact/verify', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  const body = ContactChangeVerifyBody.parse(req.body);
  res.status(200).json(await verifyContactChange(userId, body.identifier, body.code));
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

// W8: profile photo on the account. Clients resize to a small JPEG first; ~450 KB is a generous cap
// (well under the 1 MB JSON body limit) and only raster image data URLs are accepted.
const AvatarBody = z.object({
  image: z
    .string()
    .max(450_000, 'Image is too large')
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, 'Unsupported image'),
});

sessionRouter.get('/me/avatar', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  res.status(200).json({ avatar: await getAvatar(userId) });
});

sessionRouter.put('/me/avatar', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  const body = AvatarBody.parse(req.body);
  res.status(200).json({ avatar: await setAvatar(userId, body.image) });
});

sessionRouter.delete('/me/avatar', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  res.status(200).json({ avatar: await setAvatar(userId, null) });
});

// W9: which channels the customer wants order updates / offers on.
sessionRouter.get('/me/notification-settings', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  res.status(200).json(await getNotificationSettings(userId));
});

sessionRouter.put('/me/notification-settings', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  const body = NotificationSettingsBody.parse(req.body);
  res.status(200).json(await setNotificationSettings(userId, body));
});

// W9: account deletion - what stands in the way (open orders, wallet balance), then the delete.
sessionRouter.get('/me/deletion-check', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  res.status(200).json(await checkAccountDeletion(userId));
});

const DeleteAccountBody = z.object({
  /** The customer typed/confirmed DELETE - guards against an accidental call. */
  confirm: z.literal('DELETE'),
  /** Required (true) when the wallet still has money: the customer gives it up. */
  forfeitWallet: z.boolean().default(false),
});

sessionRouter.delete('/me', requireAuth, async (req, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  }
  const body = DeleteAccountBody.parse(req.body);
  const result = await deleteAccount(userId, { forfeitWallet: body.forfeitWallet });
  res.clearCookie(config.refreshCookieName, {
    httpOnly: REFRESH_COOKIE_OPTIONS.httpOnly,
    secure: REFRESH_COOKIE_OPTIONS.secure,
    sameSite: REFRESH_COOKIE_OPTIONS.sameSite,
    path: REFRESH_COOKIE_OPTIONS.path,
    domain: REFRESH_COOKIE_OPTIONS.domain,
  });
  res.status(200).json(result);
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
