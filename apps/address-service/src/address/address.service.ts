import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import type { CreateAddressBody, UpdateAddressBody } from './address.schema';

export type AddressTypeValue = 'HOME' | 'WORK' | 'OTHER';

export interface AddressView {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: AddressTypeValue;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AddressRow {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: AddressTypeValue;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toAddressView(row: AddressRow): AddressView {
  return {
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    landmark: row.landmark,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
    addressType: row.addressType,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The caller's own active addresses, default first. */
export async function listAddresses(userId: string): Promise<AddressView[]> {
  const rows = await prisma.address.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toAddressView);
}

/** The caller's own address, or a 404 that never reveals whether the id
 * exists at all (vs. belonging to someone else). */
export async function getAddress(userId: string, id: string): Promise<AddressView> {
  const row = await prisma.address.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Address not found');
  }
  return toAddressView(row);
}

/**
 * Creates a new saved address for the caller. The user's FIRST address is
 * always forced `isDefault: true` regardless of what was sent (there must
 * always be a default the moment one exists). If the caller explicitly
 * asked for this one to be the default (and it isn't the first), every
 * other active default for this user is unset first - all inside one
 * transaction, so a concurrent request can never observe two defaults
 * mid-flight. The partial unique index (`address_user_id_default_active_key`)
 * is the actual, final guarantee against a race producing two defaults;
 * this transaction is a courtesy for a clean read path on top of it.
 */
export async function createAddress(
  userId: string,
  input: CreateAddressBody,
): Promise<AddressView> {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId, deletedAt: null } });
    const shouldBeDefault = existingCount === 0 || input.isDefault === true;

    if (shouldBeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const created = await tx.address.create({
      data: {
        userId,
        fullName: input.fullName,
        phone: input.phone,
        line1: input.line1,
        line2: input.line2 ?? null,
        landmark: input.landmark ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country,
        addressType: input.addressType,
        isDefault: shouldBeDefault,
      },
    });

    return toAddressView(created);
  });
}

/**
 * Updates the caller's own address (404 if not theirs). Setting
 * `isDefault: true` unsets every other active default for this user first
 * (transactionally, same guarantee as `createAddress`). Setting
 * `isDefault: false` is allowed as an explicit choice and may leave the
 * user with no default at all - documented behavior, not an error.
 */
export async function updateAddress(
  userId: string,
  id: string,
  input: UpdateAddressBody,
): Promise<AddressView> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, 'Address not found');
    }

    if (input.isDefault === true && !existing.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, deletedAt: null, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.address.update({
      where: { id },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
        ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
        ...(input.landmark !== undefined ? { landmark: input.landmark } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.pincode !== undefined ? { pincode: input.pincode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.addressType !== undefined ? { addressType: input.addressType } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });

    return toAddressView(updated);
  });
}

/**
 * Soft-deletes the caller's own address (404 if not theirs). If the
 * deleted address was the default and other active addresses remain, the
 * most-recently-created one is promoted to default - recommended so a
 * caller never ends up unable to check out for lack of ANY default,
 * without this service silently guessing at a "better" choice. If none
 * remain, the user simply has no default (documented, not an error).
 */
export async function deleteAddress(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, 'Address not found');
    }

    await tx.address.update({
      where: { id },
      data: { deletedAt: new Date(), isDefault: false },
    });

    if (existing.isDefault) {
      const promoted = await tx.address.findFirst({
        where: { userId, deletedAt: null, id: { not: id } },
        orderBy: { createdAt: 'desc' },
      });
      if (promoted) {
        await tx.address.update({ where: { id: promoted.id }, data: { isDefault: true } });
      }
    }
  });
}

/** Makes one address the caller's default, unsetting every other active
 * default for this user - transactional, same guarantee as
 * `createAddress`/`updateAddress`. 404 if the address isn't the caller's
 * own. */
export async function setDefaultAddress(userId: string, id: string): Promise<AddressView> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId, deletedAt: null } });
    if (!existing) {
      throw new AppError('NOT_FOUND', 404, 'Address not found');
    }

    await tx.address.updateMany({
      where: { userId, isDefault: true, deletedAt: null, id: { not: id } },
      data: { isDefault: false },
    });

    const updated = await tx.address.update({ where: { id }, data: { isDefault: true } });
    return toAddressView(updated);
  });
}

/** Snapshot payload for order-service to persist onto an order at checkout
 * time - deliberately every field the order needs to preserve, verbatim,
 * regardless of what happens to the saved address afterwards. Validates
 * ownership server-side (404 if the address isn't the caller's own or
 * doesn't exist) - order-service never trusts a client-supplied userId. */
export interface AddressSnapshot {
  addressId: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export async function getAddressForOrder(
  userId: string,
  addressId: string,
): Promise<AddressSnapshot> {
  const row = await prisma.address.findFirst({
    where: { id: addressId, userId, deletedAt: null },
  });
  if (!row) {
    throw new AppError('NOT_FOUND', 404, 'Address not found');
  }
  return {
    addressId: row.id,
    fullName: row.fullName,
    phone: row.phone,
    line1: row.line1,
    line2: row.line2,
    landmark: row.landmark,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    country: row.country,
  };
}
