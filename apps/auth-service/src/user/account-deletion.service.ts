import { Prisma } from '@youmart/db';
import type { Money } from '@youmart/shared-types';
import { AppError } from '@youmart/errors';
import { prisma } from '../db';
import { logger } from '../logger';
import { addressClient, eraseRecentlyViewed, orderClient, paymentClient } from '../serviceClients';

// W9: in-app account deletion (Google Play / App Store requirement; DPDP Act). The account row is
// kept only as an anonymous shell - phone, email, name, photo and preferences are cleared and the
// row soft-deleted - because orders and GST invoices must be retained by law and still point at
// it. Saved addresses and viewing history are erased; every session is signed out.

export interface DeletionCheck {
  canDelete: boolean;
  /** Orders still in progress - deletion waits until they are delivered, cancelled or returned. */
  openOrders: number;
  /** Wallet balance that would be given up (closed-system store credit, never paid out). */
  walletBalance: Money;
  /** Wallet money reserved for an order awaiting payment - deletion waits for it too. */
  walletHeld: Money;
}

export async function checkAccountDeletion(userId: string): Promise<DeletionCheck> {
  const [{ openOrders }, wallet] = await Promise.all([
    orderClient.countOpenOrders(userId),
    paymentClient.getWallet(userId),
  ]);
  return {
    canDelete: openOrders === 0 && wallet.held === '0.00',
    openOrders,
    walletBalance: wallet.balance,
    walletHeld: wallet.held,
  };
}

/**
 * Deletes the caller's account. Refused (409) while an order is in progress, and while the wallet
 * holds money unless `forfeitWallet` confirms the customer gives it up (Terms: wallet balance is
 * forfeited on account deletion).
 */
export async function deleteAccount(
  userId: string,
  input: { forfeitWallet: boolean },
): Promise<{ deleted: true; walletForfeited: Money }> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'Account not found');
  }

  const check = await checkAccountDeletion(userId);
  if (check.openOrders > 0) {
    throw new AppError(
      'CONFLICT',
      409,
      `You have ${check.openOrders} order(s) in progress. You can delete your account once they are delivered or cancelled.`,
      { reason: 'OPEN_ORDERS', openOrders: check.openOrders },
    );
  }
  if (check.walletHeld !== '0.00') {
    throw new AppError(
      'CONFLICT',
      409,
      'Some wallet money is reserved for an order awaiting payment. Please try again shortly.',
      { reason: 'WALLET_HELD' },
    );
  }
  if (check.walletBalance !== '0.00' && !input.forfeitWallet) {
    throw new AppError(
      'CONFLICT',
      409,
      `Your YouMart Wallet has Rs ${check.walletBalance}. Use it first, or confirm that you give it up.`,
      { reason: 'WALLET_BALANCE', walletBalance: check.walletBalance },
    );
  }

  const walletForfeited =
    check.walletBalance !== '0.00'
      ? (await paymentClient.forfeitWallet(userId)).forfeited
      : ('0.00' as Money);

  // Personal data held by other services - best-effort: a failure is logged for follow-up but
  // never leaves the customer with an account they asked to delete.
  await Promise.all([
    addressClient
      .eraseAddressesForUser(userId)
      .catch((err: unknown) =>
        logger.error({ err, userId }, 'account deletion: erasing saved addresses failed'),
      ),
    eraseRecentlyViewed(userId).catch((err: unknown) =>
      logger.error({ err, userId }, 'account deletion: erasing viewing history failed'),
    ),
  ]);

  const now = new Date();
  // Only identifiers the account actually had - an empty filter would match every challenge.
  const identifiers: Prisma.OtpChallengeWhereInput[] = [];
  if (user.phone) identifiers.push({ phone: user.phone });
  if (user.email) identifiers.push({ email: user.email });

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, deletedAt: null },
      data: { revokedAt: now },
    }),
    prisma.oAuthAccount.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: now },
    }),
    ...(identifiers.length
      ? [
          prisma.otpChallenge.updateMany({
            where: { OR: identifiers, deletedAt: null },
            data: { deletedAt: now },
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: {
        phone: null,
        email: null,
        name: null,
        avatar: null,
        preferences: Prisma.DbNull,
        isPhoneVerified: false,
        isEmailVerified: false,
        status: 'BLOCKED',
        deletedAt: now,
      },
    }),
  ]);

  logger.info({ userId, walletForfeited }, 'account deleted by the customer');
  return { deleted: true, walletForfeited };
}
