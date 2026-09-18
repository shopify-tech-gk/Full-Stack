import { Router } from 'express';
import { config } from '../config';
import { OtpRequestBody, OtpVerifyBody } from '../otp/otp.schema';
import { requestOtp, verifyOtpCode } from '../otp/otp.service';
import { issueSession } from '../auth/session.service';
import { REFRESH_COOKIE_OPTIONS } from '../auth/cookie.util';

export const otpRouter: Router = Router();

// Express 5 auto-forwards rejected promises from async handlers to the
// central error handler (app.ts) - no explicit try/catch + next(err) needed
// here, unlike Express 4.

otpRouter.post('/otp/request', async (req, res) => {
  const body = OtpRequestBody.parse(req.body);
  const result = await requestOtp(body);
  res.status(200).json(result);
});

otpRouter.post('/otp/verify', async (req, res) => {
  const body = OtpVerifyBody.parse(req.body);
  const { userId } = await verifyOtpCode(body);

  const session = await issueSession(userId, req.headers['user-agent']);

  res.cookie(config.refreshCookieName, session.refreshTokenRaw, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });

  // Refresh token stays ONLY in the cookie set above - never in this body.
  res.status(200).json({
    accessToken: session.accessToken,
    expiresIn: session.accessTokenExpiresIn,
    user: session.user,
  });
});
