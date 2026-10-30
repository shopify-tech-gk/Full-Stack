import { Router } from 'express';
import { AppError } from '@youmart/errors';
import {
  CreateRazorpayOrderBody,
  CodOrderBody,
  CodReduceBody,
  CreateRefundBody,
  PayOrderBody,
  VerifyPaymentBody,
} from '../payment/payment.schema';
import {
  createRazorpayOrder,
  createRefund,
  getOrderPaymentSummary,
  handleWebhook,
  markCodCollected,
  payOrder,
  reduceCod,
  voidCod,
  verifyClientPayment,
} from '../payment/payment.service';
import { requireAuth, requireServiceAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const paymentRouter: Router = Router();

paymentRouter.post('/razorpay-order', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = CreateRazorpayOrderBody.parse(req.body);
  const result = await createRazorpayOrder(userId, body.orderId);
  res.status(201).json(result);
});

// W9: pay an order - wallet first (optional), Razorpay for any rest. See payOrder.
paymentRouter.post('/pay', requireAuth, async (req, res) => {
  const body = PayOrderBody.parse(req.body);
  res
    .status(200)
    .json(await payOrder(requireUserId(req), body.orderId, body.useWallet, body.method));
});

// W9: the app confirms a Razorpay Checkout payment right away (signature + Razorpay API check)
// instead of waiting for the webhook - see verifyClientPayment.
paymentRouter.post('/verify', requireAuth, async (req, res) => {
  const body = VerifyPaymentBody.parse(req.body);
  res.status(200).json(await verifyClientPayment(requireUserId(req), body));
});

// W9: how the customer's own order was paid (wallet / online) and its refunds.
paymentRouter.get('/orders/:orderId', requireAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  res.status(200).json(await getOrderPaymentSummary(requireUserId(req), orderId));
});

// SERVICE-ONLY (Ch6.5) - called by returns-service (a refunded return) and order-service (an
// approved cancellation). W9: credits the customer's YouMart Wallet; `idempotencyKey` makes a
// retry return the first refund. See payment.service.ts's createRefund doc comment.
paymentRouter.post('/internal/refund', requireServiceAuth, async (req, res) => {
  const body = CreateRefundBody.parse(req.body);
  const result = await createRefund(body);
  res.status(201).json(result);
});

// SERVICE-ONLY - order-service: a COD order fully delivered (cash collected) / cancelled (void).
paymentRouter.post('/internal/cod-collected', requireServiceAuth, async (req, res) => {
  const body = CodOrderBody.parse(req.body);
  res.status(200).json(await markCodCollected(body.orderId));
});
paymentRouter.post('/internal/cod-void', requireServiceAuth, async (req, res) => {
  const body = CodOrderBody.parse(req.body);
  res.status(200).json(await voidCod(body.orderId));
});

paymentRouter.post('/internal/cod-reduce', requireServiceAuth, async (req, res) => {
  const body = CodReduceBody.parse(req.body);
  res.status(200).json(await reduceCod(body.orderId, body.amount));
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
