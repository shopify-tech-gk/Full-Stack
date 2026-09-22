import { Router } from 'express';
import { getUserContact } from '../user/user.service';
import { requireAuth } from '../authMiddleware';

export const internalRouter: Router = Router();

// Internal, service-to-service read (Ch6.2) - see user.service.ts's doc
// comment. requireAuth only (no ownership filter - the caller does its
// own check); a dedicated service-to-service credential is a documented
// future improvement, same gap flagged across every other internal
// endpoint in this repo.
internalRouter.get('/internal/users/:userId/contact', requireAuth, async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId : '';
  const contact = await getUserContact(userId);
  res.status(200).json(contact);
});
