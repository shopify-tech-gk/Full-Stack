import type { Prisma } from '@youmart/db';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import type { UpdateSettingsBody } from './settings.schema';

function decimalToPercent(value: Prisma.Decimal): string {
  return value.toFixed(2);
}

export interface PlatformSettingsView {
  marketplaceMode: 'ENABLED' | 'DISABLED';
  commission: { enabled: boolean; defaultPercent: string };
  tcs: { enabled: boolean; percent: string };
  tds: { enabled: boolean; percent: string };
  updatedAt: string;
}

function toView(row: {
  marketplaceMode: string;
  commissionEnabled: boolean;
  commissionDefaultPercent: Prisma.Decimal;
  tcsEnabled: boolean;
  tcsPercent: Prisma.Decimal;
  tdsEnabled: boolean;
  tdsPercent: Prisma.Decimal;
  updatedAt: Date;
}): PlatformSettingsView {
  return {
    marketplaceMode: row.marketplaceMode as 'ENABLED' | 'DISABLED',
    commission: {
      enabled: row.commissionEnabled,
      defaultPercent: decimalToPercent(row.commissionDefaultPercent),
    },
    tcs: { enabled: row.tcsEnabled, percent: decimalToPercent(row.tcsPercent) },
    tds: { enabled: row.tdsEnabled, percent: decimalToPercent(row.tdsPercent) },
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The SINGLE settings row (Ch2 seed guarantees exactly one exists) - every
 * platform-wide toggle/rate lives on this one row, never per-service env.
 */
async function getSettingsRow() {
  const row = await prisma.marketplaceSettings.findFirst({ where: { deletedAt: null } });
  if (!row) {
    // Should be unreachable - the Ch2 seed always creates exactly one row
    // and nothing ever soft-deletes it.
    throw new AppError('INTERNAL_ERROR', 500, 'Platform settings row is missing');
  }
  return row;
}

export async function getSettings(): Promise<PlatformSettingsView> {
  return toView(await getSettingsRow());
}

export async function updateSettings(patch: UpdateSettingsBody): Promise<PlatformSettingsView> {
  const row = await getSettingsRow();
  const updated = await prisma.marketplaceSettings.update({
    where: { id: row.id },
    data: {
      ...(patch.marketplaceMode !== undefined ? { marketplaceMode: patch.marketplaceMode } : {}),
      ...(patch.commissionEnabled !== undefined
        ? { commissionEnabled: patch.commissionEnabled }
        : {}),
      ...(patch.commissionDefaultPercent !== undefined
        ? { commissionDefaultPercent: patch.commissionDefaultPercent }
        : {}),
      ...(patch.tcsEnabled !== undefined ? { tcsEnabled: patch.tcsEnabled } : {}),
      ...(patch.tcsPercent !== undefined ? { tcsPercent: patch.tcsPercent } : {}),
      ...(patch.tdsEnabled !== undefined ? { tdsEnabled: patch.tdsEnabled } : {}),
      ...(patch.tdsPercent !== undefined ? { tdsPercent: patch.tdsPercent } : {}),
    },
  });
  return toView(updated);
}
