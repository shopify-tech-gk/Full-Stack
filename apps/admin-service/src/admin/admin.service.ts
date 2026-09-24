import { AppError } from '@youmart/errors';
import type { AdminRoleKey } from '@youmart/auth-middleware';
import { resolvePermissions } from '@youmart/auth-middleware';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../auth/password.util';
import { signAdminToken } from '../auth/token.util';

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRoleKey;
  permissions: readonly string[];
}

function toProfile(admin: {
  id: string;
  email: string;
  name: string;
  adminRole: string;
}): AdminProfile {
  const role = admin.adminRole as AdminRoleKey;
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role,
    permissions: resolvePermissions(role),
  };
}

/**
 * Generic "invalid email or password" failure for EITHER "no such admin"
 * or "wrong password" - never reveals which, same principle as every
 * other auth check in this repo.
 */
const INVALID_CREDENTIALS = 'Invalid email or password';

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; expiresIn: number; admin: AdminProfile }> {
  const admin = await prisma.admin.findFirst({ where: { email, deletedAt: null } });
  if (!admin?.passwordHash) {
    // Runs a dummy bcrypt.compare even when no admin row exists, so the
    // response time doesn't itself reveal whether the email is registered.
    await verifyPassword(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    throw new AppError('UNAUTHORIZED', 401, INVALID_CREDENTIALS);
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    throw new AppError('UNAUTHORIZED', 401, INVALID_CREDENTIALS);
  }

  const profile = toProfile(admin);
  const { token, expiresIn } = signAdminToken({ id: admin.id, role: profile.role });
  return { token, expiresIn, admin: profile };
}

export async function getMe(adminId: string): Promise<AdminProfile> {
  const admin = await prisma.admin.findFirst({ where: { id: adminId, deletedAt: null } });
  if (!admin) {
    throw new AppError('NOT_FOUND', 404, 'Admin not found');
  }
  return toProfile(admin);
}

export async function createAdmin(input: {
  email: string;
  name: string;
  password: string;
  role: AdminRoleKey;
}): Promise<AdminProfile> {
  const existing = await prisma.admin.findFirst({ where: { email: input.email, deletedAt: null } });
  if (existing) {
    throw new AppError('CONFLICT', 409, 'An admin with this email already exists');
  }

  const passwordHash = await hashPassword(input.password);
  const created = await prisma.admin.create({
    data: { email: input.email, name: input.name, adminRole: input.role, passwordHash },
  });
  return toProfile(created);
}

export interface ListAdminsResult {
  items: AdminProfile[];
  nextCursor: string | undefined;
}

export async function listAdmins(params: {
  limit: number;
  cursor?: string;
}): Promise<ListAdminsResult> {
  const rows = await prisma.admin.findMany({
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: params.limit + 1,
    ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > params.limit;
  const items = (hasMore ? rows.slice(0, params.limit) : rows).map(toProfile);
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;
  return { items, nextCursor };
}

export async function deactivateAdmin(adminId: string): Promise<void> {
  const admin = await prisma.admin.findFirst({ where: { id: adminId, deletedAt: null } });
  if (!admin) {
    throw new AppError('NOT_FOUND', 404, 'Admin not found');
  }
  await prisma.admin.update({ where: { id: adminId }, data: { deletedAt: new Date() } });
}
