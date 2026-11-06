import { Router, type Response } from 'express';
import { config } from '../config';
import { getSessionUser, issueSession } from '../auth/session.service';
import { requireAuth } from '../authMiddleware';
import { REFRESH_COOKIE_OPTIONS } from '../auth/cookie.util';
import {
  PasswordLoginBody,
  RegisterStartBody,
  RegisterVerifyBody,
  SetLoginBody,
  completeRegistration,
  setLogin,
  passwordLogin,
  startRegistration,
  usernameAvailability,
} from '../user/password-login.service';

// v1.18 Username + password: check a username, register (mobile OTP required), log in.
export const passwordRouter: Router = Router();

/** Same session response as /auth/otp/verify (refresh token only in the cookie). */
async function signIn(res: Response, userId: string, userAgent: string | undefined) {
  const session = await issueSession(userId, userAgent);
  res.cookie(config.refreshCookieName, session.refreshTokenRaw, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
  res.status(200).json({
    accessToken: session.accessToken,
    expiresIn: session.accessTokenExpiresIn,
    user: session.user,
  });
}

passwordRouter.get('/username/check', async (req, res) => {
  res.json(await usernameAvailability(String(req.query.u ?? '')));
});

passwordRouter.post('/register/start', async (req, res) => {
  res.status(200).json(await startRegistration(RegisterStartBody.parse(req.body)));
});

passwordRouter.post('/register/verify', async (req, res) => {
  const { userId } = await completeRegistration(RegisterVerifyBody.parse(req.body));
  await signIn(res, userId, req.headers['user-agent']);
});

// v1.18 Account: add the username (once) and/or a first password to the signed-in account.
passwordRouter.patch('/me/login', requireAuth, async (req, res) => {
  const userId = req.auth?.userId ?? '';
  await setLogin(userId, SetLoginBody.parse(req.body));
  res.json(await getSessionUser(userId));
});

passwordRouter.post('/login/password', async (req, res) => {
  const { userId } = await passwordLogin(PasswordLoginBody.parse(req.body));
  await signIn(res, userId, req.headers['user-agent']);
});
