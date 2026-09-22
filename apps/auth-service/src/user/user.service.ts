import { AppError } from '@youmart/errors';
import { prisma } from '../db';

export interface UserContactView {
  userId: string;
  phone: string;
  email: string | null;
}

/**
 * Internal, service-to-service read (order-service's order-confirmation
 * notification, logistics-service's shipping-update notification, Ch6.2)
 * - resolves a user's own contact details so those services can enqueue a
 * notification without ever querying the auth schema directly (cross-schema
 * isolation). No ownership check beyond `requireAuth` itself: the caller
 * already legitimately knows this `userId` (e.g. from its own `order.userId`),
 * this just resolves contact info for it - same "forwarded token, no
 * ownership filter, caller does its own check" pattern as every other
 * internal endpoint in this repo.
 */
export async function getUserContact(userId: string): Promise<UserContactView> {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }
  return { userId: user.id, phone: user.phone, email: user.email };
}
