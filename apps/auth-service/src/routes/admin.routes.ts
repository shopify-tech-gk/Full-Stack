import { Router } from 'express';
import { AdminCustomersQuery, listAdminCustomers } from '../admin/customers.service';
import { requireAdmin } from '../authMiddleware';

export const adminRouter: Router = Router();

// v1.14 admin dashboard: customers (read-only).
adminRouter.get('/admin/customers', requireAdmin('customers.view'), async (req, res) => {
  res.status(200).json(await listAdminCustomers(AdminCustomersQuery.parse(req.query)));
});
