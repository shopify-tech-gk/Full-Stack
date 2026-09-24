import { Router } from 'express';
import { UpdateSettingsBody } from '../settings/settings.schema';
import { getSettings, updateSettings } from '../settings/settings.service';
import { requireAdmin } from '../authMiddleware';

export const settingsRouter: Router = Router();

// Any logged-in admin can VIEW settings; only settings.manage can CHANGE
// them (SUPER_ADMIN per the seeded role map) - this IS the marketplace
// on/off switch + commission/TCS/TDS control (Ch8's admin dashboard calls
// PATCH here directly, over the gateway).
settingsRouter.get('/', requireAdmin(), async (_req, res) => {
  const settings = await getSettings();
  res.status(200).json(settings);
});

settingsRouter.patch('/', requireAdmin('settings.manage'), async (req, res) => {
  const body = UpdateSettingsBody.parse(req.body);
  const settings = await updateSettings(body);
  res.status(200).json(settings);
});
