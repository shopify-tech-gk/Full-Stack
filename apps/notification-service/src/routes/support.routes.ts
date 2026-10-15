import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { buildApiError } from '@youmart/errors';
import { ContactMessageBody } from '../support/support.schema';
import { submitContactMessage } from '../support/support.service';
import {
  AdminListTicketsQuery,
  AdminUpdateTicketBody,
  CreateTicketBody,
  ListTicketsQuery,
} from '../support/ticket.schema';
import {
  createTicket,
  getMyTicket,
  listAdminTickets,
  listMyTickets,
  updateAdminTicket,
} from '../support/ticket.service';
import { requireAdmin, requireAuth } from '../authMiddleware';

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

// W9: signed-in customer help requests ("Need help with this order?"). Per customer: at most 10
// new requests an hour, so one account can't flood the support inbox.
const ticketRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ticket:${req.auth?.userId ?? '-'}`,
  handler: (_req, res) => {
    res
      .status(429)
      .json(buildApiError('RATE_LIMITED', 'Too many help requests, please try again later'));
  },
});

supportRouter.post('/tickets', requireAuth, ticketRateLimiter, async (req, res) => {
  const userId = req.auth?.userId ?? '';
  const body = CreateTicketBody.parse(req.body);
  res.status(201).json(await createTicket(userId, body));
});

supportRouter.get('/tickets', requireAuth, async (req, res) => {
  const query = ListTicketsQuery.parse(req.query);
  res.status(200).json(await listMyTickets(req.auth?.userId ?? '', query));
});

supportRouter.get('/tickets/:id', requireAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  res.status(200).json(await getMyTicket(req.auth?.userId ?? '', id));
});

// v1.14 admin dashboard: every customer's help requests; reply / change status.
supportRouter.get('/admin/tickets', requireAdmin('support.manage'), async (req, res) => {
  res.status(200).json(await listAdminTickets(AdminListTicketsQuery.parse(req.query)));
});

supportRouter.patch('/admin/tickets/:id', requireAdmin('support.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  res.status(200).json(await updateAdminTicket(id, AdminUpdateTicketBody.parse(req.body)));
});
