import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { buildApiError } from '@youmart/errors';
import { ContactMessageBody } from '../support/support.schema';
import { submitContactMessage } from '../support/support.service';

export const supportRouter: Router = Router();

// Per sender phone (the gateway already limits per IP): one number can't flood the inbox by
// rotating IPs.
const contactRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const raw: unknown = (req.body as { phone?: unknown } | undefined)?.phone;
    return typeof raw === 'string' ? `contact:${raw.replace(/\D/g, '').slice(-10)}` : 'contact:-';
  },
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildApiError('RATE_LIMITED', 'Too many messages, please try again later'));
  },
});

// PUBLIC (W1) - the storefront contact form; no login needed.
supportRouter.post('/messages', contactRateLimiter, async (req, res) => {
  const body = ContactMessageBody.parse(req.body);
  res.status(201).json(await submitContactMessage(body));
});
