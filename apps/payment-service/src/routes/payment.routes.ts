import { Router } from 'express';
import { AppError } from '@youmart/errors';
import { CreateRazorpayOrderBody, CreateRefundBody } from '../payment/payment.schema';
import { createRazorpayOrder, createRefund, handleWebhook } from '../payment/payment.service';
import { requireAuth } from '../authMiddleware';
import { extractBearerToken, requireUserId } from '../authToken';

export const paymentRouter: Router = Router();

paymentRouter.post('/razorpay-order', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const authToken = extractBearerToken(req);
  const body = CreateRazorpayOrderBody.parse(req.body);
  const result = await createRazorpayOrder(userId, body.orderId, authToken);
  res.status(201).json(result);
});

// Internal, service-to-service write - called by returns-service (Ch5.5)
// to issue a Razorpay refund for an approved/picked-up return. requireAuth
// + a forwarded token for now, same temporary pattern as every other
// internal endpoint. Always 200 (even when the Razorpay call itself is
// BLOCKED-on-creds) - the response body's `status`/`blocked` fields carry
// the actual outcome; see payment.service.ts's createRefund doc comment.
paymentRouter.post('/internal/refund', requireAuth, async (req, res) => {
  const body = CreateRefundBody.parse(req.body);
  const result = await createRefund(body);
  res.status(201).json(result);
});

// NO requireAuth - Razorpay calls this directly. The HMAC signature (over
// the RAW body, verified inside handleWebhook) IS the security boundary,
// not a bearer token.
paymentRouter.post('/webhook', async (req, res) => {
  if (!req.rawBody) {
    // Should be unreachable - app.ts's express.json `verify` callback
    // always sets this for every request with a body.
    throw new AppError('VALIDATION_ERROR', 400, 'Missing request body');
  }

  const signatureHeader = req.headers['x-razorpay-signature'];
  const eventIdHeader = req.headers['x-razorpay-event-id'];

  await handleWebhook({
    rawBody: req.rawBody,
    signature: typeof signatureHeader === 'string' ? signatureHeader : undefined,
    headerEventId: typeof eventIdHeader === 'string' ? eventIdHeader : undefined,
    body: req.body,
  });

  res.status(200).json({ received: true });
});
