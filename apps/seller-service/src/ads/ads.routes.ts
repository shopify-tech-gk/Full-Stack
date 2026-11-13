import express, { Router } from 'express';
import { AppError } from '@youmart/errors';
import { requireAdmin, requireAuth } from '../authMiddleware';
import { requireUserId } from '../authToken';
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, mediaFile, saveUpload } from './ad-media';
import {
  AdminListAdsQuery,
  AvailabilityQuery,
  CreateAdBody,
  ReasonBody,
  adminListAds,
  approveAd,
  availability,
  cancelAd,
  createAd,
  listMyAds,
  liveAds,
  payForAd,
  rejectAd,
  removeAd,
} from './ads.service';

// v1.19 Advertising. Mounted at /sellers/ads (advertisers + shoppers) and /admin/sellers/ads
// (review) - both ahead of the seller routers so "ads" is never read as a seller id.

export const adsRouter: Router = Router();

const idParam = (v: unknown) => (typeof v === 'string' ? v : '');

// Shoppers: what's showing now (Home's Sponsored slot and video window).
adsRouter.get('/live', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(await liveAds());
});

// Public: an ad's photo / video (random names). Range requests work for video playback.
adsRouter.get('/media/:name', (req, res, next) => {
  const found = mediaFile(idParam(req.params.name));
  if (!found) {
    next(new AppError('NOT_FOUND', 404, 'File not found'));
    return;
  }
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(
    found.file,
    { headers: { 'Content-Type': found.contentType }, maxAge: '7d', immutable: true },
    (err) => {
      if (err && !res.headersSent) next(new AppError('NOT_FOUND', 404, 'File not found'));
    },
  );
});

// Booked windows for a kind (so the app can grey them out) + the price.
adsRouter.get('/availability', async (req, res) => {
  res.status(200).json(await availability(AvailabilityQuery.parse(req.query).kind));
});

// Advertiser: upload one file (raw body, Content-Type = the file's type).
adsRouter.post(
  '/media',
  requireAuth,
  express.raw({ type: UPLOAD_TYPES, limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    res
      .status(201)
      .json(await saveUpload(requireUserId(req), req.headers['content-type'], req.body));
  },
);

adsRouter.get('/mine', requireAuth, async (req, res) => {
  res.status(200).json(await listMyAds(requireUserId(req)));
});

adsRouter.post('/', requireAuth, async (req, res) => {
  res.status(201).json(await createAd(requireUserId(req), CreateAdBody.parse(req.body)));
});

adsRouter.post('/:id/pay', requireAuth, async (req, res) => {
  res.status(200).json(await payForAd(requireUserId(req), idParam(req.params.id)));
});

adsRouter.post('/:id/cancel', requireAuth, async (req, res) => {
  res.status(200).json(await cancelAd(requireUserId(req), idParam(req.params.id)));
});

// --- Admin review (SUPER_ADMIN: sellers.approve) ------------------------------------------------

export const adminAdsRouter: Router = Router();

adminAdsRouter.get('/', requireAdmin('sellers.approve'), async (req, res) => {
  res.status(200).json(await adminListAds(AdminListAdsQuery.parse(req.query)));
});

adminAdsRouter.post('/:id/approve', requireAdmin('sellers.approve'), async (req, res) => {
  res.status(200).json(await approveAd(idParam(req.params.id)));
});

adminAdsRouter.post('/:id/reject', requireAdmin('sellers.approve'), async (req, res) => {
  res.status(200).json(await rejectAd(idParam(req.params.id), ReasonBody.parse(req.body).reason));
});

adminAdsRouter.post('/:id/remove', requireAdmin('sellers.approve'), async (req, res) => {
  res.status(200).json(await removeAd(idParam(req.params.id), ReasonBody.parse(req.body).reason));
});
