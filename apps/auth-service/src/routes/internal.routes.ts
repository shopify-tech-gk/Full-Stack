import { Router } from 'express';
import { getUserContact } from '../user/user.service';
import { getNotificationSettings } from '../user/notification-settings.service';
import { requireServiceAuth } from '../authMiddleware';

export const internalRouter: Router = Router();

// SERVICE-ONLY (Ch6.5) - userId is already an explicit path param, so no
// call-site change was needed beyond swapping the guard itself.
internalRouter.get('/internal/users/:userId/contact', requireServiceAuth, async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId : '';
  const contact = await getUserContact(userId);
  res.status(200).json(contact);
});

// W9: SERVICE-ONLY - notification-service checks the customer's channel settings before sending.
internalRouter.get(
  '/internal/users/:userId/notification-settings',
  requireServiceAuth,
  async (req, res) => {
    const userId = typeof req.params.userId === 'string' ? req.params.userId : '';
    res.status(200).json(await getNotificationSettings(userId));
  },
);
