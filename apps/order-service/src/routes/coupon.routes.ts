import { Router } from 'express';
import { z } from 'zod';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { optionalAuth, requireAdmin, requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';
import { cartClient } from '../serviceClients';
import {
  CouponInput,
  CouponPatch,
  adminCreateCoupon,
  adminListCoupons,
  adminUpdateCoupon,
  listAvailableCoupons,
  quoteCoupon,
} from '../coupon/coupon.service';

// v1.13 coupons. Mounted at /orders/coupons BEFORE the order router (whose /:orderId would
// otherwise swallow "coupons").
export const couponRouter: Router = Router();

const AvailableQuery = z.object({
  subtotal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
});

/** Public offers (Coupons / My offers page; checkout "View offers" passes the cart subtotal). */
couponRouter.get('/', optionalAuth, async (req, res) => {
  const { subtotal } = AvailableQuery.parse(req.query);
  const userId = req.auth?.userId ?? null;
  res.status(200).json({
    items: await listAvailableCoupons(
      userId,
      subtotal ? (Number(subtotal).toFixed(2) as Money) : null,
    ),
  });
});

const QuoteBody = z.object({
  code: z.string().max(40),
  /** "Buy this now": quote against just these cart lines (default: the whole cart). */
  cartItemIds: z.array(z.string().uuid()).min(1).max(100).optional(),
});

/** Checkout preview: is this code valid for my cart, and how much does it take off? */
couponRouter.post('/quote', requireAuth, async (req, res) => {
  const userId = requireUserId(req);
  const body = QuoteBody.parse(req.body);
  const cart = await cartClient.getMyCart(userId);
  const wanted = body.cartItemIds ? new Set(body.cartItemIds) : null;
  const lines = wanted ? cart.items.filter((l) => wanted.has(l.cartItemId)) : cart.items;
  if (lines.length === 0) throw new AppError('VALIDATION_ERROR', 400, 'Your cart is empty');
  const subtotal = (
    lines.reduce((p, l) => p + Math.round(Number(l.lineTotal) * 100), 0) / 100
  ).toFixed(2) as Money;
  res.status(200).json(await quoteCoupon(userId, body.code, subtotal));
});

// --- Admin: promotions.manage (SUPER_ADMIN, OPS) ---
couponRouter.get('/admin', requireAdmin('promotions.manage'), async (_req, res) => {
  res.status(200).json(await adminListCoupons());
});

couponRouter.post('/admin', requireAdmin('promotions.manage'), async (req, res) => {
  res.status(201).json(await adminCreateCoupon(CouponInput.parse(req.body)));
});

couponRouter.patch('/admin/:code', requireAdmin('promotions.manage'), async (req, res) => {
  const code = typeof req.params.code === 'string' ? req.params.code : '';
  res.status(200).json(await adminUpdateCoupon(code, CouponPatch.parse(req.body)));
});
