import { Router } from 'express';
import { requireAuth } from '../authMiddleware';
import {
  CreateReminderBody,
  ListRemindersQuery,
  UpdateReminderBody,
  createReminder,
  deleteReminder,
  listReminders,
  remindersForProduct,
  updateReminder,
} from '../reminders/reminder.service';

// v1.18 "Remind me to buy" - the signed-in customer's reminders. Mounted at
// /notifications/reminders (ahead of the inbox routes).
export const reminderRouter: Router = Router();

const userId = (req: { auth?: { userId?: string } }) => req.auth?.userId ?? '';
const param = (req: { params: Record<string, unknown> }, name: string) =>
  typeof req.params[name] === 'string' ? req.params[name] : '';

reminderRouter.get('/', requireAuth, async (req, res) => {
  const { when } = ListRemindersQuery.parse(req.query);
  res.status(200).json(await listReminders(userId(req), when));
});

reminderRouter.get('/product/:productId', requireAuth, async (req, res) => {
  res.status(200).json(await remindersForProduct(userId(req), param(req, 'productId')));
});

reminderRouter.post('/', requireAuth, async (req, res) => {
  res.status(201).json(await createReminder(userId(req), CreateReminderBody.parse(req.body)));
});

reminderRouter.patch('/:id', requireAuth, async (req, res) => {
  res
    .status(200)
    .json(await updateReminder(userId(req), param(req, 'id'), UpdateReminderBody.parse(req.body)));
});

reminderRouter.delete('/:id', requireAuth, async (req, res) => {
  await deleteReminder(userId(req), param(req, 'id'));
  res.status(204).send();
});
