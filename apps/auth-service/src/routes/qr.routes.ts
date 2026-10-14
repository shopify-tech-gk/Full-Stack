import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '@youmart/errors';
import { config } from '../config';
import { REFRESH_COOKIE_OPTIONS } from '../auth/cookie.util';
import { requireAuth } from '../authMiddleware';
import {
  claimQrLogin,
  codeFromQr,
  createQrLogin,
  decideQrLogin,
  pollQrLogin,
  scanQrLogin,
} from '../auth/qr-login.service';
import { listDevices, signOutDevice, signOutOtherDevices } from '../auth/devices.service';

export const qrRouter: Router = Router();

function browserKey(header: unknown): string {
  return typeof header === 'string' ? header : '';
}

/** The client's IP (display only, on the phone's confirm sheet). */
function clientIp(forwarded: unknown, fallback: string | undefined): string | undefined {
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
  return first || fallback;
}

function requireUser(userId: string | undefined): string {
  if (!userId) throw new AppError('UNAUTHORIZED', 401, 'Authentication required');
  return userId;
}

// --- Website ----------------------------------------------------------------------------------

// PUBLIC: a fresh QR for this browser (2 minutes, single use).
qrRouter.post('/qr', async (req, res) => {
  res.status(201).json(
    await createQrLogin({
      userAgent: req.headers['user-agent'],
      ipAddress: clientIp(req.headers['x-forwarded-for'], req.ip),
    }),
  );
});

// The creating browser polls its QR (needs its browser key).
qrRouter.get('/qr/:id', async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  res.status(200).json(await pollQrLogin(id, browserKey(req.headers['x-qr-browser-key'])));
});

// The creating browser exchanges a confirmed QR for a session (same cookie + body as OTP login).
qrRouter.post('/qr/:id/claim', async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  const session = await claimQrLogin(
    id,
    browserKey(req.headers['x-qr-browser-key']),
    req.headers['user-agent'],
  );
  res.cookie(config.refreshCookieName, session.refreshTokenRaw, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
  res.status(200).json({
    accessToken: session.accessToken,
    expiresIn: session.accessTokenExpiresIn,
    user: session.user,
  });
});

// --- App (signed in) ---------------------------------------------------------------------------

const QrScanBody = z.object({ qr: z.string().trim().min(1).max(500) });

function codeOf(body: unknown): string {
  const { qr } = QrScanBody.parse(body);
  const code = codeFromQr(qr);
  if (!code) throw new AppError('VALIDATION_ERROR', 400, "This isn't a YouMart sign-in code");
  return code;
}

qrRouter.post('/qr/scan', requireAuth, async (req, res) => {
  res.status(200).json(await scanQrLogin(requireUser(req.auth?.userId), codeOf(req.body)));
});

qrRouter.post('/qr/approve', requireAuth, async (req, res) => {
  res.status(200).json(await decideQrLogin(requireUser(req.auth?.userId), codeOf(req.body), true));
});

qrRouter.post('/qr/reject', requireAuth, async (req, res) => {
  res.status(200).json(await decideQrLogin(requireUser(req.auth?.userId), codeOf(req.body), false));
});

// --- Logged-in devices ---------------------------------------------------------------------------

function currentRefreshToken(cookies: unknown): string | undefined {
  const raw = (cookies as Record<string, unknown> | undefined)?.[config.refreshCookieName];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

qrRouter.get('/me/devices', requireAuth, async (req, res) => {
  const items = await listDevices(requireUser(req.auth?.userId), currentRefreshToken(req.cookies));
  res.status(200).json({ items });
});

qrRouter.post('/me/devices/sign-out-others', requireAuth, async (req, res) => {
  res
    .status(200)
    .json(
      await signOutOtherDevices(requireUser(req.auth?.userId), currentRefreshToken(req.cookies)),
    );
});

qrRouter.delete('/me/devices/:id', requireAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await signOutDevice(requireUser(req.auth?.userId), id);
  res.status(204).send();
});
