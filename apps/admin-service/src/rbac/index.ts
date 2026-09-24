/**
 * Thin re-export facade: the CANONICAL RBAC model (permission keys, role
 * keys, the role->permission static map, and the resolve/check helpers)
 * is defined once in `@youmart/auth-middleware/src/adminAuth.ts` - the
 * single source of truth every OTHER service's `requireAdmin` check also
 * imports from. admin-service re-exports it here (rather than redefining
 * it) so the seed script and admin-management routes have one obvious
 * local import path (`../rbac`) without duplicating the model.
 */
export {
  PERMISSION_KEYS,
  ADMIN_ROLE_KEYS,
  ROLE_PERMISSIONS,
  resolvePermissions,
  adminHasPermission,
} from '@youmart/auth-middleware';
export type { PermissionKey, AdminRoleKey } from '@youmart/auth-middleware';
