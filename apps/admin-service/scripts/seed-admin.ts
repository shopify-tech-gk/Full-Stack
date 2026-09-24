import { PERMISSION_KEYS, ADMIN_ROLE_KEYS, ROLE_PERMISSIONS } from '@youmart/auth-middleware';
import { config } from '../src/config';
import { prisma, close } from '../src/db';
import { hashPassword } from '../src/auth/password.util';

// Only 3 of the 4 AdminRole enum values get a seeded Role row + mappings -
// SUPPORT stays unused/dormant per the Ch6.7a spec (the enum value exists
// for future use, but no permissions/account use it yet).
const SEEDED_ROLE_KEYS = ADMIN_ROLE_KEYS.filter((key) => key !== 'SUPPORT');

async function seedPermissions(): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>();

  for (const key of PERMISSION_KEYS) {
    const existing = await prisma.permission.findFirst({ where: { key, deletedAt: null } });
    if (existing) {
      console.log(`Permission "${key}" already exists (id=${existing.id}), skipping.`);
      idByKey.set(key, existing.id);
      continue;
    }
    const created = await prisma.permission.create({ data: { key } });
    console.log(`Created permission "${key}" (id=${created.id}).`);
    idByKey.set(key, created.id);
  }

  return idByKey;
}

async function seedRoles(): Promise<Map<string, string>> {
  const idByKey = new Map<string, string>();

  for (const key of SEEDED_ROLE_KEYS) {
    const existing = await prisma.role.findFirst({ where: { key, deletedAt: null } });
    if (existing) {
      console.log(`Role "${key}" already exists (id=${existing.id}), skipping.`);
      idByKey.set(key, existing.id);
      continue;
    }
    const created = await prisma.role.create({ data: { key } });
    console.log(`Created role "${key}" (id=${created.id}).`);
    idByKey.set(key, created.id);
  }

  return idByKey;
}

async function seedRolePermissions(
  roleIdByKey: Map<string, string>,
  permissionIdByKey: Map<string, string>,
): Promise<void> {
  for (const roleKey of SEEDED_ROLE_KEYS) {
    const roleId = roleIdByKey.get(roleKey);
    if (!roleId) {
      throw new Error(`Missing seeded role id for "${roleKey}"`);
    }

    for (const permissionKey of ROLE_PERMISSIONS[roleKey]) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) {
        throw new Error(`Missing seeded permission id for "${permissionKey}"`);
      }

      const existing = await prisma.rolePermission.findFirst({
        where: { roleId, permissionId, deletedAt: null },
      });
      if (existing) {
        console.log(`RolePermission ${roleKey}->${permissionKey} already exists, skipping.`);
        continue;
      }

      await prisma.rolePermission.create({ data: { roleId, permissionId } });
      console.log(`Mapped role "${roleKey}" -> permission "${permissionKey}".`);
    }
  }
}

async function seedSuperAdmin(): Promise<void> {
  const existing = await prisma.admin.findFirst({
    where: { email: config.initialAdminEmail, deletedAt: null },
  });
  if (existing) {
    console.log(
      `Admin "${config.initialAdminEmail}" already exists (id=${existing.id}), skipping.`,
    );
    return;
  }

  const passwordHash = await hashPassword(config.initialAdminPassword);
  const created = await prisma.admin.create({
    data: {
      email: config.initialAdminEmail,
      name: 'Super Admin',
      adminRole: 'SUPER_ADMIN',
      passwordHash,
    },
  });
  console.log(`Created SUPER_ADMIN "${config.initialAdminEmail}" (id=${created.id}).`);
  console.log(
    'IMPORTANT: this password came from INITIAL_ADMIN_PASSWORD (a dev placeholder) - change it before any non-dev deploy.',
  );
}

async function main(): Promise<void> {
  const permissionIdByKey = await seedPermissions();
  const roleIdByKey = await seedRoles();
  await seedRolePermissions(roleIdByKey, permissionIdByKey);
  await seedSuperAdmin();
}

main()
  .then(async () => {
    await close();
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await close();
    process.exit(1);
  });
