import { Router } from 'express';
import { AddWishlistItemBody } from '../wishlist/wishlist.schema';
import { addWishlistItem, getWishlist, removeWishlistItem } from '../wishlist/wishlist.service';
import { requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';

export const wishlistRouter: Router = Router();

// Every route is the logged-in user's own wishlist, identified by req.auth.userId only.

wishlistRouter.get('/', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  res.status(200).json(await getWishlist(userId));
});

wishlistRouter.post('/items', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = AddWishlistItemBody.parse(req.body);
  res.status(200).json(await addWishlistItem(userId, body.skuId));
});

wishlistRouter.delete('/items/:wishlistItemId', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const id = typeof req.params.wishlistItemId === 'string' ? req.params.wishlistItemId : '';
  res.status(200).json(await removeWishlistItem(userId, id));
});
