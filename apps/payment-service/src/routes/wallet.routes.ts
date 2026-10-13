import { Router } from 'express';
import { CreateTopupBody, WalletTransactionsQuery } from '../wallet/wallet.schema';
import {
  createTopup,
  forfeitWallet,
  getTopup,
  getWalletSummary,
  listTransactions,
  releaseHold,
} from '../wallet/wallet.service';
import { requireAuth, requireServiceAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

// W9: YouMart Wallet. Every customer route acts on the token's own wallet only.
export const walletRouter: Router = Router();

// --- SERVICE-ONLY (never reachable through the gateway, which blocks /internal) ---------------

// auth-service: the balance shown before an account is deleted.
walletRouter.get('/internal/users/:userId', requireServiceAuth, async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId : '';
  res.status(200).json(await getWalletSummary(userId));
});

// auth-service: the customer confirmed giving up their balance when deleting the account.
walletRouter.post('/internal/users/:userId/forfeit', requireServiceAuth, async (req, res) => {
  const userId = typeof req.params.userId === 'string' ? req.params.userId : '';
  res.status(200).json(await forfeitWallet(userId));
});

// order-service: an unpaid order was cancelled / expired - its reserved wallet money goes back.
walletRouter.post('/internal/holds/:orderId/release', requireServiceAuth, async (req, res) => {
  const orderId = typeof req.params.orderId === 'string' ? req.params.orderId : '';
  await releaseHold(orderId);
  res.status(200).json({ released: true });
});

// --- Customer -----------------------------------------------------------------------------------

walletRouter.get('/', requireAuth, async (req, res) => {
  res.status(200).json(await getWalletSummary(requireUserId(req)));
});

walletRouter.get('/transactions', requireAuth, async (req, res) => {
  const query = WalletTransactionsQuery.parse(req.query);
  res.status(200).json(await listTransactions(requireUserId(req), query));
});

walletRouter.post('/topups', requireAuth, async (req, res) => {
  const body = CreateTopupBody.parse(req.body);
  res.status(201).json(await createTopup(requireUserId(req), body.amount));
});

walletRouter.get('/topups/:id', requireAuth, async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  res.status(200).json(await getTopup(requireUserId(req), id));
});
