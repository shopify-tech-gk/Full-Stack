import { z } from 'zod';
import { ADMIN_ROLE_KEYS } from '@youmart/auth-middleware';

export const AdminLoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type AdminLoginBody = z.infer<typeof AdminLoginBody>;

export const CreateAdminBody = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z.string().min(8).max(200),
  role: z.enum(ADMIN_ROLE_KEYS),
});
export type CreateAdminBody = z.infer<typeof CreateAdminBody>;

export const ListAdminsQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().uuid().optional(),
});
export type ListAdminsQuery = z.infer<typeof ListAdminsQuery>;
