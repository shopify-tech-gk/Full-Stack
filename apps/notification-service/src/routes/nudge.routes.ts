import { Router } from 'express';
import { requireAuth } from '../authMiddleware';
import { CheckoutStartedBody, checkoutStarted } from '../nudges/cart-nudge.service';

// v1.18 "Still in your cart": the app reports that a signed-in customer opened checkout.
// Mounted at /notifications/checkout-nudge (ahead of the inbox routes).
export const nudgeRouter: Router = Router();

nudgeRouter.post('/started', requireAuth, async (req, res) => {
  await checkoutStarted(req.auth?.userId ?? '', CheckoutStartedBody.parse(req.body ?? {}));
  res.status(204).send();
});
