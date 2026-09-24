import { Router } from 'express';
import { getSettings } from '../settings/settings.service';
import { requireServiceAuth } from '../authMiddleware';

export const internalSettingsRouter: Router = Router();

// SERVICE-ONLY (Ch6.5/Ch6.7b) - every other service's @youmart/service-
// client settings client fetches from here (cached client-side, see
// createSettingsClient's doc comment) instead of keeping its own env copy.
internalSettingsRouter.get('/settings', requireServiceAuth, async (_req, res) => {
  const settings = await getSettings();
  res.status(200).json(settings);
});
