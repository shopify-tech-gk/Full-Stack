import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { buildApiError } from '@youmart/errors';
import { AdminLoginBody } from '../admin/admin.schema';
import { login, getMe } from '../admin/admin.service';
import { requireAdmin } from '../authMiddleware';
import { requireAdminId } from '../authToken';

export const authRouter: Router = Router();

// Brute-force backstop on the login endpoint (on top of bcrypt's slow hash). Only FAILED logins
// count, and per client address + email: before, every admin login reached this service from the
// gateway's one address and every attempt counted, so 10 attempts in 15 minutes - from anyone, even
// successful ones - locked out EVERY admin. Now a bad guesser only blocks their own address for
// that one email. The gateway forwards the client's address (X-Forwarded-For; see app.ts trust).
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    return `${ipKeyGenerator(req.ip ?? 'unknown')}|${email}`;
  },
  handler: (_req, res) => {
    res.status(429).json(buildApiError('RATE_LIMITED', 'Too many login attempts, try again later'));
  },
});

authRouter.post('/login', loginRateLimiter, async (req, res) => {
  const body = AdminLoginBody.parse(req.body);
  const result = await login(body.email, body.password);
  res.status(200).json({
    accessToken: result.token,
    expiresIn: result.expiresIn,
    admin: result.admin,
  });
});

authRouter.get('/me', requireAdmin(), async (req, res) => {
  const profile = await getMe(requireAdminId(req));
  res.status(200).json(profile);
});
