import { Router } from 'express';
import {
  ListInboxQuery,
  deleteMessage,
  listInbox,
  markAllRead,
  markRead,
  unreadCount,
} from '../inbox/inbox.service';
import { requireAuth } from '../authMiddleware';

// v1.15: the signed-in customer's inbox (the bell). Mounted at /notifications.
export const inboxRouter: Router = Router();

const userId = (req: { auth?: { userId?: string } }) => req.auth?.userId ?? '';
const idParam = (req: { params: Record<string, unknown> }) =>
  typeof req.params.id === 'string' ? req.params.id : '';

inboxRouter.get('/', requireAuth, async (req, res) => {
  res.status(200).json(await listInbox(userId(req), ListInboxQuery.parse(req.query)));
});

inboxRouter.get('/unread-count', requireAuth, async (req, res) => {
  res.status(200).json({ unread: await unreadCount(userId(req)) });
});

inboxRouter.post('/read-all', requireAuth, async (req, res) => {
  res.status(200).json(await markAllRead(userId(req)));
});

inboxRouter.post('/:id/read', requireAuth, async (req, res) => {
  await markRead(userId(req), idParam(req));
  res.status(204).send();
});

inboxRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteMessage(userId(req), idParam(req));
  res.status(204).send();
});
