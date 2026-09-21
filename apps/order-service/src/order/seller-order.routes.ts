import { Router } from 'express';
import { ListSellerItemsQuery, UpdateSellerItemStatusBody } from './seller-order.schema';
import { listSellerItems, updateSellerItemStatus } from './seller-order.service';
import { requireAuth } from '../authMiddleware';
import { requireActiveSeller, requireSellerId } from '../sellerScope.middleware';

export const sellerOrderRouter: Router = Router();

// SELLER-OWNED path (Ch5.2) - a seller sees/acts on ONLY their own
// order_items (across any order, even a multi-seller one), resolved
// server-side via requireActiveSeller (seller-service), never a
// client-supplied sellerId. Express 5 auto-forwards rejected promises to
// the central error handler.

sellerOrderRouter.get('/items', requireAuth, requireActiveSeller, async (req, res) => {
  const sellerId = requireSellerId(req);
  const query = ListSellerItemsQuery.parse(req.query);
  const result = await listSellerItems(sellerId, query);
  res.status(200).json(result);
});

sellerOrderRouter.patch(
  '/items/:orderItemId/status',
  requireAuth,
  requireActiveSeller,
  async (req, res) => {
    const sellerId = requireSellerId(req);
    const orderItemId = typeof req.params.orderItemId === 'string' ? req.params.orderItemId : '';
    const body = UpdateSellerItemStatusBody.parse(req.body);
    const item = await updateSellerItemStatus(sellerId, orderItemId, body.status);
    res.status(200).json(item);
  },
);
