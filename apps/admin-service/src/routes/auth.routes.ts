import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { buildApiError } from '@youmart/errors';
import { AdminLoginBody } from '../admin/admin.schema';
import { login, getMe } from '../admin/admin.service';
import { requireAdmin } from '../authMiddleware';
import { requireAdminId } from '../authToken';

export const authRouter: Router = Router();

// Basic brute-force backstop on the login endpoint specifically - NOT a
// replacement for bcrypt's own slow-hash resistance, just cheap defense
// against a fast-guessing script hammering this one route.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
