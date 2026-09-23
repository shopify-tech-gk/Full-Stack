import { Router } from 'express';
import { CreateAdminBody, ListAdminsQuery } from '../admin/admin.schema';
import { createAdmin, listAdmins, deactivateAdmin } from '../admin/admin.service';
import { requireAdmin } from '../authMiddleware';

export const adminManagementRouter: Router = Router();

// Every route here requires the `admins.manage` permission - SUPER_ADMIN
// only per the seeded role->permission map (Ch6.7a). Creating/deactivating
// staff accounts is itself a sensitive admin action.

adminManagementRouter.post('/', requireAdmin('admins.manage'), async (req, res) => {
  const body = CreateAdminBody.parse(req.body);
  const created = await createAdmin(body);
  res.status(201).json(created);
});

adminManagementRouter.get('/', requireAdmin('admins.manage'), async (req, res) => {
  const query = ListAdminsQuery.parse(req.query);
  const result = await listAdmins(query);
  res.status(200).json(result);
});

adminManagementRouter.post('/:id/deactivate', requireAdmin('admins.manage'), async (req, res) => {
  const id = typeof req.params.id === 'string' ? req.params.id : '';
  await deactivateAdmin(id);
  res.status(200).json({ status: 'deactivated' });
});
